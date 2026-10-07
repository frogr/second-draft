import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';
import { DailyCap, RateLimiter } from '../src/server/limits.js';

const post = (app: ReturnType<typeof createApp>, body: unknown, ip = '1.1.1.1') =>
  app.request('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) });

const quiet = { log: () => {} };

describe('server', () => {
  it('reports health and config without a key', async () => {
    const app = createApp({ env: {}, ...quiet });
    expect(await (await app.request('/health')).json()).toEqual({ ok: true, model: 'none' });
    const cfg = await (await app.request('/api/config')).json();
    expect(cfg.llm).toEqual({ available: false });
    expect(cfg.goals).toHaveLength(5);
  });

  it('coaches deterministically with no key', async () => {
    const app = createApp({ env: {}, ...quiet });
    const res = await post(app, { draft: 'It was a dark and stormy night. She was very angry.', goal: 'vivid' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe('deterministic');
    expect(json.items.length).toBeGreaterThan(0);
  });

  it('validates input size and shape', async () => {
    const app = createApp({ env: {}, ...quiet });
    expect((await post(app, { draft: '' })).status).toBe(400);
    expect((await post(app, 'not json')).status).toBe(400);
    expect((await post(app, { draft: 'word '.repeat(3001) })).status).toBe(413);
    expect((await post(app, { draft: 'ok.', previousDraft: 42 })).status).toBe(400);
    expect((await post(app, { draft: 'x'.repeat(200_000) })).status).toBe(413);
  });

  it('rate limits per IP when behind a trusted proxy', async () => {
    const app = createApp({ env: { RATE_LIMIT_PER_MIN: '2', TRUST_PROXY: '1' }, ...quiet });
    expect((await post(app, { draft: 'One.' }, '9.9.9.9')).status).toBe(200);
    expect((await post(app, { draft: 'One.' }, '9.9.9.9')).status).toBe(200);
    const third = await post(app, { draft: 'One.' }, '9.9.9.9');
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBeTruthy();
    expect((await post(app, { draft: 'One.' }, '8.8.8.8')).status).toBe(200);
  });

  it('stops calling the model when the daily cap is reached', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', id: 'a', name: 'submit_coaching', input: { summary: 's', items: [{ sentence_index: 0, quote: 'She was angry.', rewrite: 'She kicked the bin.', title: 't', why: 'w', exercise: 'e', detector: 'show_tell' }] } }], usage: { input_tokens: 1, output_tokens: 1 } }));
    }) as unknown as typeof fetch;
    const app = createApp({ env: { ANTHROPIC_API_KEY: 'k', DAILY_LLM_LIMIT: '1', TRUST_PROXY: '1' }, fetchImpl, ...quiet });
    const first = await (await post(app, { draft: 'She was angry.' }, '2.2.2.2')).json();
    expect(first.mode).toBe('anthropic');
    const second = await (await post(app, { draft: 'She was angry.' }, '3.3.3.3')).json();
    expect(second.mode).toBe('deterministic');
    expect(second.notes.join(' ')).toMatch(/daily model limit/);
    expect(calls).toBe(1);
    const off = await (await post(app, { draft: 'She was angry.', useModel: false }, '4.4.4.4')).json();
    expect(off.mode).toBe('deterministic');
  });

  it('never shows stack traces to visitors', async () => {
    const logs: string[] = [];
    const app = createApp({ env: {}, log: (m) => logs.push(m) });
    app.get('/boom', () => {
      throw new Error('secret internals');
    });
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    expect(await res.text()).not.toMatch(/secret internals/);
    expect(logs.join('\n')).toMatch(/secret internals/);
  });
});

describe('limits', () => {
  it('RateLimiter resets after the window', () => {
    let t = 0;
    const rl = new RateLimiter(1, 1000, () => t);
    expect(rl.take('a')).toBe(0);
    expect(rl.take('a')).toBe(1);
    t = 1000;
    expect(rl.take('a')).toBe(0);
  });
  it('DailyCap resets at midnight UTC', () => {
    let t = Date.parse('2026-10-07T23:59:00Z');
    const cap = new DailyCap(1, () => t);
    expect(cap.take()).toBe(true);
    expect(cap.take()).toBe(false);
    t = Date.parse('2026-10-08T00:00:01Z');
    expect(cap.remaining()).toBe(1);
  });
});
