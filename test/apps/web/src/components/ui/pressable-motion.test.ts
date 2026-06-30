import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Glob } from "bun";
import { readWorkspaceSource } from "../../features/admin/admin-settings-test-sources";

const buttonVariantsSourcePath = "apps/web/src/components/ui/button-variants.ts";
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const webSourceRoot = `${workspaceRoot}/apps/web/src`;

const translatedHitboxPatterns = [
  { name: "hover upward translation", pattern: /\bhover:-translate-y/ },
  { name: "active downward translation", pattern: /\bactive:translate-y/ },
  {
    name: "neutralized button translation override",
    pattern: /\bhover:translate-y-0 active:translate-y-0\b/,
  },
];

describe("pressable motion", () => {
  it("keeps shared button hit targets stationary on hover and press", async () => {
    const source = await readWorkspaceSource(buttonVariantsSourcePath);

    expect(source).toContain("transition-[background,color,border-color,box-shadow]");
    expect(source).not.toContain("hover:-translate-y");
    expect(source).not.toContain("active:translate-y");
  });

  it("keeps web source pressables from translating their own hover hitboxes", async () => {
    const findings: string[] = [];

    for await (const filePath of new Glob("**/*.{ts,tsx}").scan({
      cwd: webSourceRoot,
      absolute: true,
    })) {
      const source = await Bun.file(filePath).text();
      const relativePath = filePath.slice(`${webSourceRoot}/`.length);

      for (const { name, pattern } of translatedHitboxPatterns) {
        if (pattern.test(source)) {
          findings.push(`${relativePath}: ${name}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });
});
