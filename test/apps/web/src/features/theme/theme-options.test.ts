import { describe, expect, it } from "bun:test";
import {
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

  it("uses official Catppuccin palette colors for theme preview swatches", () => {
    expect(CATPPUCCIN_THEMES).toHaveLength(4);
    expect(CATPPUCCIN_THEMES[0]).toMatchObject({
      value: "latte",
      label: "Latte",
      dark: false,
    });
    expect(CATPPUCCIN_THEMES[0]?.swatches).toEqual([
      "#e6e9ef",
      "#eff1f5",
      "#ccd0da",
      "#8839ef",
      "#fe640b",
    ]);
    expect(CATPPUCCIN_THEMES[1]).toMatchObject({ value: "frappe", label: "Frappé", dark: true });
    expect(CATPPUCCIN_THEMES[1]?.swatches).toEqual([
      "#292c3c",
      "#303446",
      "#414559",
      "#ca9ee6",
      "#ef9f76",
    ]);
    expect(CATPPUCCIN_THEMES[2]).toMatchObject({
      value: "macchiato",
      label: "Macchiato",
      dark: true,
    });
    expect(CATPPUCCIN_THEMES[2]?.swatches).toEqual([
      "#1e2030",
      "#24273a",
      "#363a4f",
      "#c6a0f6",
      "#f5a97f",
    ]);
    expect(CATPPUCCIN_THEMES[3]).toMatchObject({ value: "mocha", label: "Mocha", dark: true });
    expect(CATPPUCCIN_THEMES[3]?.swatches).toEqual([
      "#181825",
      "#1e1e2e",
      "#313244",
      "#cba6f7",
      "#fab387",
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
