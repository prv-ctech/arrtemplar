import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const authStateSourcePath = `${workspaceRoot}/apps/web/src/features/auth/auth-state.ts`;

describe("useAuthSetupQuery", () => {
  it("always refreshes setup status when the login form mounts", async () => {
    const source = await Bun.file(authStateSourcePath).text();

    expect(source).toContain("staleTime: 0");
    expect(source).toContain('refetchOnMount: "always"');
  });
});
