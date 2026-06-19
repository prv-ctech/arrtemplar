import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Glob } from "bun";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const webSourceRoot = `${workspaceRoot}/apps/web/src`;

const unsafeSinkPatterns = [
  { name: "React dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/ },
  { name: "raw innerHTML assignment", pattern: /\binnerHTML\s*=/ },
  { name: "raw outerHTML assignment", pattern: /\bouterHTML\s*=/ },
  { name: "insertAdjacentHTML", pattern: /\binsertAdjacentHTML\s*\(/ },
  { name: "document.write", pattern: /\bdocument\.write(?:ln)?\s*\(/ },
  { name: "eval", pattern: /\beval\s*\(/ },
  { name: "Function constructor", pattern: /\bnew\s+Function\s*\(/ },
  { name: "javascript URL literal", pattern: /javascript\s*:/i },
];

describe("frontend XSS sink audit", () => {
  it("keeps the React source tree free of raw HTML and script execution sinks", async () => {
    const findings: string[] = [];

    for await (const filePath of new Glob("**/*.{ts,tsx}").scan({
      cwd: webSourceRoot,
      absolute: true,
    })) {
      const source = await Bun.file(filePath).text();
      const relativePath = filePath.slice(`${webSourceRoot}/`.length);

      for (const { name, pattern } of unsafeSinkPatterns) {
        if (pattern.test(source)) {
          findings.push(`${relativePath}: ${name}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });
});
