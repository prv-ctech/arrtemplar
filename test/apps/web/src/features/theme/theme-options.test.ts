import { describe, expect, it } from "bun:test";
import {
  CATPPUCCIN_PREVIEW_SWATCHES,
  CATPPUCCIN_THEMES,
  DEFAULT_CATPPUCCIN_THEME,
  isCatppuccinTheme,
  resolveCatppuccinTheme,
} from "../../../../../../apps/web/src/features/theme/theme-options";

describe("Catppuccin theme options", () => {
  it("exposes all requested Catppuccin flavors", () => {
    expect(CATPPUCCIN_THEMES.map((theme) => theme.value)).toEqual([
      "latte",
      "frappe",
      "macchiato",
      "mocha",
    ]);
  });

  it("uses official Catppuccin flavor metadata without duplicating palette hex values", () => {
    expect(CATPPUCCIN_THEMES).toHaveLength(4);
    expect(CATPPUCCIN_THEMES[0]).toMatchObject({
      value: "latte",
      label: "Latte",
      dark: false,
    });
    expect(CATPPUCCIN_THEMES[1]).toMatchObject({ value: "frappe", label: "Frappé", dark: true });
    expect(CATPPUCCIN_THEMES[2]).toMatchObject({
      value: "macchiato",
      label: "Macchiato",
      dark: true,
    });
    expect(CATPPUCCIN_THEMES[3]).toMatchObject({ value: "mocha", label: "Mocha", dark: true });
    expect(JSON.stringify(CATPPUCCIN_THEMES)).not.toMatch(/#[\da-f]{6}/i);
  });

  it("previews flavors with official Catppuccin CSS variables", () => {
    expect(CATPPUCCIN_PREVIEW_SWATCHES).toEqual([
      "var(--catppuccin-color-mantle)",
      "var(--catppuccin-color-base)",
      "var(--catppuccin-color-surface0)",
      "var(--catppuccin-color-mauve)",
      "var(--catppuccin-color-peach)",
    ]);
  });

  it("accepts valid theme keys", () => {
    expect(isCatppuccinTheme("latte")).toBe(true);
    expect(isCatppuccinTheme("frappe")).toBe(true);
    expect(isCatppuccinTheme("macchiato")).toBe(true);
    expect(isCatppuccinTheme("mocha")).toBe(true);
  });

  it("falls back to Mocha for missing or unknown values", () => {
    expect(resolveCatppuccinTheme(null)).toBe(DEFAULT_CATPPUCCIN_THEME);
    expect(resolveCatppuccinTheme("midnight")).toBe(DEFAULT_CATPPUCCIN_THEME);
  });
});
