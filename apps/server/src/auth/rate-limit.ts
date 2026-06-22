type LoginAttemptBucket = {
  failures: number;
  resetAt: number;
};

export type OAuthRouteRateLimitInput = {
  ipAddress: string | null;
  mode?: "login" | "link";
  provider: string;
  route: "start" | "callback";
};

export class LoginRateLimiter {
  readonly maxFailures: number;
  readonly windowMs: number;
  readonly attempts = new Map<string, LoginAttemptBucket>();

  constructor(maxFailures = 5, windowMs = 15 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    const bucket = this.getActiveBucket(key, now);

    return bucket !== null && bucket.failures >= this.maxFailures;
  }

  recordFailure(key: string, now = Date.now()): void {
    const bucket = this.getActiveBucket(key, now) ?? {
      failures: 0,
      resetAt: now + this.windowMs,
    };

    bucket.failures += 1;
    this.attempts.set(key, bucket);
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }

  private getActiveBucket(key: string, now: number): LoginAttemptBucket | null {
    const bucket = this.attempts.get(key);

    if (!bucket) {
      return null;
    }

    if (bucket.resetAt <= now) {
      this.attempts.delete(key);
      return null;
    }

    return bucket;
  }
}

export function createOAuthRouteRateLimitKey(input: OAuthRouteRateLimitInput): string {
  return [
    "oauth",
    input.route,
    input.provider,
    input.mode ?? "none",
    input.ipAddress?.trim() || "unknown",
  ].join(":");
}
