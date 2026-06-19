export type CatppuccinTheme = "latte" | "frappe" | "macchiato" | "mocha";
export type ColorHuntTheme =
  | "color-hunt-midnight"
  | "color-hunt-slate-ember"
  | "color-hunt-soft-sky"
  | "color-hunt-neon-tide"
  | "color-hunt-ruby-dusk"
  | "color-hunt-crimson-depths"
  | "color-hunt-ember-void"
  | "color-hunt-rose-noir"
  | "color-hunt-clay-glow"
  | "color-hunt-blush-cream"
  | "color-hunt-harvest-signal"
  | "color-hunt-cloud-peach";
export type ThemeParkTheme =
  | "theme-park-aquamarine"
  | "theme-park-dark"
  | "theme-park-dracula"
  | "theme-park-hotline"
  | "theme-park-hotpink"
  | "theme-park-maroon"
  | "theme-park-nord"
  | "theme-park-organizr"
  | "theme-park-overseerr"
  | "theme-park-plex"
  | "theme-park-space-gray";
export type ArrbitTheme = "arrbit-radioactive" | "arrbit-retro-gaming";
export type AppTheme = CatppuccinTheme | ColorHuntTheme | ThemeParkTheme | ArrbitTheme;
export type ThemePackId = "catppuccin" | "color-hunt" | "theme-park" | "arrbit";

export type ThemeOption<TTheme extends AppTheme = AppTheme> = {
  value: TTheme;
  label: string;
  dark: boolean;
  previewSwatches?: readonly string[];
};

type CatppuccinThemeOption = ThemeOption<CatppuccinTheme>;
type ColorHuntThemeOption = ThemeOption<ColorHuntTheme>;
type ThemeParkThemeOption = ThemeOption<ThemeParkTheme>;
type ArrbitThemeOption = ThemeOption<ArrbitTheme>;

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

const CATPPUCCIN_LATTE_SWATCHES = ["#E6E9EF", "#EFF1F5", "#CCD0DA", "#8839EF", "#FE640B"] as const;
const CATPPUCCIN_FRAPPE_SWATCHES = ["#292C3C", "#303446", "#414559", "#CA9EE6", "#EF9F76"] as const;
const CATPPUCCIN_MACCHIATO_SWATCHES = [
  "#1E2030",
  "#24273A",
  "#363A4F",
  "#C6A0F6",
  "#F5A97F",
] as const;
export const CATPPUCCIN_PREVIEW_SWATCHES = [
  "#181825",
  "#1E1E2E",
  "#313244",
  "#CBA6F7",
  "#FAB387",
] as const;

export const COLOR_HUNT_PREVIEW_SWATCHES = ["#070F2B", "#1B1A55", "#535C91", "#9290C3"] as const;
const COLOR_HUNT_SLATE_EMBER_SWATCHES = ["#F5F5F5", "#76ABAE", "#303841", "#FF5722"] as const;
const COLOR_HUNT_SOFT_SKY_SWATCHES = ["#FFF9D2", "#FFEBCC", "#BFDDF0", "#8CC0EB"] as const;
const COLOR_HUNT_NEON_TIDE_SWATCHES = ["#364F6B", "#3FC1C9", "#F5F5F5", "#FC5185"] as const;
const COLOR_HUNT_RUBY_DUSK_SWATCHES = ["#2B2E4A", "#E84545", "#903749", "#53354A"] as const;
const COLOR_HUNT_CRIMSON_DEPTHS_SWATCHES = ["#050E3C", "#002455", "#DC0000", "#FF3838"] as const;
const COLOR_HUNT_EMBER_VOID_SWATCHES = ["#FF6500", "#1E3E62", "#0B192C", "#000000"] as const;
const COLOR_HUNT_ROSE_NOIR_SWATCHES = ["#F63049", "#D02752", "#8A244B", "#111F35"] as const;
const COLOR_HUNT_CLAY_GLOW_SWATCHES = ["#F4E7E1", "#FF9B45", "#D5451B", "#521C0D"] as const;
const COLOR_HUNT_BLUSH_CREAM_SWATCHES = ["#FFFBF1", "#FFF2D0", "#FFB2B2", "#E36A6A"] as const;
const COLOR_HUNT_HARVEST_SIGNAL_SWATCHES = ["#003049", "#D62828", "#F77F00", "#FCBF49"] as const;
const COLOR_HUNT_CLOUD_PEACH_SWATCHES = ["#C6E7FF", "#D4F6FF", "#FBFBFB", "#FFDDAE"] as const;
export const THEME_PARK_PREVIEW_SWATCHES = ["#0B3161", "#265C74", "#009688", "#12AFA0"] as const;
const THEME_PARK_DARK_SWATCHES = ["#000000", "#2D2D2D", "#7A7A7A", "#AAAAAA"] as const;
const THEME_PARK_DRACULA_SWATCHES = ["#282A36", "#1E2029", "#BD93F9", "#50FA7B"] as const;
const THEME_PARK_HOTLINE_SWATCHES = ["#155FA5", "#5E61AB", "#F765B8", "#F98DC9"] as const;
const THEME_PARK_HOTPINK_SWATCHES = ["#004249", "#204C80", "#FB3F62", "#00FF9D"] as const;
const THEME_PARK_MAROON_SWATCHES = ["#220A25", "#4C1533", "#7B154D", "#A21C65"] as const;
const THEME_PARK_NORD_SWATCHES = ["#2E3440", "#3B4252", "#79B8CA", "#D8DEE9"] as const;
const THEME_PARK_ORGANIZR_SWATCHES = ["#1F1F1F", "#333333", "#2CABE3", "#96A2B4"] as const;
const THEME_PARK_OVERSEERR_SWATCHES = ["#111827", "#1F2937", "#4F46E5", "#A78BFA"] as const;
const THEME_PARK_PLEX_SWATCHES = ["#000000", "#282828", "#CC7B19", "#E5A00D"] as const;
const THEME_PARK_SPACE_GRAY_SWATCHES = ["#253237", "#576C75", "#607D8B", "#81A6B7"] as const;
export const ARRBIT_PREVIEW_SWATCHES = [
  "#61892F",
  "#86C232",
  "#222629",
  "#474B4F",
  "#6B6E70",
] as const;
const ARRBIT_RETRO_GAMING_SWATCHES = [
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#1E1B4B",
  "#F5F3FF",
] as const;

export const CATPPUCCIN_THEMES = [
  {
    value: "latte",
    label: "Latte",
    dark: false,
    previewSwatches: CATPPUCCIN_LATTE_SWATCHES,
  },
  {
    value: "frappe",
    label: "Frappé",
    dark: true,
    previewSwatches: CATPPUCCIN_FRAPPE_SWATCHES,
  },
  {
    value: "macchiato",
    label: "Macchiato",
    dark: true,
    previewSwatches: CATPPUCCIN_MACCHIATO_SWATCHES,
  },
  {
    value: "mocha",
    label: "Mocha",
    dark: true,
    previewSwatches: CATPPUCCIN_PREVIEW_SWATCHES,
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
  {
    value: "color-hunt-crimson-depths",
    label: "Crimson Depths",
    dark: true,
    previewSwatches: COLOR_HUNT_CRIMSON_DEPTHS_SWATCHES,
  },
  {
    value: "color-hunt-ember-void",
    label: "Ember Void",
    dark: true,
    previewSwatches: COLOR_HUNT_EMBER_VOID_SWATCHES,
  },
  {
    value: "color-hunt-rose-noir",
    label: "Rose Noir",
    dark: true,
    previewSwatches: COLOR_HUNT_ROSE_NOIR_SWATCHES,
  },
  {
    value: "color-hunt-clay-glow",
    label: "Clay Glow",
    dark: false,
    previewSwatches: COLOR_HUNT_CLAY_GLOW_SWATCHES,
  },
  {
    value: "color-hunt-blush-cream",
    label: "Blush Cream",
    dark: false,
    previewSwatches: COLOR_HUNT_BLUSH_CREAM_SWATCHES,
  },
  {
    value: "color-hunt-harvest-signal",
    label: "Harvest Signal",
    dark: true,
    previewSwatches: COLOR_HUNT_HARVEST_SIGNAL_SWATCHES,
  },
  {
    value: "color-hunt-cloud-peach",
    label: "Cloud Peach",
    dark: false,
    previewSwatches: COLOR_HUNT_CLOUD_PEACH_SWATCHES,
  },
] as const satisfies readonly ColorHuntThemeOption[];

export const THEME_PARK_THEMES = [
  {
    value: "theme-park-aquamarine",
    label: "Aquamarine",
    dark: true,
    previewSwatches: THEME_PARK_PREVIEW_SWATCHES,
  },
  {
    value: "theme-park-dark",
    label: "Dark",
    dark: true,
    previewSwatches: THEME_PARK_DARK_SWATCHES,
  },
  {
    value: "theme-park-dracula",
    label: "Dracula",
    dark: true,
    previewSwatches: THEME_PARK_DRACULA_SWATCHES,
  },
  {
    value: "theme-park-hotline",
    label: "Hotline",
    dark: true,
    previewSwatches: THEME_PARK_HOTLINE_SWATCHES,
  },
  {
    value: "theme-park-hotpink",
    label: "Hotpink",
    dark: true,
    previewSwatches: THEME_PARK_HOTPINK_SWATCHES,
  },
  {
    value: "theme-park-maroon",
    label: "Maroon",
    dark: true,
    previewSwatches: THEME_PARK_MAROON_SWATCHES,
  },
  {
    value: "theme-park-nord",
    label: "Nord",
    dark: true,
    previewSwatches: THEME_PARK_NORD_SWATCHES,
  },
  {
    value: "theme-park-organizr",
    label: "Organizr",
    dark: true,
    previewSwatches: THEME_PARK_ORGANIZR_SWATCHES,
  },
  {
    value: "theme-park-overseerr",
    label: "Overseerr",
    dark: true,
    previewSwatches: THEME_PARK_OVERSEERR_SWATCHES,
  },
  {
    value: "theme-park-plex",
    label: "Plex",
    dark: true,
    previewSwatches: THEME_PARK_PLEX_SWATCHES,
  },
  {
    value: "theme-park-space-gray",
    label: "Space Gray",
    dark: true,
    previewSwatches: THEME_PARK_SPACE_GRAY_SWATCHES,
  },
] as const satisfies readonly ThemeParkThemeOption[];

export const ARRBIT_THEMES = [
  {
    value: "arrbit-radioactive",
    label: "Radioactive",
    dark: true,
    previewSwatches: ARRBIT_PREVIEW_SWATCHES,
  },
  {
    value: "arrbit-retro-gaming",
    label: "Retro Gaming",
    dark: true,
    previewSwatches: ARRBIT_RETRO_GAMING_SWATCHES,
  },
] as const satisfies readonly ArrbitThemeOption[];

export const APP_THEMES = [
  ...CATPPUCCIN_THEMES,
  ...COLOR_HUNT_THEMES,
  ...THEME_PARK_THEMES,
  ...ARRBIT_THEMES,
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
  {
    id: "theme-park",
    label: "Theme Park",
    logoAlt: "Theme Park theme pack",
    logoSrc: "/brand/theme-park-dev-logo.png",
    previewSwatches: THEME_PARK_PREVIEW_SWATCHES,
    themes: THEME_PARK_THEMES,
  },
  {
    id: "arrbit",
    label: "Arrbit",
    logoAlt: "Arrbit palette pack",
    logoSrc: "/brand/arrbit-mark.svg",
    previewSwatches: ARRBIT_PREVIEW_SWATCHES,
    themes: ARRBIT_THEMES,
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
