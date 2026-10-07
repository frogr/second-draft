import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { coach, pickProvider, type CoachEnv } from '../coach/index.js';
import type { FetchLike } from '../coach/providers/http.js';
import { GOAL_LABELS, GOALS, type Goal } from '../coach/types.js';
import { countWords } from '../core/text.js';
import { DailyCap, RateLimiter } from './limits.js';

export const MAX_WORDS = 3000;
export const MAX_CHARS = 24_000;

export interface AppConfig extends CoachEnv {
  DAILY_LLM_LIMIT?: string;
  RATE_LIMIT_PER_MIN?: string;
  LLM_PER_IP_PER_HOUR?: string;
  TRUST_PROXY?: string;
}

export interface AppDeps {
  env: AppConfig;
  fetchImpl?: FetchLike;
  now?: () => number;
  log?: (msg: string) => void;
  /** remote address of the socket, injected by the node adapter */
  remoteAddr?: (c: unknown) => string | undefined;
}

const int = (v: string | undefined, d: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export function createApp(deps: AppDeps) {
  const { env } = deps;
  const log = deps.log ?? ((m: string) => console.error(m));
  const provider = pickProvider(env, deps.fetchImpl);
  const requests = new RateLimiter(int(env.RATE_LIMIT_PER_MIN, 20), 60_000, deps.now);
  const llmPerIp = new RateLimiter(int(env.LLM_PER_IP_PER_HOUR, 10), 3_600_000, deps.now);
  const daily = new DailyCap(int(env.DAILY_LLM_LIMIT, 200), deps.now);

  const app = new Hono();
  app.use('*', secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'self'"], styleSrc: ["'self'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } }));

  const clientIp = (c: Context) => {
    if (env.TRUST_PROXY === '1') {
      const fwd = c.req.header('x-forwarded-for');
      if (fwd) return fwd.split(',')[0]!.trim();
    }
    return deps.remoteAddr?.(c) ?? 'unknown';
  };

  app.get('/health', (c) => c.json({ ok: true, model: provider ? `${provider.name}:${provider.model}` : 'none' }));

  app.get('/api/config', (c) =>
    c.json({
      llm: provider ? { available: true, provider: provider.name, model: provider.model, remainingToday: daily.remaining() } : { available: false },
      maxWords: MAX_WORDS,
      goals: GOALS.map((g) => ({ id: g, label: GOAL_LABELS[g] })),
    }),
  );

  app.post(
    '/api/coach',
    bodyLimit({ maxSize: 128 * 1024, onError: (c) => c.json({ error: 'Request too large.' }, 413) }),
    async (c) => {
      const ip = clientIp(c);
      const wait = requests.take(ip);
      if (wait) {
        c.header('retry-after', String(wait));
        return c.json({ error: `Too many requests. Try again in ${wait} seconds.` }, 429);
      }
      let body: Record<string, unknown>;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'Send JSON with a "draft" field.' }, 400);
      }
      const draft = body.draft;
      if (typeof draft !== 'string' || !draft.trim()) return c.json({ error: 'The draft is empty.' }, 400);
      if (draft.length > MAX_CHARS || countWords(draft) > MAX_WORDS) return c.json({ error: `Drafts are limited to ${MAX_WORDS.toLocaleString('en-US')} words.` }, 413);
      const prev = body.previousDraft;
      if (prev !== undefined && prev !== null && (typeof prev !== 'string' || prev.length > MAX_CHARS)) return c.json({ error: 'previousDraft must be a string under the size limit.' }, 400);
      const goal = (GOALS as readonly string[]).includes(body.goal as string) ? (body.goal as Goal) : 'balanced';
      const wantsModel = body.useModel !== false;

      const notes: string[] = [];
      let useProvider = null as typeof provider;
      if (provider && wantsModel) {
        if (llmPerIp.take(ip)) notes.push('You have used your model requests for this hour, so this is the deterministic coach.');
        else if (!daily.take()) notes.push('The daily model limit for this demo is used up, so this is the deterministic coach.');
        else useProvider = provider;
      }
      const result = await coach({ draft, goal, previousDraft: typeof prev === 'string' ? prev : undefined, provider: useProvider, notes, log });
      return c.json(result);
    },
  );

  app.onError((err, c) => {
    log(`unhandled error on ${c.req.path}: ${err.stack ?? err.message}`);
    return c.json({ error: 'Something went wrong on our side. Try again.' }, 500);
  });

  return app;
}
