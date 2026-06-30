import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const tabsSourcePath = `${workspaceRoot}/apps/web/src/components/ui/tabs.tsx`;
const tabsVariantsSourcePath = `${workspaceRoot}/apps/web/src/components/ui/tabs-variants.ts`;

describe("tabs primitives", () => {
  it("keeps component exports separate from variant exports for fast refresh", async () => {
    const source = await Bun.file(tabsSourcePath).text();

    expect(source).toContain('import { tabsListVariants } from "@/components/ui/tabs-variants"');
    expect(source).not.toContain("export const tabsListVariants");
  });

  it("defines shared tabs list variants in a dedicated file", async () => {
    const source = await Bun.file(tabsVariantsSourcePath).text();

    expect(source).toContain("export const tabsListVariants = cva(");
    expect(source).toContain('default: "bg-muted"');
    expect(source).toContain('line: "gap-1 bg-transparent"');
  });
});
