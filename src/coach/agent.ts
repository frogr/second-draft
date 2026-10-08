import type { Message, Provider, ToolCall } from './providers/types.js';
import { ProviderError } from './providers/types.js';
import { deterministicCoach } from './deterministic.js';
import { runTool, SUBMIT_TOOL, TOOL_DEFS, type ToolContext } from './tools.js';
import type { CoachingItem, TraceStep } from './types.js';
import { GOAL_LABELS } from './types.js';
import { MAX_ITEMS, validateItems, type ValidationError } from './validate.js';

export interface AgentLimits {
  maxIterations: number;
  /** input + output tokens across all model calls */
  tokenBudget: number;
  timeoutMs: number;
  maxTokensPerTurn: number;
}

export const DEFAULT_LIMITS: AgentLimits = { maxIterations: 8, tokenBudget: 60_000, timeoutMs: 45_000, maxTokensPerTurn: 2_000 };

export interface AgentOutcome {
  status: 'submitted' | 'fallback';
  summary: string;
  items: CoachingItem[];
  trace: TraceStep[];
  notes: string[];
  usage: { inputTokens: number; outputTokens: number };
  /** why the agent fell back, for logs (never shown raw to visitors) */
  failure?: string;
}

export function systemPrompt(): string {
  return [
    'You are Second Draft, a writing coach. Deterministic tools measure the draft; your job is to choose, explain and coach.',
    'Work like this: call analyze_draft, read the sentences you are considering with get_sentences, use compare_drafts if a previous draft exists, then call submit_coaching once.',
    `Pick the ${MAX_ITEMS} fixes with the most leverage for the writer's goal. Leverage means: fixing it changes how the whole piece reads, not just one word. Prefer the opening, repeated habits, and sentences carrying the main point.`,
    'Every item must quote text copied character for character from get_sentences output, inside the sentence named by sentence_index. Never paraphrase the quote.',
    'The rewrite replaces only the quoted text and keeps the writer\'s voice. Use [brackets] only for details only the writer knows.',
    'Write plainly: short sentences, no hype, no em dashes. Be specific to this draft. The exercise should take under ten minutes.',
  ].join('\n');
}

export function userPrompt(ctx: ToolContext): string {
  return [
    `Goal: ${GOAL_LABELS[ctx.goal]}.`,
    `The draft has ${ctx.analysis.sentences.length} sentences (indexes 0 to ${ctx.analysis.sentences.length - 1}) and ${ctx.analysis.metrics.words} words.`,
    ctx.previous ? 'A previous draft exists; compare_drafts can tell you what changed.' : 'There is no previous draft.',
    '',
    '<draft>',
    ctx.draft,
    '</draft>',
  ].join('\n');
}

const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}...` : s);

/**
 * The tool-use loop. The model calls read-only tools until it calls submit_coaching.
 * Submitted items are validated against the draft; invalid ones get one repair turn and are then dropped.
 * Stops on max iterations, token budget or timeout. Any failure returns status "fallback" and the
 * caller serves the deterministic coach instead.
 */
export async function runAgent(provider: Provider, ctx: ToolContext, limits: AgentLimits = DEFAULT_LIMITS, now: () => number = Date.now): Promise<AgentOutcome> {
  const trace: TraceStep[] = [];
  const notes: string[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const messages: Message[] = [{ role: 'user', text: userPrompt(ctx) }];
  const controller = new AbortController();
  const started = now();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  let step = 0;
  let repairUsed = false;
  const add = (s: Omit<TraceStep, 'step'>) => trace.push({ step: ++step, ...s });
  const fallback = (failure: string, note: string): AgentOutcome => {
    add({ kind: 'note', name: 'fallback', output: note, ms: 0, ok: false });
    notes.push(note);
    return { status: 'fallback', summary: '', items: [], trace, notes, usage, failure };
  };

  try {
    for (let iteration = 0; iteration < limits.maxIterations; iteration++) {
      if (usage.inputTokens + usage.outputTokens >= limits.tokenBudget) return fallback('token budget', 'Stopped: token budget used up before the coach finished.');
      if (now() - started >= limits.timeoutMs) return fallback('timeout', 'Stopped: the model took too long.');
      const t0 = now();
      const turn = await provider.complete({ system: systemPrompt(), messages, tools: TOOL_DEFS, maxTokens: limits.maxTokensPerTurn, signal: controller.signal });
      usage.inputTokens += turn.usage.input;
      usage.outputTokens += turn.usage.output;
      const cutOff = turn.stopReason === 'max_tokens' || turn.stopReason === 'length';
      add({
        kind: 'model',
        name: provider.model,
        output: (turn.toolCalls.length ? `asked for ${turn.toolCalls.map((c) => c.name).join(', ')}` : clip(turn.text || '(no text)', 160)) + (cutOff ? ' (reply cut off at the token limit)' : ''),
        ms: now() - t0,
        ok: !cutOff,
      });
      messages.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls });

      if (!turn.toolCalls.length) {
        messages.push({ role: 'user', text: `Please finish by calling ${SUBMIT_TOOL}.` });
        continue;
      }
      const results: Extract<Message, { role: 'tool_results' }>['results'] = [];
      let finished: AgentOutcome | null = null;
      for (const call of turn.toolCalls) {
        if (call.name === SUBMIT_TOOL) {
          const outcome = handleSubmit(call, ctx, repairUsed, add);
          if (outcome.done) {
            finished = { status: 'submitted', summary: outcome.summary, items: outcome.items, trace, notes, usage };
            if (outcome.dropped) notes.push(`${outcome.dropped} model item${outcome.dropped > 1 ? 's' : ''} failed validation after the repair turn and ${outcome.dropped > 1 ? 'were' : 'was'} dropped.`);
            results.push({ id: call.id, name: call.name, content: JSON.stringify({ accepted: outcome.items.length }), isError: false });
          } else {
            repairUsed = true;
            results.push({ id: call.id, name: call.name, content: JSON.stringify({ errors: outcome.errors, instruction: `Fix only the failing items and call ${SUBMIT_TOOL} again with all items. This is the only repair turn.` }), isError: true });
          }
        } else {
          const t1 = now();
          const out = runTool(ctx, call.name, call.args);
          add({ kind: 'tool', name: call.name, input: call.args, output: out.summary, ms: now() - t1, ok: out.ok });
          results.push({ id: call.id, name: call.name, content: out.content, isError: !out.ok });
        }
      }
      if (finished) return finished;
      messages.push({ role: 'tool_results', results });
    }
    return fallback('max iterations', `Stopped: the model did not finish within ${limits.maxIterations} turns.`);
  } catch (e) {
    const kind = e instanceof ProviderError ? e.kind : 'unexpected';
    const msg = e instanceof Error ? e.message : String(e);
    const visitorNote: Record<string, string> = {
      auth: 'The model provider rejected the API key.',
      rate_limit: 'The model provider is rate limiting requests.',
      server: 'The model provider had a server error.',
      timeout: 'The model took too long.',
    };
    return fallback(`${kind}: ${msg}`, `${visitorNote[kind] ?? 'The model call failed.'} Showing the deterministic coach instead.`);
  } finally {
    clearTimeout(timer);
  }
}

type SubmitOutcome = { done: true; summary: string; items: CoachingItem[]; dropped: number } | { done: false; errors: ValidationError[] };

function handleSubmit(call: ToolCall, ctx: ToolContext, repairUsed: boolean, add: (s: Omit<TraceStep, 'step'>) => void): SubmitOutcome {
  const args = (call.args && typeof call.args === 'object' ? call.args : {}) as { summary?: unknown; items?: unknown };
  const { valid, errors } = validateItems(args.items, ctx.analysis.sentences);
  const submitted = Array.isArray(args.items) ? args.items.length : 0;
  add({
    kind: 'validator',
    name: SUBMIT_TOOL,
    input: { items: submitted },
    output: errors.length ? `${valid.length} of ${submitted} items valid; ${errors.map((e) => `item ${e.item}: ${e.code}`).join('; ')}` : `${valid.length} of ${submitted} items valid`,
    ms: 0,
    ok: errors.length === 0 && valid.length > 0,
  });
  const summary = typeof args.summary === 'string' ? args.summary.trim().slice(0, 600) : '';
  if ((errors.length || !valid.length) && !repairUsed) return { done: false, errors: errors.length ? errors : [{ item: 0, code: 'missing_field', message: 'items must contain at least one item.' }] };
  return { done: true, summary, items: valid, dropped: Math.max(0, Math.min(submitted, MAX_ITEMS) - valid.length) };
}

/** Fill up to MAX_ITEMS with deterministic items on sentences the model did not use. Labeled by source. */
export function backfill(items: CoachingItem[], ctx: ToolContext): CoachingItem[] {
  if (items.length >= MAX_ITEMS) return items;
  const used = new Set(items.map((i) => i.sentenceIndex));
  const extra = deterministicCoach(ctx.analysis, ctx.goal, MAX_ITEMS + items.length).filter((d) => !used.has(d.sentenceIndex));
  return [...items, ...extra].slice(0, MAX_ITEMS).map((it, i) => ({ ...it, rank: i + 1 }));
}
