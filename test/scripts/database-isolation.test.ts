import { describe, expect, it } from "bun:test";

const serverDatabaseTestFiles = [
  "test/apps/server/src/app.test.ts",
  "test/apps/server/src/auth/auth.routes.test.ts",
  "test/apps/server/src/db/migrate.test.ts",
] as const;

describe("test file layout", () => {
  it("keeps every Bun test file under the root test folder", async () => {
    const testFiles = await Array.fromAsync(
      new Bun.Glob("**/*.test.ts").scan({ cwd: ".", onlyFiles: true }),
    );
    const misplacedTests = testFiles.filter((filePath) => !filePath.startsWith("test/"));

    expect(misplacedTests).toEqual([]);
  });

  it("keeps test-only helpers out of application source folders", async () => {
    expect(await Bun.file("apps/server/src/test/database.ts").exists()).toBe(false);
    expect(await Bun.file("apps/server/src/test/schema-assertions.ts").exists()).toBe(false);
  });
});

describe("server test database isolation", () => {
  it("uses the canonical test database instead of memory or temp SQLite paths", async () => {
    for (const filePath of serverDatabaseTestFiles) {
      const source = await Bun.file(filePath).text();

      expect(source).not.toContain(":memory:");
      expect(source).not.toContain("mkdtempSync");
      expect(source).not.toContain("tmpdir");
      expect(source).not.toContain("createTempDatabaseUrl");
    }
  });
});
