import { RequestBudgetExceededError } from './errors.ts';

export interface RateLimiterOptions {
  /** Max requests started per second (evenly spaced). Default 10. */
  requestsPerSecond?: number;
  /** Hard cap on total requests for the lifetime of the limiter. Default: unlimited. */
  maxRequests?: number;
  /** Injected for tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Spaces request starts at >= 1000/rps ms apart (so any 1-second window holds at
 * most `rps` starts) and enforces a total request budget. Slots are reserved
 * synchronously, so concurrent callers are serialised fairly in call order.
 */
export class RateLimiter {
  readonly intervalMs: number;
  readonly maxRequests: number;
  #nextSlot = 0;
  #issued = 0;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(opts: RateLimiterOptions = {}) {
    const rps = opts.requestsPerSecond ?? 10;
    if (!(rps > 0)) throw new RangeError('requestsPerSecond must be > 0');
    this.intervalMs = 1000 / rps;
    this.maxRequests = opts.maxRequests ?? Number.POSITIVE_INFINITY;
    this.#now = opts.now ?? Date.now;
    this.#sleep = opts.sleep ?? defaultSleep;
  }

  /** Number of requests issued (slots granted) so far. */
  get issued(): number { return this.#issued; }
  get remaining(): number { return this.maxRequests - this.#issued; }

  /** Waits for the next slot. Throws if the budget is exhausted. */
  async acquire(): Promise<void> {
    if (this.#issued >= this.maxRequests) throw new RequestBudgetExceededError(this.maxRequests);
    this.#issued++;
    const now = this.#now();
    const slot = Math.max(now, this.#nextSlot);
    this.#nextSlot = slot + this.intervalMs;
    const wait = slot - now;
    if (wait > 0) await this.#sleep(wait);
  }
}
