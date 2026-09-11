export interface TokenBucketOptions {
  ratePerSecond: number;
  burst: number;
  now: () => number;
}

export class TokenBucket {
  private readonly ratePerMillisecond: number;
  private readonly burst: number;
  private readonly now: () => number;
  private tokens: number;
  private lastRefillAt: number;

  constructor(options: TokenBucketOptions) {
    if (options.ratePerSecond <= 0 || options.burst <= 0) {
      throw new RangeError("Token bucket rate and burst must be positive");
    }

    this.ratePerMillisecond = options.ratePerSecond / 1_000;
    this.burst = options.burst;
    this.now = options.now;
    this.tokens = options.burst;
    this.lastRefillAt = options.now();
  }

  consume(): boolean {
    this.refill();
    if (this.tokens < 1) {
      return false;
    }

    this.tokens -= 1;
    return true;
  }

  private refill(): void {
    const currentTime = this.now();
    const elapsed = currentTime - this.lastRefillAt;
    if (elapsed <= 0) {
      return;
    }

    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.ratePerMillisecond);
    this.lastRefillAt = currentTime;
  }
}
