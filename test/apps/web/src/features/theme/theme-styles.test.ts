import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const stylesSourcePath = `${workspaceRoot}/apps/web/src/styles.css`;

const semanticTokenMappings = [
  ["--background", "var(--catppuccin-color-base)"],
  ["--foreground", "var(--catppuccin-color-text)"],
  ["--muted-foreground", "var(--catppuccin-color-subtext0)"],
  ["--ring", "var(--catppuccin-color-lavender)"],
  ["--card", "var(--catppuccin-color-surface0)"],
  ["--popover", "var(--catppuccin-color-mantle)"],
  ["--primary", "var(--catppuccin-color-mauve)"],
  ["--primary-foreground", "var(--catppuccin-color-base)"],
  ["--destructive", "var(--catppuccin-color-red)"],
  ["--destructive-foreground", "var(--catppuccin-color-base)"],
] as const;

describe("Catppuccin stylesheet", () => {
  it("imports the official Tailwind Catppuccin Mocha theme", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain('@import "tailwindcss";');
    expect(source).toContain('@import "@catppuccin/tailwindcss/mocha.css";');
    expect(source).toContain("@custom-variant dark (&:where(");
    expect(source).toContain(".color-hunt-midnight");
    expect(source).toContain(".color-hunt-midnight *");
    expect(source).toContain(".color-hunt-neon-tide");
    expect(source).toContain(".color-hunt-ruby-dusk");
  });

  it("does not duplicate official palette variables in app CSS", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).not.toContain("--ctp-");
    expect(source).not.toContain("html[data-theme=");
  });

  it("maps the requested Color Hunt palette into the shared theme variables", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    const expectedPalettes = [
      [".color-hunt-midnight", "#070f2b", "#1b1a55", "#535c91", "#9290c3"],
      [".color-hunt-slate-ember", "#f5f5f5", "#76abae", "#303841", "#ff5722"],
      [".color-hunt-soft-sky", "#fff9d2", "#ffebcc", "#bfddf0", "#8cc0eb"],
      [".color-hunt-neon-tide", "#364f6b", "#3fc1c9", "#f5f5f5", "#fc5185"],
      [".color-hunt-ruby-dusk", "#2b2e4a", "#e84545", "#903749", "#53354a"],
    ] as const;

    for (const [selector, base, surface, text, accent] of expectedPalettes) {
      expect(source).toContain(`${selector} {`);
      expect(source).toContain(`--color-hunt-swatch-1: ${base};`);
      expect(source).toContain(`--color-hunt-swatch-2: ${surface};`);
      expect(source).toContain(`--color-hunt-swatch-3: ${text};`);
      expect(source).toContain(`--color-hunt-swatch-4: ${accent};`);
    }

    expect(source).toContain("--catppuccin-color-base: var(--color-hunt-base);");
    expect(source).toContain("--catppuccin-color-surface0: var(--color-hunt-surface);");
    expect(source).toContain("--catppuccin-color-mauve: var(--color-hunt-accent);");
  });

  it("maps app semantic tokens to official Catppuccin variables", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    for (const [token, value] of semanticTokenMappings) {
      expect(source).toContain(`${token}: ${value};`);
    }

    expect(source).toContain(
      "--accent: color-mix(in srgb, var(--catppuccin-color-mauve) 16%, var(--catppuccin-color-surface0));",
    );
    expect(source).toContain("var(--catppuccin-color-mauve) 70%");
    expect(source).toContain("--color-selected: var(--selected);");
    expect(source).toContain("--color-selected-border: var(--selected-border);");
  });

  it("defines a stronger selected surface for dark Catppuccin flavors", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain("--selected: color-mix(");
    expect(source).toContain("--selected-border: color-mix(");
    expect(source).toContain("var(--catppuccin-color-mauve) 10%");
    expect(source).toContain("var(--catppuccin-color-mauve) 34%");
    expect(source).toContain(".frappe,");
    expect(source).toContain(".macchiato,");
    expect(source).toContain(".mocha {");
    expect(source).toContain("var(--catppuccin-color-mauve) 18%");
    expect(source).toContain("var(--catppuccin-color-mauve) 58%");
  });

  it("uses official guide colors for background and selection treatment", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain("background: linear-gradient(");
    expect(source).toContain("var(--catppuccin-color-mantle)");
    expect(source).toContain("var(--catppuccin-color-base) 48%");
    expect(source).toContain("var(--catppuccin-color-crust)");
    expect(source).toContain(
      "background: color-mix(in srgb, var(--catppuccin-color-overlay2) 28%, transparent);",
    );
  });
});
