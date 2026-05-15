import { describe, expect, it } from "bun:test";
import type { PublicUser } from "@arrweeb-anime/shared";
import { getLandingPathForUser } from "./auth-navigation";

const baseUser = {
  id: "user-1",
  username: "operator",
  email: "operator@example.local",
  createdAt: "2026-05-15T00:00:00.000Z",
  lastLoginAt: null,
} satisfies Omit<PublicUser, "role">;

describe("getLandingPathForUser", () => {
  it("sends admins to the admin shell", () => {
    expect(getLandingPathForUser({ ...baseUser, role: "admin" })).toBe("/admin");
  });

  it("sends normal users to the user dashboard", () => {
    expect(getLandingPathForUser({ ...baseUser, role: "user" })).toBe("/dashboard");
  });
});
