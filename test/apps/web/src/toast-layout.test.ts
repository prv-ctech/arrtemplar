import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const rootLayoutSourcePath = `${workspaceRoot}/apps/web/src/routes/components/root-layout.tsx`;
const sonnerSourcePath = `${workspaceRoot}/apps/web/src/components/ui/sonner.tsx`;
const stylesSourcePath = `${workspaceRoot}/apps/web/src/styles.css`;

describe("toast layout", () => {
  it("uses the shadcn Sonner toaster with a manual close affordance", async () => {
    const source = await Bun.file(rootLayoutSourcePath).text();

    expect(source).toContain("<Toaster");
    expect(source).toContain("closeButton");
    expect(source).toContain("richColors");
    expect(source.match(/<Toaster/g)).toHaveLength(1);
  });

  it("maps Sonner rich colors to fixed semantic toast tokens", async () => {
    const source = await Bun.file(sonnerSourcePath).text();
    const stylesSource = await Bun.file(stylesSourcePath).text();

    expect(source).toContain("--normal-bg");
    expect(source).toContain("--info-bg");
    expect(source).toContain("--success-bg");
    expect(source).toContain("--error-bg");
    expect(source).toContain("--warning-bg");
    expect(source).toContain("var(--toast-success-bg)");
    expect(source).toContain("var(--toast-warning-bg)");
    expect(source).toContain("var(--toast-error-bg)");
    expect(source).toContain("var(--toast-info-bg)");
    expect(stylesSource).toContain("--toast-success-bg: #e8f7ec;");
    expect(stylesSource).toContain("--toast-warning-bg: #fff4db;");
    expect(stylesSource).toContain("--toast-error-bg: #fdecea;");
    expect(stylesSource).toContain("--toast-info-bg: #e9f1ff;");
  });
});
