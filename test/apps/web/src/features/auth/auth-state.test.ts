import { describe, expect, it } from "bun:test";

const authStateSourcePath = `${Bun.env.PWD ?? "."}/apps/web/src/features/auth/auth-state.ts`;

describe("useAuthSetupQuery", () => {
  it("always refreshes setup status when the login form mounts", async () => {
    const source = await Bun.file(authStateSourcePath).text();

    expect(source).toContain("staleTime: 0");
    expect(source).toContain('refetchOnMount: "always"');
  });
});
