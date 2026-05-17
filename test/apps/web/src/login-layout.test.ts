import { describe, expect, it } from "bun:test";

const routerSourcePath = `${Bun.env.PWD ?? "."}/apps/web/src/routes/router.tsx`;

describe("login route layout", () => {
  it("keeps the auth form panel scrollable instead of clipping tall first-run or error states", async () => {
    const source = await Bun.file(routerSourcePath).text();
    const authPanelClass = source.match(
      /<div className="(?<className>[^"]*?)">\s*<div className="absolute right-4 top-4">\s*<ThemeSwitcher compact \/>\s*<\/div>\s*<LoginForm \/>/s,
    )?.groups?.className;

    expect(authPanelClass).toContain("overflow-y-auto");
    expect(authPanelClass).not.toContain("overflow-hidden");
  });
});
