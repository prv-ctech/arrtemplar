import { describe, expect, it } from "bun:test";

describe("Bun-native compliance verifier", () => {
  it("accepts the documented Bun SQLite stack and ignores generated build output", () => {
    const { exitCode, output } = runVerifier();

    expect(exitCode).toBe(0);
    expect(output).not.toContain("apps/server/src/db/client.ts");
    expect(output).not.toContain("apps/server/dist/main.js");
  });

  it("rejects Bun SQL usage even inside the database boundary", async () => {
    const probePath = "apps/server/src/db/__verify-bun-sql-probe.ts";
    const prohibitedToken = "Bun" + ".SQL";

    try {
      await Bun.write(probePath, `export const sqlClient = ${prohibitedToken};\n`, {
        createPath: true,
      });

      const { exitCode, output } = runVerifier();

      expect(exitCode).toBe(1);
      expect(output).toContain(probePath);
      expect(output).toContain("Bun SQL usage");
    } finally {
      await Bun.file(probePath).delete();
    }
  });
});

function runVerifier(): { exitCode: number | null; output: string } {
  const result = Bun.spawnSync({
    cmd: ["bun", ".github/scripts/verify-bun-rules.ts"],
    env: Bun.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
}
