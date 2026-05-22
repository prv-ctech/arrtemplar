import { describe, expect, it } from "bun:test";
import { getLandingPathForUser } from "../../../../../../apps/web/src/features/auth/auth-navigation";
import type { PublicUser } from "../../../../../../packages/shared/src";

const baseUser = {
  id: "user-1",
  username: "operator",
  email: "operator@example.local",
  createdAt: "2026-05-15T00:00:00.000Z",
  lastLoginAt: null,
} satisfies Omit<PublicUser, "role">;

describe("getLandingPathForUser", () => {
  it("sends admins to the shared app dashboard", () => {
    expect(getLandingPathForUser({ ...baseUser, role: "admin" })).toBe("/app/dashboard");
  });

  it("sends normal users to the shared app dashboard", () => {
    expect(getLandingPathForUser({ ...baseUser, role: "user" })).toBe("/app/dashboard");
  });
});
