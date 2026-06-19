import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const rootLayoutSourcePath = `${workspaceRoot}/apps/web/src/routes/components/root-layout.tsx`;
const sonnerSourcePath = `${workspaceRoot}/apps/web/src/components/ui/sonner.tsx`;

describe("toast layout", () => {
  it("uses the shadcn Sonner toaster with a manual close affordance", async () => {
    const source = await Bun.file(rootLayoutSourcePath).text();

    expect(source).toContain("<Toaster");
    expect(source).toContain("closeButton");
    expect(source).toContain("richColors");
    expect(source.match(/<Toaster/g)).toHaveLength(1);
  });

  it("maps Sonner rich colors to app pastel status tokens", async () => {
    const source = await Bun.file(sonnerSourcePath).text();

    expect(source).toContain("--normal-bg");
    expect(source).toContain("--success-bg");
    expect(source).toContain("--error-bg");
    expect(source).toContain("--warning-bg");
    expect(source).toContain("var(--catppuccin-color-green)");
    expect(source).toContain("var(--catppuccin-color-red)");
    expect(source).toContain("var(--catppuccin-color-yellow)");
  });
});
