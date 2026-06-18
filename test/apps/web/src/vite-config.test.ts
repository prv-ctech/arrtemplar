import { describe, expect, it } from "bun:test";
import {
  devServerAllowedHosts,
  devServerAllowedOrigins,
  devServerDenyFiles,
} from "../../../../apps/web/src/lib/vite-dev-server-security";

const viteConfigPath = Bun.fileURLToPath(
  new URL("../../../../apps/web/vite.config.ts", import.meta.url),
);

describe("Vite development hardening", () => {
  it("keeps dev-container access while using explicit host, CORS, and filesystem allowlists", async () => {
    const configSource = await Bun.file(viteConfigPath).text();

    expect(configSource).toContain('host: "0.0.0.0"');
    expect(configSource).toContain("allowedHosts: devServerAllowedHosts");
    expect(configSource).toContain("origin: devServerAllowedOrigins");
    expect(configSource).toContain("strict: true");
    expect(configSource).toContain("deny: devServerDenyFiles");
    expect(configSource).not.toContain("allowedHosts: true");
    expect(configSource).not.toContain("cors: true");
    expect(configSource).not.toContain("rewriteWsOrigin");
    expect(devServerAllowedHosts).toEqual([
      "localhost",
      ".localhost",
      "127.0.0.1",
      "[::1]",
      ".github.dev",
      ".app.github.dev",
    ]);
    expect(devServerAllowedOrigins).toHaveLength(5);
    expect(devServerDenyFiles).toEqual(
      expect.arrayContaining([
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "*.key",
        "**/.git/**",
        "**/*.sqlite",
        "**/*.sqlite-shm",
        "**/*.sqlite-wal",
      ]),
    );
  });
});

describe("Vite production build", () => {
  it("splits large vendor dependencies into dedicated chunks", async () => {
    const configSource = await Bun.file(viteConfigPath).text();

    expect(configSource).toContain("rolldownOptions");
    expect(configSource).toContain("codeSplitting");
    expect(configSource).toContain("react-vendor");
    expect(configSource).toContain("tanstack-vendor");
    expect(configSource).toContain("ui-vendor");
  });
});
