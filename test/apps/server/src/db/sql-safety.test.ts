import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

const serverSourceRoot = `${Bun.env.PWD ?? "."}/apps/server/src`;

const unsafeRawSqlPatterns = [
  {
    name: "template interpolation in raw SQL execution",
    pattern: /\.(?:run|prepare|query|exec)\s*\(\s*`[^`]*\$\{/,
  },
  {
    name: "string concatenation in raw SQL execution",
    pattern: /\.(?:run|prepare|query|exec)\s*\(\s*["'`][\s\S]*?["'`]\s*\+/,
  },
  {
    name: "drizzle sql.raw escape hatch",
    pattern: /\bsql\.raw\s*\(/,
  },
];

describe("server SQL safety", () => {
  it("keeps user-influenced SQL behind Drizzle query APIs", async () => {
    const findings: string[] = [];

    for await (const filePath of new Glob("**/*.ts").scan({
      cwd: serverSourceRoot,
      absolute: true,
    })) {
      const source = await Bun.file(filePath).text();
      const relativePath = filePath.slice(`${serverSourceRoot}/`.length);

      for (const { name, pattern } of unsafeRawSqlPatterns) {
        if (pattern.test(source)) {
          findings.push(`${relativePath}: ${name}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });

  it("keeps approved raw SQL limited to static schema and SQLite PRAGMA statements", async () => {
    const clientSource = await Bun.file(`${serverSourceRoot}/db/client.ts`).text();
    const schemaSource = await Bun.file(`${serverSourceRoot}/db/schema.ts`).text();

    expect(clientSource).toContain('"PRAGMA foreign_keys = ON"');
    expect(clientSource).toContain('"PRAGMA journal_mode = WAL"');
    expect(clientSource).toContain('"PRAGMA busy_timeout = 5000"');
    expect(clientSource).toContain('"PRAGMA synchronous = NORMAL"');
    expect(clientSource).toContain('"PRAGMA trusted_schema = OFF"');
    expect(clientSource).toContain('sqlite.run("PRAGMA optimize=0x10002")');
    expect(clientSource).toContain('sqlite.run("PRAGMA optimize")');
    expect(clientSource).not.toMatch(/sqlite\.run\s*\(\s*`[^`]*\$\{/);
    expect(schemaSource).toContain("sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`");
  });
});
