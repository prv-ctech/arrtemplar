import { describe, expect, it } from "bun:test";
import { getLandingPathForUser } from "../../../../../../apps/web/src/features/auth/auth-navigation";
import type { PublicUser } from "../../../../../../packages/shared/src";

const baseUser = {
  id: "user-1",
  username: "operator",
  email: "operator@example.local",
  permissions: [],
  createdAt: "2026-05-15T00:00:00.000Z",
  lastLoginAt: null,
} satisfies PublicUser;

describe("getLandingPathForUser", () => {
  it("keeps the shared app dashboard as the role-free landing path", () => {
    expect(getLandingPathForUser(baseUser)).toBe("/dashboard");
  });
});
