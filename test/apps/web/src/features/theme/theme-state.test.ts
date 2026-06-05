import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const indexHtmlSourcePath = `${workspaceRoot}/apps/web/index.html`;
const themeStateSourcePath = `${workspaceRoot}/apps/web/src/features/theme/theme-state.tsx`;

describe("Catppuccin theme state", () => {
  it("applies the official Catppuccin flavor class to the document root", async () => {
    const source = await Bun.file(themeStateSourcePath).text();

    expect(source).toContain("root.dataset.theme = theme;");
    expect(source).toMatch(/root\.classList\.remove\(\.\.\.\s*CATPPUCCIN_THEMES\.map\(/s);
    expect(source).toContain("root.classList.add(theme);");
  });

  it("starts with the default Mocha flavor class before React hydrates", async () => {
    const source = await Bun.file(indexHtmlSourcePath).text();

    expect(source).toContain('<html class="mocha" data-theme="mocha" lang="en">');
  });
});
