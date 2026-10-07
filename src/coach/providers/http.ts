import { ProviderError } from './types.js';

export type FetchLike = typeof fetch;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new ProviderError('timeout', 'aborted while waiting to retry'));
    });
  });

/**
 * POST JSON with one retry on 429 and 5xx. 401/403 and other 4xx fail at once.
 * Error messages include the status and a short body snippet, for server logs only.
 */
export async function postJson(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal, fetchImpl: FetchLike = fetch, retries = 1): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
    } catch (e) {
      if (signal.aborted) throw new ProviderError('timeout', 'request timed out');
      throw new ProviderError('network', `network error: ${(e as Error).message}`);
    }
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        throw new ProviderError('bad_response', 'response was not JSON', res.status);
      }
    }
    const snippet = (await res.text().catch(() => '')).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new ProviderError('auth', `auth failed (${res.status}): ${snippet}`, res.status);
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      const after = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 5000) : 800 * (attempt + 1), signal);
      continue;
    }
    if (res.status === 429) throw new ProviderError('rate_limit', `rate limited: ${snippet}`, 429);
    if (res.status >= 500) throw new ProviderError('server', `server error ${res.status}: ${snippet}`, res.status);
    throw new ProviderError('bad_request', `request rejected ${res.status}: ${snippet}`, res.status);
  }
}
