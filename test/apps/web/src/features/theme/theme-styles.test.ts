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
    expect(source).toMatch(/@custom-variant\s+dark\s*\(\s*&:where\(/);
    expect(source).toContain(".color-hunt-midnight");
    expect(source).toContain(".color-hunt-midnight *");
    expect(source).toContain(".color-hunt-neon-tide");
    expect(source).toContain(".color-hunt-ruby-dusk");
    expect(source).toContain(".color-hunt-crimson-depths");
    expect(source).toContain(".color-hunt-ember-void");
    expect(source).toContain(".color-hunt-rose-noir");
    expect(source).toContain(".color-hunt-harvest-signal");
    expect(source).toContain(".theme-park-aquamarine");
    expect(source).toContain(".theme-park-aquamarine *");
    expect(source).toContain(".theme-park-nord");
    expect(source).toContain(".theme-park-overseerr");
    expect(source).toContain(".theme-park-space-gray");
    expect(source).toContain(".arrbit-radioactive");
    expect(source).toContain(".arrbit-radioactive *");
    expect(source).toContain(".arrbit-retro-gaming");
    expect(source).toContain(".arrbit-retro-gaming *");
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
      [".color-hunt-crimson-depths", "#050e3c", "#002455", "#dc0000", "#ff3838"],
      [".color-hunt-ember-void", "#ff6500", "#1e3e62", "#0b192c", "#000000"],
      [".color-hunt-rose-noir", "#f63049", "#d02752", "#8a244b", "#111f35"],
      [".color-hunt-clay-glow", "#f4e7e1", "#ff9b45", "#d5451b", "#521c0d"],
      [".color-hunt-blush-cream", "#fffbf1", "#fff2d0", "#ffb2b2", "#e36a6a"],
      [".color-hunt-harvest-signal", "#003049", "#d62828", "#f77f00", "#fcbf49"],
      [".color-hunt-cloud-peach", "#c6e7ff", "#d4f6ff", "#fbfbfb", "#ffddae"],
    ] as const;

    for (const [selector, base, surface, text, accent] of expectedPalettes) {
      expect(source).toContain(`${selector} {`);
      expect(source).toContain(`--color-hunt-swatch-1: ${base};`);
      expect(source).toContain(`--color-hunt-swatch-2: ${surface};`);
      expect(source).toContain(`--color-hunt-swatch-3: ${text};`);
      expect(source).toContain(`--color-hunt-swatch-4: ${accent};`);
    }

    expect(source).toContain("--catppuccin-color-base: var(--color-hunt-base);");
    expect(source).toContain(
      "--color-hunt-panel: color-mix(in srgb, var(--color-hunt-surface) 78%, var(--color-hunt-base));",
    );
    expect(source).toContain("--catppuccin-color-surface0: var(--color-hunt-panel);");
    expect(source).toContain("--catppuccin-color-mauve: var(--color-hunt-accent);");
    expect(source).toContain(
      "--selected: color-mix(in srgb, var(--color-hunt-accent) 12%, var(--color-hunt-panel));",
    );
    expect(source).toContain("var(--color-hunt-accent) 28%");
    expect(source).toContain(
      "--color-hunt-subtext: color-mix(in srgb, var(--color-hunt-text) 88%, var(--color-hunt-base));",
    );
    expect(source).toContain(
      "--primary-foreground: color-mix(in srgb, black 92%, var(--color-hunt-base));",
    );
  });

  it("strengthens the delicate Color Hunt themes for readable body and action text", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain(".color-hunt-soft-sky {");
    expect(source).toContain(
      "--color-hunt-text: color-mix(in srgb, var(--color-hunt-swatch-4) 28%, black);",
    );
    expect(source).toContain(".color-hunt-blush-cream {");
    expect(source).toContain(
      "--color-hunt-text: color-mix(in srgb, var(--color-hunt-swatch-4) 38%, black);",
    );
    expect(source).toContain(".color-hunt-cloud-peach {");
    expect(source).toContain(
      "--color-hunt-text: color-mix(in srgb, var(--color-hunt-swatch-1) 24%, black);",
    );
    expect(source).toContain(".color-hunt-neon-tide {");
    expect(source).toContain(
      "--color-hunt-subtext: color-mix(in srgb, var(--color-hunt-text) 90%, var(--color-hunt-base));",
    );
    expect(source).toContain("var(--color-hunt-text) 96%");
    expect(source).toContain(".color-hunt-ruby-dusk {");
    expect(source).toContain(".color-hunt-rose-noir {");
  });

  it("maps official Theme Park styles into the shared theme variables", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    const expectedPalettes = [
      [".theme-park-aquamarine", "#0b3161", "#265c74", "#47918a", "#12afa0", "#ddd"],
      [".theme-park-dark", "#000000", "#2d2d2d", "#7a7a7a", "#aaaaaa", "#ddd"],
      [".theme-park-dracula", "#282a36", "#1e2029", "#6272a4", "#50fa7b", "#f8f8f2"],
      [".theme-park-hotline", "#155fa5", "#5e61ab", "#f765b8", "#f98dc9", "#f4f7ff"],
      [".theme-park-hotpink", "#004249", "#204c80", "#fb3f62", "#fb3f62", "#eee"],
      [".theme-park-maroon", "#220a25", "#4c1533", "#7b154d", "#a21c65", "#dadada"],
      [".theme-park-nord", "#2e3440", "#3b4252", "#81a1c1", "#79b8ca", "#d8dee9"],
      [".theme-park-organizr", "#1f1f1f", "#333333", "#999999", "#2cabe3", "#96a2b4"],
      [".theme-park-overseerr", "#111827", "#1f2937", "#374151", "#a78bfa", "#d1d5db"],
      [".theme-park-plex", "#000000", "#282828", "#3f3f3f", "#e5a00d", "#ddd"],
      [".theme-park-space-gray", "#253237", "#576c75", "#607d8b", "#81a6b7", "#e6edf0"],
    ] as const;

    for (const [selector, base, surface, muted, accent, text] of expectedPalettes) {
      expect(source).toContain(`${selector} {`);
      expect(source).toContain(`--theme-park-base: ${base};`);
      expect(source).toContain(`--theme-park-surface: ${surface};`);
      expect(source).toContain(`--theme-park-muted: ${muted};`);
      expect(source).toContain(`--theme-park-accent: ${accent};`);
      expect(source).toContain(`--theme-park-text: ${text};`);
    }

    expect(source).toContain("--catppuccin-color-base: var(--theme-park-base);");
    expect(source).toContain(
      "--theme-park-panel: color-mix(in srgb, var(--theme-park-surface) 72%, var(--theme-park-base));",
    );
    expect(source).toContain("--catppuccin-color-surface0: var(--theme-park-panel);");
    expect(source).toContain("--catppuccin-color-mauve: var(--theme-park-accent);");
  });

  it("strengthens weaker Theme Park themes for readable surfaces and action text", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain(".theme-park-hotline {");
    expect(source).toContain("--theme-park-text: #f4f7ff;");
    expect(source).toContain(".theme-park-space-gray {");
    expect(source).toContain("--theme-park-text: #e6edf0;");
    expect(source).toContain(".theme-park-maroon {");
    expect(source).toContain("--theme-park-primary-foreground: #fff1f8;");
    expect(source).toContain(".theme-park-hotline,");
    expect(source).toContain(".theme-park-organizr,");
    expect(source).toContain("var(--theme-park-text) 90%");
    expect(source).toContain("var(--theme-park-text) 96%");
    expect(source).toContain(".theme-park-organizr {");
    expect(source).toContain(
      "--selected: color-mix(in srgb, var(--theme-park-accent) 9%, var(--theme-park-panel));",
    );
    expect(source).toContain(
      "--primary-foreground: color-mix(in srgb, black 92%, var(--theme-park-base));",
    );
    expect(source).toContain(
      "--selected: color-mix(in srgb, var(--theme-park-accent) 12%, var(--theme-park-panel));",
    );
  });

  it("maps the Arrbit Radioactive palette into high-contrast shared theme variables", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain(".arrbit-radioactive {");
    expect(source).toContain("--arrbit-swatch-1: #61892f;");
    expect(source).toContain("--arrbit-swatch-2: #86c232;");
    expect(source).toContain("--arrbit-swatch-3: #222629;");
    expect(source).toContain("--arrbit-swatch-4: #474b4f;");
    expect(source).toContain("--arrbit-swatch-5: #6b6e70;");
    expect(source).toContain("--arrbit-base: var(--arrbit-swatch-3);");
    expect(source).toContain("--arrbit-surface: color-mix(");
    expect(source).toContain("--arrbit-accent: var(--arrbit-swatch-2);");
    expect(source).toContain(
      "--arrbit-text: color-mix(in srgb, var(--arrbit-swatch-5) 18%, white);",
    );
    expect(source).toContain("--catppuccin-color-base: var(--arrbit-base);");
    expect(source).toContain("--catppuccin-color-surface0: var(--arrbit-surface);");
    expect(source).toContain("--catppuccin-color-text: var(--arrbit-text);");
    expect(source).toContain("--catppuccin-color-mauve: var(--arrbit-accent);");
  });

  it("maps the Arrbit Retro Gaming palette into high-contrast shared theme variables", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain(".arrbit-retro-gaming {");
    expect(source).toContain("--arrbit-swatch-1: #8b5cf6;");
    expect(source).toContain("--arrbit-swatch-2: #ec4899;");
    expect(source).toContain("--arrbit-swatch-3: #06b6d4;");
    expect(source).toContain("--arrbit-swatch-4: #1e1b4b;");
    expect(source).toContain("--arrbit-swatch-5: #f5f3ff;");
    expect(source).toContain("--arrbit-primary: color-mix(");
    expect(source).toContain("--arrbit-secondary: var(--arrbit-swatch-2);");
    expect(source).toContain("--arrbit-accent: var(--arrbit-swatch-3);");
    expect(source).toContain("--arrbit-base: var(--arrbit-swatch-4);");
    expect(source).toContain("--arrbit-text: var(--arrbit-swatch-5);");
    expect(source).toContain("--catppuccin-color-mauve: var(--arrbit-primary);");
    expect(source).toContain("--primary-foreground: var(--arrbit-primary-foreground);");
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

  it("keeps border and status semantics visible across custom palettes", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain("--semantic-danger-base: #ef6b7b;");
    expect(source).toContain("--semantic-info-base: #4b9cff;");
    expect(source).toContain("--semantic-success-base: #70c247;");
    expect(source).toContain(
      "--border: color-mix(in srgb, var(--catppuccin-color-overlay1) 52%, transparent);",
    );
    expect(source).toContain("--input: color-mix(");
    expect(source).toContain("var(--catppuccin-color-overlay1) 42%,");
    expect(source).toContain("var(--catppuccin-color-surface1)");
    expect(source).toContain("--status-success: var(--semantic-success-base);");
    expect(source).toContain(
      "--status-success-foreground: color-mix(in srgb, var(--status-success) 78%, var(--foreground));",
    );
    expect(source).toContain("--action-info: var(--semantic-info-base);");
    expect(source).toContain(
      "--action-danger-foreground: color-mix(in srgb, var(--destructive) 76%, var(--foreground));",
    );
    expect(source).toContain("--catppuccin-color-red: var(--semantic-danger-base);");
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

  it("strengthens Latte and Frappé subtext for readable muted UI copy", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain(".latte {");
    expect(source).toContain("var(--catppuccin-color-text) 96%");
    expect(source).toContain(".frappe {");
    expect(source).toContain("var(--catppuccin-color-text) 82%");
    expect(source).toContain("var(--catppuccin-color-text) 100%");
    expect(source).toContain("var(--catppuccin-color-text) 92%");
  });

  it("uses official guide colors for background and selection treatment", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain("--page-background-start: var(--catppuccin-color-mantle);");
    expect(source).toContain("--page-grid-opacity: 0.18;");
    expect(source).toContain("background: linear-gradient(");
    expect(source).toContain("var(--page-background-start)");
    expect(source).toContain("var(--page-background-mid) 48%");
    expect(source).toContain("var(--page-background-end)");
    expect(source).toContain("linear-gradient(var(--page-grid-line-y) 1px, transparent 1px)");
    expect(source).toContain("opacity: var(--page-grid-opacity);");
  });
});
