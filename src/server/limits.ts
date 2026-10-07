/** Fixed-window per-key rate limiter, in memory. Good enough for one free-tier instance. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Returns seconds to wait, or 0 if the request is allowed (and counted). */
  take(key: string): number {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
    }
    if (entry.count >= this.limit) return Math.ceil((entry.resetAt - t) / 1000);
    entry.count++;
    if (this.hits.size > 10_000) this.sweep(t);
    return 0;
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}

/** A global counter that resets at midnight UTC. Caps model calls per day. */
export class DailyCap {
  private day = '';
  private used = 0;
  constructor(
    private limit: number,
    private now: () => number = Date.now,
  ) {}

  private roll() {
    const d = new Date(this.now()).toISOString().slice(0, 10);
    if (d !== this.day) {
      this.day = d;
      this.used = 0;
    }
  }

  take(): boolean {
    this.roll();
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }

  remaining(): number {
    this.roll();
    return Math.max(0, this.limit - this.used);
  }
}
