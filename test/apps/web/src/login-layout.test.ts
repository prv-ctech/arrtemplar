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

  it("shows an explicit OIDC sign-in action when the provider is enabled", async () => {
    const loginRouteSource = await Bun.file(loginRouteSourcePath).text();
    const loginFormSource = await Bun.file(loginFormSourcePath).text();

    expect(loginRouteSource).toContain('const oidcStartPath = "/api/auth/oauth/oidc/start"');
    expect(loginRouteSource).toContain("useAuthProvidersQuery");
    expect(loginRouteSource).toContain("findEnabledOidcProvider(providersQuery.data)");
    expect(loginRouteSource).toContain("buttonText={oidcProvider.buttonText}");
    expect(loginRouteSource).toContain("href={oidcStartPath}");
    expect(loginRouteSource).not.toContain("window.location.assign");
    expect(loginRouteSource).not.toContain("Redirecting to Authentik");
    expect(loginFormSource).not.toContain("Continue with SSO");
    expect(loginFormSource).not.toContain("OidcSignInButton");
  });

  it("does not keep the removed post-sign-out prompt fallback", async () => {
    const loginRouteSource = await Bun.file(loginRouteSourcePath).text();

    expect(loginRouteSource).not.toContain('useSearch({ from: "/login" })');
    expect(loginRouteSource).not.toContain("signedOut");
    expect(loginRouteSource).not.toContain("prompt=login");
  });
});
