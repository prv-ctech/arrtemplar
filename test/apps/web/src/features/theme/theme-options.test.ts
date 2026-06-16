import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_THEMES,
  ARRBIT_PREVIEW_SWATCHES,
  ARRBIT_THEMES,
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
  THEME_PARK_PREVIEW_SWATCHES,
  THEME_PARK_THEMES,
} from "../../../../../../apps/web/src/features/theme/theme-options";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const arrbitLogoPath = `${workspaceRoot}/apps/web/public/brand/arrbit-mark.svg`;
const officialColorHuntLogoPath = `${workspaceRoot}/apps/web/public/brand/color-hunt-logo-face.png`;
const officialThemeParkLogoPath = `${workspaceRoot}/apps/web/public/brand/theme-park-dev-logo.png`;
const staleColorHuntSvgPath = `${workspaceRoot}/apps/web/public/brand/color-hunt-logo-face.svg`;
const legacyColorHuntLogoPath = `${workspaceRoot}/apps/web/public/brand/color-hunt-mark.svg`;
const themeParkThemeValues = [
  "theme-park-aquamarine",
  "theme-park-dark",
  "theme-park-dracula",
  "theme-park-hotline",
  "theme-park-hotpink",
  "theme-park-maroon",
  "theme-park-nord",
  "theme-park-organizr",
  "theme-park-overseerr",
  "theme-park-plex",
  "theme-park-space-gray",
] as const;

describe("Catppuccin theme options", () => {
  it("exposes all requested Catppuccin flavors", () => {
    expect(CATPPUCCIN_THEMES.map((theme) => theme.value)).toEqual([
      "latte",
      "frappe",
      "macchiato",
      "mocha",
    ]);
  });

  it("uses official Catppuccin flavor metadata", () => {
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
    expect(JSON.stringify(CATPPUCCIN_THEMES)).not.toContain("description");
  });

  it("previews Catppuccin with static official swatches independent of the active theme", () => {
    expect(CATPPUCCIN_PREVIEW_SWATCHES).toEqual([
      "#181825",
      "#1E1E2E",
      "#313244",
      "#CBA6F7",
      "#FAB387",
    ]);
    expect(CATPPUCCIN_PREVIEW_SWATCHES.join(" ")).not.toContain("var(");
    for (const theme of CATPPUCCIN_THEMES) {
      expect(theme.previewSwatches).toBeDefined();
      expect(theme.previewSwatches?.join(" ")).not.toContain("var(");
    }
  });

  it("groups theme options into compact brand packs", () => {
    expect(THEME_PACKS.map((pack) => pack.id)).toEqual([
      "catppuccin",
      "color-hunt",
      "theme-park",
      "arrbit",
    ]);
    expect(THEME_PACKS.map((pack) => pack.label)).toEqual([
      "Catppuccin",
      "Color Hunt",
      "Theme Park",
      "Arrbit",
    ]);

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
      "color-hunt-crimson-depths",
      "color-hunt-ember-void",
      "color-hunt-rose-noir",
      "color-hunt-clay-glow",
      "color-hunt-blush-cream",
      "color-hunt-harvest-signal",
      "color-hunt-cloud-peach",
    ]);
    const themeParkPack = THEME_PACKS.find((pack) => pack.id === "theme-park");
    expect(themeParkPack).toMatchObject({
      label: "Theme Park",
      logoAlt: "Theme Park theme pack",
      logoSrc: "/brand/theme-park-dev-logo.png",
    });
    expect(themeParkPack?.themes.map((theme) => theme.value)).toEqual([...themeParkThemeValues]);
    const arrbitPack = THEME_PACKS.find((pack) => pack.id === "arrbit");
    expect(arrbitPack).toMatchObject({
      label: "Arrbit",
      logoAlt: "Arrbit palette pack",
      logoSrc: "/brand/arrbit-mark.svg",
    });
    expect(arrbitPack?.themes.map((theme) => theme.value)).toEqual([
      "arrbit-radioactive",
      "arrbit-retro-gaming",
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
      "color-hunt-crimson-depths",
      "color-hunt-ember-void",
      "color-hunt-rose-noir",
      "color-hunt-clay-glow",
      "color-hunt-blush-cream",
      "color-hunt-harvest-signal",
      "color-hunt-cloud-peach",
      ...themeParkThemeValues,
      "arrbit-radioactive",
      "arrbit-retro-gaming",
    ]);
  });

  it("uses the official Color Hunt PNG asset instead of generated marks", async () => {
    const logoBytes = new Uint8Array(await Bun.file(officialColorHuntLogoPath).arrayBuffer());

    expect([...logoBytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await Bun.file(staleColorHuntSvgPath).exists()).toBe(false);
    expect(await Bun.file(legacyColorHuntLogoPath).exists()).toBe(false);
  });

  it("uses the official Theme Park PNG logo asset", async () => {
    const logoBytes = new Uint8Array(await Bun.file(officialThemeParkLogoPath).arrayBuffer());

    expect([...logoBytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("uses a palette-matched Arrbit SVG mark", async () => {
    const logoSource = await Bun.file(arrbitLogoPath).text();

    expect(logoSource).toContain("<svg");
    expect(logoSource).toContain("#86C232");
    expect(logoSource).toContain("#222629");
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
      {
        value: "color-hunt-crimson-depths",
        label: "Crimson Depths",
        dark: true,
        previewSwatches: ["#050E3C", "#002455", "#DC0000", "#FF3838"],
      },
      {
        value: "color-hunt-ember-void",
        label: "Ember Void",
        dark: true,
        previewSwatches: ["#FF6500", "#1E3E62", "#0B192C", "#000000"],
      },
      {
        value: "color-hunt-rose-noir",
        label: "Rose Noir",
        dark: true,
        previewSwatches: ["#F63049", "#D02752", "#8A244B", "#111F35"],
      },
      {
        value: "color-hunt-clay-glow",
        label: "Clay Glow",
        dark: false,
        previewSwatches: ["#F4E7E1", "#FF9B45", "#D5451B", "#521C0D"],
      },
      {
        value: "color-hunt-blush-cream",
        label: "Blush Cream",
        dark: false,
        previewSwatches: ["#FFFBF1", "#FFF2D0", "#FFB2B2", "#E36A6A"],
      },
      {
        value: "color-hunt-harvest-signal",
        label: "Harvest Signal",
        dark: true,
        previewSwatches: ["#003049", "#D62828", "#F77F00", "#FCBF49"],
      },
      {
        value: "color-hunt-cloud-peach",
        label: "Cloud Peach",
        dark: false,
        previewSwatches: ["#C6E7FF", "#D4F6FF", "#FBFBFB", "#FFDDAE"],
      },
    ]);
  });

  it("exposes official Theme Park styles as selectable themes", () => {
    expect(THEME_PARK_PREVIEW_SWATCHES).toEqual(["#0B3161", "#265C74", "#009688", "#12AFA0"]);
    expect(THEME_PARK_THEMES).toEqual([
      {
        value: "theme-park-aquamarine",
        label: "Aquamarine",
        dark: true,
        previewSwatches: ["#0B3161", "#265C74", "#009688", "#12AFA0"],
      },
      {
        value: "theme-park-dark",
        label: "Dark",
        dark: true,
        previewSwatches: ["#000000", "#2D2D2D", "#7A7A7A", "#AAAAAA"],
      },
      {
        value: "theme-park-dracula",
        label: "Dracula",
        dark: true,
        previewSwatches: ["#282A36", "#1E2029", "#BD93F9", "#50FA7B"],
      },
      {
        value: "theme-park-hotline",
        label: "Hotline",
        dark: true,
        previewSwatches: ["#155FA5", "#5E61AB", "#F765B8", "#F98DC9"],
      },
      {
        value: "theme-park-hotpink",
        label: "Hotpink",
        dark: true,
        previewSwatches: ["#004249", "#204C80", "#FB3F62", "#00FF9D"],
      },
      {
        value: "theme-park-maroon",
        label: "Maroon",
        dark: true,
        previewSwatches: ["#220A25", "#4C1533", "#7B154D", "#A21C65"],
      },
      {
        value: "theme-park-nord",
        label: "Nord",
        dark: true,
        previewSwatches: ["#2E3440", "#3B4252", "#79B8CA", "#D8DEE9"],
      },
      {
        value: "theme-park-organizr",
        label: "Organizr",
        dark: true,
        previewSwatches: ["#1F1F1F", "#333333", "#2CABE3", "#96A2B4"],
      },
      {
        value: "theme-park-overseerr",
        label: "Overseerr",
        dark: true,
        previewSwatches: ["#111827", "#1F2937", "#4F46E5", "#A78BFA"],
      },
      {
        value: "theme-park-plex",
        label: "Plex",
        dark: true,
        previewSwatches: ["#000000", "#282828", "#CC7B19", "#E5A00D"],
      },
      {
        value: "theme-park-space-gray",
        label: "Space Gray",
        dark: true,
        previewSwatches: ["#253237", "#576C75", "#607D8B", "#81A6B7"],
      },
    ]);
  });

  it("exposes the Arrbit palettes as selectable themes", () => {
    expect(ARRBIT_PREVIEW_SWATCHES).toEqual([
      "#61892F",
      "#86C232",
      "#222629",
      "#474B4F",
      "#6B6E70",
    ]);
    expect(ARRBIT_THEMES).toEqual([
      {
        value: "arrbit-radioactive",
        label: "Radioactive",
        dark: true,
        previewSwatches: ["#61892F", "#86C232", "#222629", "#474B4F", "#6B6E70"],
      },
      {
        value: "arrbit-retro-gaming",
        label: "Retro Gaming",
        dark: true,
        previewSwatches: ["#8B5CF6", "#EC4899", "#06B6D4", "#1E1B4B", "#F5F3FF"],
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
    expect(isAppTheme("color-hunt-crimson-depths")).toBe(true);
    expect(isAppTheme("color-hunt-ember-void")).toBe(true);
    expect(isAppTheme("color-hunt-rose-noir")).toBe(true);
    expect(isAppTheme("color-hunt-clay-glow")).toBe(true);
    expect(isAppTheme("color-hunt-blush-cream")).toBe(true);
    expect(isAppTheme("color-hunt-harvest-signal")).toBe(true);
    expect(isAppTheme("color-hunt-cloud-peach")).toBe(true);
    for (const theme of themeParkThemeValues) {
      expect(isAppTheme(theme)).toBe(true);
    }
    expect(isAppTheme("arrbit-radioactive")).toBe(true);
    expect(isAppTheme("arrbit-retro-gaming")).toBe(true);
  });

  it("falls back to Mocha for missing or unknown values", () => {
    expect(resolveCatppuccinTheme(null)).toBe(DEFAULT_CATPPUCCIN_THEME);
    expect(resolveCatppuccinTheme("midnight")).toBe(DEFAULT_CATPPUCCIN_THEME);
    expect(resolveAppTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveAppTheme("midnight")).toBe(DEFAULT_THEME);
  });
});
