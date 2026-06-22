import { describe, expect, it } from "bun:test";
import {
  createOAuthRouteRateLimitKey,
  LoginRateLimiter,
} from "../../../../../apps/server/src/auth/rate-limit";

describe("LoginRateLimiter", () => {
  it("tracks lockout independently per account key", () => {
    const limiter = new LoginRateLimiter(2, 60_000);
    const now = Date.now();

    limiter.recordFailure("admin@example.local", now);
    limiter.recordFailure("admin@example.local", now + 1);
    limiter.recordFailure("viewer@example.local", now + 2);

    expect(limiter.isBlocked("admin@example.local", now + 4)).toBe(true);
    expect(limiter.isBlocked("viewer@example.local", now + 4)).toBe(false);
  });

  it("resets a lockout after the configured window", () => {
    const limiter = new LoginRateLimiter(2, 1_000);
    const now = Date.now();
    const key = "admin@example.local";

    limiter.recordFailure(key, now);
    limiter.recordFailure(key, now + 500);

    expect(limiter.isBlocked(key, now + 999)).toBe(true);
    expect(limiter.isBlocked(key, now + 1_001)).toBe(false);
    expect(limiter.attempts.has(key)).toBe(false);
  });

  it("clears failures after a successful login", () => {
    const limiter = new LoginRateLimiter(1, 60_000);
    const key = "admin@example.local";

    limiter.recordFailure(key);
    expect(limiter.isBlocked(key)).toBe(true);

    limiter.clear(key);

    expect(limiter.isBlocked(key)).toBe(false);
  });

  it("partitions OAuth route keys by IP, route, provider, and mode", () => {
    const baseKey = createOAuthRouteRateLimitKey({
      ipAddress: "198.51.100.10",
      provider: "authentik",
      route: "start",
      mode: "login",
    });

    expect(
      createOAuthRouteRateLimitKey({
        ipAddress: "198.51.100.11",
        provider: "authentik",
        route: "start",
        mode: "login",
      }),
    ).not.toBe(baseKey);
    expect(
      createOAuthRouteRateLimitKey({
        ipAddress: "198.51.100.10",
        provider: "authentik",
        route: "callback",
        mode: "login",
      }),
    ).not.toBe(baseKey);
    expect(
      createOAuthRouteRateLimitKey({
        ipAddress: "198.51.100.10",
        provider: "authentik",
        route: "start",
        mode: "link",
      }),
    ).not.toBe(baseKey);
  });
});
