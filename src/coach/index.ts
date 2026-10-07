import { compareMetrics } from '../core/compare.js';
import { backfill, DEFAULT_LIMITS, runAgent, type AgentLimits } from './agent.js';
import { deterministicCoach, deterministicSummary } from './deterministic.js';
import { anthropicProvider, ANTHROPIC_DEFAULT_MODEL } from './providers/anthropic.js';
import type { FetchLike } from './providers/http.js';
import { openaiProvider, OPENAI_DEFAULT_MODEL } from './providers/openai.js';
import type { Provider } from './providers/types.js';
import { makeToolContext } from './tools.js';
import type { CoachResult, Goal, TraceStep } from './types.js';
import { assertAnchored } from './validate.js';

export interface CoachEnv {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_MODEL?: string;
  /** "anthropic" or "openai" when both keys are set */
  LLM_PROVIDER?: string;
}

/** Which live provider is configured, if any. Anthropic wins when both keys exist, unless LLM_PROVIDER says otherwise. */
export function pickProvider(env: CoachEnv, fetchImpl?: FetchLike): Provider | null {
  const prefer = env.LLM_PROVIDER?.toLowerCase();
  const anthropic = env.ANTHROPIC_API_KEY ? anthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL, fetchImpl) : null;
  const openai = env.OPENAI_API_KEY ? openaiProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL, fetchImpl) : null;
  if (prefer === 'openai' && openai) return openai;
  return anthropic ?? openai;
}

export interface CoachRequest {
  draft: string;
  goal: Goal;
  previousDraft?: string;
  /** a provider to use; null means deterministic only */
  provider: Provider | null;
  limits?: AgentLimits;
  /** extra notes from the caller, e.g. "daily model limit reached" */
  notes?: string[];
  log?: (msg: string) => void;
}

function deterministicTrace(ctx: ReturnType<typeof makeToolContext>): TraceStep[] {
  const steps: TraceStep[] = [
    { step: 1, kind: 'tool', name: 'analyze_draft', output: `${ctx.analysis.findings.length} findings from 11 detectors`, ms: 0, ok: true },
    { step: 2, kind: 'tool', name: 'rank_by_leverage', input: { goal: ctx.goal }, output: 'grouped findings by sentence and ranked them by the leverage formula', ms: 0, ok: true },
  ];
  if (ctx.previous) steps.push({ step: 3, kind: 'tool', name: 'compare_drafts', input: { a: 'previous', b: 'current' }, output: 'compared metrics with the previous draft', ms: 0, ok: true });
  return steps;
}

export async function coach(req: CoachRequest): Promise<CoachResult> {
  const ctx = makeToolContext(req.draft, req.goal, req.previousDraft);
  const comparison = ctx.previous ? compareMetrics(ctx.previous.analysis.metrics, ctx.analysis.metrics) : undefined;
  const notes = [...(req.notes ?? [])];
  const deterministic = (): CoachResult => {
    const items = deterministicCoach(ctx.analysis, req.goal);
    return { mode: 'deterministic', goal: req.goal, summary: deterministicSummary(ctx.analysis, req.goal, items), items, analysis: ctx.analysis, ...(comparison ? { comparison } : {}), trace: deterministicTrace(ctx), notes };
  };
  if (!req.provider || !ctx.analysis.sentences.length) return deterministic();

  const outcome = await runAgent(req.provider, ctx, req.limits ?? DEFAULT_LIMITS);
  if (outcome.status === 'fallback') {
    req.log?.(`agent fallback: ${outcome.failure}`);
    const d = deterministic();
    return { ...d, trace: [...outcome.trace, ...d.trace.map((s, i) => ({ ...s, step: outcome.trace.length + i + 1 }))], notes: [...notes, ...outcome.notes], usage: outcome.usage };
  }
  const items = backfill(outcome.items, ctx);
  if (items.some((i) => i.source === 'deterministic')) notes.push('Some items come from the deterministic coach because the model returned fewer than three valid ones.');
  if (!assertAnchored(req.draft, items)) throw new Error('coaching item not anchored to the draft');
  return {
    mode: req.provider.name,
    model: req.provider.model,
    goal: req.goal,
    summary: outcome.summary || deterministicSummary(ctx.analysis, req.goal, items),
    items,
    analysis: ctx.analysis,
    ...(comparison ? { comparison } : {}),
    trace: outcome.trace,
    notes: [...notes, ...outcome.notes],
    usage: outcome.usage,
  };
}
