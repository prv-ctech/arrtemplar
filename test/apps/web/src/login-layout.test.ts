import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const loginFormSourcePath = `${workspaceRoot}/apps/web/src/components/auth/LoginForm.tsx`;
const loginRouteSourcePath = `${workspaceRoot}/apps/web/src/routes/components/login-route.tsx`;

describe("login route layout", () => {
  it("omits the login subtitle that makes the compact auth panel overflow", async () => {
    const source = await Bun.file(loginFormSourcePath).text();

    expect(source).not.toContain("Sign in to manage requests, automation, and your watch queue.");
  });

  it("keeps the auth form panel scrollable instead of clipping tall first-run or error states", async () => {
    const source = await Bun.file(loginRouteSourcePath).text();
    const authPanelClass = source.match(/<div className="(?<className>[^"]*?)">\s*<LoginForm \/>/s)
      ?.groups?.className;

    expect(authPanelClass).toContain("overflow-y-auto");
    expect(authPanelClass).not.toContain("overflow-hidden");
  });
});
