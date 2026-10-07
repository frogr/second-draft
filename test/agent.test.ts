import { describe, expect, it } from 'vitest';
import { runAgent } from '../src/coach/agent.js';
import { coach } from '../src/coach/index.js';
import { anthropicProvider } from '../src/coach/providers/anthropic.js';
import { openaiProvider } from '../src/coach/providers/openai.js';
import { makeToolContext } from '../src/coach/tools.js';

const DRAFT = 'It was a dark and stormy night. She was very angry. The door was locked by Tom.';
const LIMITS = { maxIterations: 6, tokenBudget: 50_000, timeoutMs: 5_000, maxTokensPerTurn: 1000 };

type Call = { url: string; headers: Record<string, string>; body: any };

/** A fetch that replays scripted responses and records every request. */
function scripted(responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> } | 'hang'>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    const next = responses.shift();
    if (!next) throw new Error('no more scripted responses');
    if (next === 'hang') {
      return new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status ?? 200, headers: next.headers });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const usage = { input_tokens: 500, output_tokens: 80 };
const toolUse = (id: string, name: string, input: unknown) => ({ body: { content: [{ type: 'tool_use', id, name, input }], usage, stop_reason: 'tool_use' } });
const item = (over: Record<string, unknown> = {}) => ({
  sentence_index: 1,
  quote: 'She was very angry.',
  rewrite: 'She threw the keys at the bowl and missed.',
  title: 'Show the anger',
  why: 'Naming the feeling tells the reader what to think.',
  exercise: 'Write it three ways without the word angry.',
  detector: 'show_tell',
  ...over,
});

describe('Anthropic tool-use loop (mocked HTTP)', () => {
  it('calls tools, repairs one bad citation, and returns anchored items', async () => {
    const bad = item({ sentence_index: 0, quote: 'It was a dark, stormy night.', rewrite: 'Rain hammered the tin roof.', detector: 'cliche', title: 'Lose the cliche' });
    const fixed = item({ sentence_index: 0, quote: 'It was a dark and stormy night.', rewrite: 'Rain hammered the tin roof.', detector: 'cliche', title: 'Lose the cliche' });
    const { impl, calls } = scripted([
      { body: { content: [{ type: 'text', text: 'Measuring first.' }, { type: 'tool_use', id: 'tu_1', name: 'analyze_draft', input: {} }], usage, stop_reason: 'tool_use' } },
      toolUse('tu_2', 'get_sentences', { start: 0, end: 2 }),
      toolUse('tu_3', 'submit_coaching', { summary: 'Strong bones, stock phrases.', items: [item(), bad] }),
      toolUse('tu_4', 'submit_coaching', { summary: 'Strong bones, stock phrases.', items: [item(), fixed] }),
    ]);
    const provider = anthropicProvider('test-key', undefined, impl);
    const result = await coach({ draft: DRAFT, goal: 'vivid', provider, limits: LIMITS });

    expect(result.mode).toBe('anthropic');
    expect(result.model).toBe('claude-haiku-4-5');
    expect(result.summary).toBe('Strong bones, stock phrases.');
    expect(result.items).toHaveLength(3);
    expect(result.items.slice(0, 2).map((i) => i.source)).toEqual(['model', 'model']);
    expect(result.items[2]!.source).toBe('deterministic');
    for (const i of result.items) expect(DRAFT.slice(i.start, i.end)).toBe(i.before);
    expect(result.trace.map((t) => `${t.kind}:${t.name}`)).toEqual([
      'model:claude-haiku-4-5',
      'tool:analyze_draft',
      'model:claude-haiku-4-5',
      'tool:get_sentences',
      'model:claude-haiku-4-5',
      'validator:submit_coaching',
      'model:claude-haiku-4-5',
      'validator:submit_coaching',
    ]);
    expect(result.trace[5]!.ok).toBe(false);
    expect(result.usage).toEqual({ inputTokens: 2000, outputTokens: 320 });

    // request shape
    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0]!.headers['x-api-key']).toBe('test-key');
    expect(calls[0]!.headers['anthropic-version']).toBe('2023-06-01');
    expect(calls[0]!.body.model).toBe('claude-haiku-4-5');
    expect(calls[0]!.body.tools.map((t: { name: string }) => t.name)).toContain('submit_coaching');
    expect(calls[0]!.body.tools[0].input_schema.type).toBe('object');
    const second = calls[1]!.body.messages;
    expect(second[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'Measuring first.' }, { type: 'tool_use', id: 'tu_1', name: 'analyze_draft', input: {} }] });
    expect(second[2].content[0].type).toBe('tool_result');
    expect(second[2].content[0].tool_use_id).toBe('tu_1');
    const repair = calls[3]!.body.messages.at(-1).content[0];
    expect(repair.is_error).toBe(true);
    expect(repair.content).toMatch(/quote_not_in_sentence/);
  });

  it('drops items that are still invalid after the one repair turn', async () => {
    const bad = item({ quote: 'She was really angry.' });
    const { impl } = scripted([toolUse('a', 'submit_coaching', { summary: 's', items: [bad] }), toolUse('b', 'submit_coaching', { summary: 's', items: [bad] })]);
    const ctx = makeToolContext(DRAFT, 'vivid');
    const out = await runAgent(anthropicProvider('k', undefined, impl), ctx, LIMITS);
    expect(out.status).toBe('submitted');
    expect(out.items).toEqual([]);
    expect(out.notes.join(' ')).toMatch(/1 model item failed validation/);
  });

  it('nudges a model that answers in prose, then accepts the submission', async () => {
    const { impl, calls } = scripted([{ body: { content: [{ type: 'text', text: 'Here are my thoughts...' }], usage, stop_reason: 'end_turn' } }, toolUse('a', 'submit_coaching', { summary: 's', items: [item()] })]);
    const out = await runAgent(anthropicProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), LIMITS);
    expect(out.status).toBe('submitted');
    expect(calls[1]!.body.messages.at(-1)).toEqual({ role: 'user', content: 'Please finish by calling submit_coaching.' });
  });

  it('stops at max iterations', async () => {
    const { impl, calls } = scripted(Array.from({ length: 10 }, (_, i) => toolUse(`x${i}`, 'analyze_draft', {})));
    const out = await runAgent(anthropicProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), { ...LIMITS, maxIterations: 3 });
    expect(out.status).toBe('fallback');
    expect(out.failure).toBe('max iterations');
    expect(calls).toHaveLength(3);
  });

  it('stops when the token budget is spent', async () => {
    const big = { content: [{ type: 'tool_use', id: 'a', name: 'analyze_draft', input: {} }], usage: { input_tokens: 40_000, output_tokens: 20_000 } };
    const { impl, calls } = scripted([{ body: big }, { body: big }]);
    const out = await runAgent(anthropicProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), LIMITS);
    expect(out.failure).toBe('token budget');
    expect(calls).toHaveLength(1);
  });

  it('times out a hung request', async () => {
    const { impl } = scripted(['hang']);
    const out = await runAgent(anthropicProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), { ...LIMITS, timeoutMs: 50 });
    expect(out.status).toBe('fallback');
    expect(out.failure).toMatch(/^timeout/);
  });

  it('does not retry a 401 and falls back to the deterministic coach', async () => {
    const { impl, calls } = scripted([{ status: 401, body: { error: { message: 'invalid x-api-key' } } }]);
    const result = await coach({ draft: DRAFT, goal: 'vivid', provider: anthropicProvider('bad', undefined, impl), limits: LIMITS });
    expect(calls).toHaveLength(1);
    expect(result.mode).toBe('deterministic');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.notes.join(' ')).toMatch(/rejected the API key/);
    expect(JSON.stringify(result)).not.toMatch(/invalid x-api-key/);
  });

  it('retries a 429 once, honoring retry-after', async () => {
    const { impl, calls } = scripted([{ status: 429, headers: { 'retry-after': '0' } }, toolUse('a', 'submit_coaching', { summary: 's', items: [item()] })]);
    const out = await runAgent(anthropicProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), LIMITS);
    expect(out.status).toBe('submitted');
    expect(calls).toHaveLength(2);
  });

  it('falls back after a repeated 5xx', async () => {
    const { impl, calls } = scripted([{ status: 529 }, { status: 529 }]);
    const out = await runAgent(anthropicProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), LIMITS);
    expect(out.failure).toMatch(/^server/);
    expect(calls).toHaveLength(2);
  });
});

describe('OpenAI function-calling loop (mocked HTTP)', () => {
  const oa = (id: string, name: string, args: unknown) => ({
    body: { choices: [{ message: { content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 400, completion_tokens: 60 } },
  });

  it('runs the same loop with chat completions shapes', async () => {
    const { impl, calls } = scripted([oa('c1', 'get_findings', { detector: 'cliche' }), oa('c2', 'submit_coaching', { summary: 'ok', items: [item()] })]);
    const result = await coach({ draft: DRAFT, goal: 'vivid', provider: openaiProvider('sk-test', undefined, impl), limits: LIMITS });
    expect(result.mode).toBe('openai');
    expect(result.items[0]!.source).toBe('model');
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(calls[0]!.headers.authorization).toBe('Bearer sk-test');
    const submit = calls[0]!.body.tools.find((t: any) => t.function.name === 'submit_coaching');
    expect(submit.function.strict).toBe(true);
    expect(JSON.stringify(submit.function.parameters)).not.toMatch(/maxItems/);
    const msgs = calls[1]!.body.messages;
    expect(msgs[0].role).toBe('system');
    expect(msgs[2].tool_calls[0].function.name).toBe('get_findings');
    expect(msgs[3]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(JSON.parse(msgs[3].content).findings.length).toBeGreaterThan(0);
  });

  it('survives unparseable arguments through validation and repair', async () => {
    const broken = { body: { choices: [{ message: { content: null, tool_calls: [{ id: 'z', type: 'function', function: { name: 'submit_coaching', arguments: '{"items": [' } }] } }] } };
    const { impl } = scripted([broken, oa('y', 'submit_coaching', { summary: 'ok', items: [item()] })]);
    const out = await runAgent(openaiProvider('k', undefined, impl), makeToolContext(DRAFT, 'vivid'), LIMITS);
    expect(out.status).toBe('submitted');
    expect(out.items).toHaveLength(1);
  });
});

describe('read-only tools', () => {
  it('compare_drafts reports changes only when a previous draft exists', async () => {
    const { runTool } = await import('../src/coach/tools.js');
    const none = runTool(makeToolContext(DRAFT, 'vivid'), 'compare_drafts', { a: 'previous', b: 'current' });
    expect(none.ok).toBe(false);
    const ctx = makeToolContext('Rain on tin. She threw the keys.', 'vivid', DRAFT);
    const out = runTool(ctx, 'compare_drafts', { a: 'previous', b: 'current' });
    expect(out.ok).toBe(true);
    expect(JSON.parse(out.content).changes.find((c: { key: string }) => c.key === 'per100.cliche').verdict).toBe('better');
  });

  it('get_sentences caps the range and rejects bad input', async () => {
    const { runTool } = await import('../src/coach/tools.js');
    const ctx = makeToolContext(DRAFT, 'vivid');
    expect(JSON.parse(runTool(ctx, 'get_sentences', { start: 1, end: 99 }).content).sentences.map((s: { index: number }) => s.index)).toEqual([1, 2]);
    expect(runTool(ctx, 'get_sentences', { start: 5, end: 6 }).ok).toBe(false);
    expect(runTool(ctx, 'nope', {}).ok).toBe(false);
  });
});
