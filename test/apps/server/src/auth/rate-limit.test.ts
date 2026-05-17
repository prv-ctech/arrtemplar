import { describe, expect, it } from "bun:test";
import { LoginRateLimiter } from "../../../../../apps/server/src/auth/rate-limit";

describe("LoginRateLimiter", () => {
  it("tracks lockout independently per email and IP key", () => {
    const limiter = new LoginRateLimiter(2, 60_000);
    const now = Date.now();

    limiter.recordFailure("127.0.0.1:admin@example.local", now);
    limiter.recordFailure("127.0.0.1:admin@example.local", now + 1);
    limiter.recordFailure("127.0.0.1:viewer@example.local", now + 2);
    limiter.recordFailure("192.0.2.10:admin@example.local", now + 3);

    expect(limiter.isBlocked("127.0.0.1:admin@example.local", now + 4)).toBe(true);
    expect(limiter.isBlocked("127.0.0.1:viewer@example.local", now + 4)).toBe(false);
    expect(limiter.isBlocked("192.0.2.10:admin@example.local", now + 4)).toBe(false);
  });

  it("resets a lockout after the configured window", () => {
    const limiter = new LoginRateLimiter(2, 1_000);
    const now = Date.now();
    const key = "127.0.0.1:admin@example.local";

    limiter.recordFailure(key, now);
    limiter.recordFailure(key, now + 500);

    expect(limiter.isBlocked(key, now + 999)).toBe(true);
    expect(limiter.isBlocked(key, now + 1_001)).toBe(false);
    expect(limiter.attempts.has(key)).toBe(false);
  });

  it("clears failures after a successful login", () => {
    const limiter = new LoginRateLimiter(1, 60_000);
    const key = "127.0.0.1:admin@example.local";

    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);

    limiter.clear(key);

    expect(limiter.isBlocked(key)).toBe(false);
  });
});
