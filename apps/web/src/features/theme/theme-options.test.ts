import { describe, expect, it } from "bun:test";
import {
  CATPPUCCIN_THEMES,
  DEFAULT_CATPPUCCIN_THEME,
  isCatppuccinTheme,
  resolveCatppuccinTheme,
} from "./theme-options";

describe("Catppuccin theme options", () => {
  it("exposes all requested Catppuccin flavors", () => {
    expect(CATPPUCCIN_THEMES.map((theme) => theme.value)).toEqual([
      "latte",
      "frappe",
      "macchiato",
      "mocha",
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
