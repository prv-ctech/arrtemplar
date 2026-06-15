export type CatppuccinTheme = "latte" | "frappe" | "macchiato" | "mocha";
export type ColorHuntTheme =
  | "color-hunt-midnight"
  | "color-hunt-slate-ember"
  | "color-hunt-soft-sky"
  | "color-hunt-neon-tide"
  | "color-hunt-ruby-dusk";
export type AppTheme = CatppuccinTheme | ColorHuntTheme;
export type ThemePackId = "catppuccin" | "color-hunt";

export type ThemeOption<TTheme extends AppTheme = AppTheme> = {
  value: TTheme;
  label: string;
  dark: boolean;
  previewSwatches?: readonly string[];
};

type CatppuccinThemeOption = ThemeOption<CatppuccinTheme>;
type ColorHuntThemeOption = ThemeOption<ColorHuntTheme>;

export type ThemePack = {
  id: ThemePackId;
  label: string;
  logoAlt: string;
  logoSrc: string;
  previewSwatches: readonly string[];
  themes: readonly ThemeOption[];
};

export const DEFAULT_CATPPUCCIN_THEME: CatppuccinTheme = "mocha";
export const DEFAULT_THEME: AppTheme = DEFAULT_CATPPUCCIN_THEME;

export const CATPPUCCIN_PREVIEW_SWATCHES = [
  "var(--catppuccin-color-mantle)",
  "var(--catppuccin-color-base)",
  "var(--catppuccin-color-surface0)",
  "var(--catppuccin-color-mauve)",
  "var(--catppuccin-color-peach)",
] as const;

export const COLOR_HUNT_PREVIEW_SWATCHES = ["#070F2B", "#1B1A55", "#535C91", "#9290C3"] as const;
const COLOR_HUNT_SLATE_EMBER_SWATCHES = ["#F5F5F5", "#76ABAE", "#303841", "#FF5722"] as const;
const COLOR_HUNT_SOFT_SKY_SWATCHES = ["#FFF9D2", "#FFEBCC", "#BFDDF0", "#8CC0EB"] as const;
const COLOR_HUNT_NEON_TIDE_SWATCHES = ["#364F6B", "#3FC1C9", "#F5F5F5", "#FC5185"] as const;
const COLOR_HUNT_RUBY_DUSK_SWATCHES = ["#2B2E4A", "#E84545", "#903749", "#53354A"] as const;

export const CATPPUCCIN_THEMES = [
  {
    value: "latte",
    label: "Latte",
    dark: false,
  },
  {
    value: "frappe",
    label: "Frappé",
    dark: true,
  },
  {
    value: "macchiato",
    label: "Macchiato",
    dark: true,
  },
  {
    value: "mocha",
    label: "Mocha",
    dark: true,
  },
] as const satisfies readonly CatppuccinThemeOption[];

export const COLOR_HUNT_THEMES = [
  {
    value: "color-hunt-midnight",
    label: "Midnight",
    dark: true,
    previewSwatches: COLOR_HUNT_PREVIEW_SWATCHES,
  },
  {
    value: "color-hunt-slate-ember",
    label: "Slate Ember",
    dark: false,
    previewSwatches: COLOR_HUNT_SLATE_EMBER_SWATCHES,
  },
  {
    value: "color-hunt-soft-sky",
    label: "Soft Sky",
    dark: false,
    previewSwatches: COLOR_HUNT_SOFT_SKY_SWATCHES,
  },
  {
    value: "color-hunt-neon-tide",
    label: "Neon Tide",
    dark: true,
    previewSwatches: COLOR_HUNT_NEON_TIDE_SWATCHES,
  },
  {
    value: "color-hunt-ruby-dusk",
    label: "Ruby Dusk",
    dark: true,
    previewSwatches: COLOR_HUNT_RUBY_DUSK_SWATCHES,
  },
] as const satisfies readonly ColorHuntThemeOption[];

export const APP_THEMES = [
  ...CATPPUCCIN_THEMES,
  ...COLOR_HUNT_THEMES,
] as const satisfies readonly ThemeOption[];

export const THEME_PACKS = [
  {
    id: "catppuccin",
    label: "Catppuccin",
    logoAlt: "Catppuccin theme pack",
    logoSrc: "/brand/catppuccin-circle.png",
    previewSwatches: CATPPUCCIN_PREVIEW_SWATCHES,
    themes: CATPPUCCIN_THEMES,
  },
  {
    id: "color-hunt",
    label: "Color Hunt",
    logoAlt: "Color Hunt palette pack",
    logoSrc: "/brand/color-hunt-logo-face.png",
    previewSwatches: COLOR_HUNT_PREVIEW_SWATCHES,
    themes: COLOR_HUNT_THEMES,
  },
] as const satisfies readonly ThemePack[];

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return APP_THEMES.some((theme) => theme.value === value);
}

export function resolveAppTheme(value: string | null | undefined): AppTheme {
  return isAppTheme(value) ? value : DEFAULT_THEME;
}

export function getThemeOption(theme: AppTheme): ThemeOption {
  return APP_THEMES.find((option) => option.value === theme) ?? APP_THEMES[0];
}

export function isCatppuccinTheme(value: string | null | undefined): value is CatppuccinTheme {
  return CATPPUCCIN_THEMES.some((theme) => theme.value === value);
}

export function resolveCatppuccinTheme(value: string | null | undefined): CatppuccinTheme {
  return isCatppuccinTheme(value) ? value : DEFAULT_CATPPUCCIN_THEME;
}
