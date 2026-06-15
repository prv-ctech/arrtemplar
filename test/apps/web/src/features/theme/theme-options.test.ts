import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_THEMES,
  CATPPUCCIN_PREVIEW_SWATCHES,
  CATPPUCCIN_THEMES,
  COLOR_HUNT_PREVIEW_SWATCHES,
  COLOR_HUNT_THEMES,
  DEFAULT_CATPPUCCIN_THEME,
  DEFAULT_THEME,
  isAppTheme,
  isCatppuccinTheme,
  resolveAppTheme,
  resolveCatppuccinTheme,
  THEME_PACKS,
} from "../../../../../../apps/web/src/features/theme/theme-options";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const officialColorHuntLogoPath = `${workspaceRoot}/apps/web/public/brand/color-hunt-logo-face.png`;
const staleColorHuntSvgPath = `${workspaceRoot}/apps/web/public/brand/color-hunt-logo-face.svg`;
const legacyColorHuntLogoPath = `${workspaceRoot}/apps/web/public/brand/color-hunt-mark.svg`;

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
    expect(JSON.stringify(CATPPUCCIN_THEMES)).not.toContain("description");
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

  it("groups theme options into compact brand packs", () => {
    expect(THEME_PACKS.map((pack) => pack.id)).toEqual(["catppuccin", "color-hunt"]);
    expect(THEME_PACKS.map((pack) => pack.label)).toEqual(["Catppuccin", "Color Hunt"]);

    const colorHuntPack = THEME_PACKS.find((pack) => pack.id === "color-hunt");
    expect(colorHuntPack).toMatchObject({
      label: "Color Hunt",
      logoAlt: "Color Hunt palette pack",
      logoSrc: "/brand/color-hunt-logo-face.png",
    });
    expect(colorHuntPack?.themes.map((theme) => theme.value)).toEqual([
      "color-hunt-midnight",
      "color-hunt-slate-ember",
      "color-hunt-soft-sky",
      "color-hunt-neon-tide",
      "color-hunt-ruby-dusk",
    ]);
    expect(APP_THEMES.map((theme) => theme.value)).toEqual([
      "latte",
      "frappe",
      "macchiato",
      "mocha",
      "color-hunt-midnight",
      "color-hunt-slate-ember",
      "color-hunt-soft-sky",
      "color-hunt-neon-tide",
      "color-hunt-ruby-dusk",
    ]);
  });

  it("uses the official Color Hunt PNG asset instead of generated marks", async () => {
    const logoBytes = new Uint8Array(await Bun.file(officialColorHuntLogoPath).arrayBuffer());

    expect([...logoBytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await Bun.file(staleColorHuntSvgPath).exists()).toBe(false);
    expect(await Bun.file(legacyColorHuntLogoPath).exists()).toBe(false);
  });

  it("exposes requested Color Hunt palettes as selectable themes", () => {
    expect(COLOR_HUNT_PREVIEW_SWATCHES).toEqual(["#070F2B", "#1B1A55", "#535C91", "#9290C3"]);
    expect(COLOR_HUNT_THEMES).toEqual([
      {
        value: "color-hunt-midnight",
        label: "Midnight",
        dark: true,
        previewSwatches: ["#070F2B", "#1B1A55", "#535C91", "#9290C3"],
      },
      {
        value: "color-hunt-slate-ember",
        label: "Slate Ember",
        dark: false,
        previewSwatches: ["#F5F5F5", "#76ABAE", "#303841", "#FF5722"],
      },
      {
        value: "color-hunt-soft-sky",
        label: "Soft Sky",
        dark: false,
        previewSwatches: ["#FFF9D2", "#FFEBCC", "#BFDDF0", "#8CC0EB"],
      },
      {
        value: "color-hunt-neon-tide",
        label: "Neon Tide",
        dark: true,
        previewSwatches: ["#364F6B", "#3FC1C9", "#F5F5F5", "#FC5185"],
      },
      {
        value: "color-hunt-ruby-dusk",
        label: "Ruby Dusk",
        dark: true,
        previewSwatches: ["#2B2E4A", "#E84545", "#903749", "#53354A"],
      },
    ]);
  });

  it("accepts valid theme keys", () => {
    expect(isCatppuccinTheme("latte")).toBe(true);
    expect(isCatppuccinTheme("frappe")).toBe(true);
    expect(isCatppuccinTheme("macchiato")).toBe(true);
    expect(isCatppuccinTheme("mocha")).toBe(true);
    expect(isAppTheme("color-hunt-midnight")).toBe(true);
    expect(isAppTheme("color-hunt-slate-ember")).toBe(true);
    expect(isAppTheme("color-hunt-soft-sky")).toBe(true);
    expect(isAppTheme("color-hunt-neon-tide")).toBe(true);
    expect(isAppTheme("color-hunt-ruby-dusk")).toBe(true);
  });

  it("falls back to Mocha for missing or unknown values", () => {
    expect(resolveCatppuccinTheme(null)).toBe(DEFAULT_CATPPUCCIN_THEME);
    expect(resolveCatppuccinTheme("midnight")).toBe(DEFAULT_CATPPUCCIN_THEME);
    expect(resolveAppTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveAppTheme("midnight")).toBe(DEFAULT_THEME);
  });
});
