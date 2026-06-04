export type CatppuccinTheme = "latte" | "frappe" | "macchiato" | "mocha";

export type CatppuccinThemeOption = {
  value: CatppuccinTheme;
  label: string;
  description: string;
  dark: boolean;
  swatches: readonly string[];
};

export const DEFAULT_CATPPUCCIN_THEME: CatppuccinTheme = "mocha";

export const CATPPUCCIN_THEMES = [
  {
    value: "latte",
    label: "Latte",
    description: "Bright panels with mauve command accents.",
    dark: false,
    swatches: ["#e6e9ef", "#eff1f5", "#ccd0da", "#8839ef", "#fe640b"],
  },
  {
    value: "frappe",
    label: "Frappé",
    description: "Muted dusk surfaces with lavender and peach.",
    dark: true,
    swatches: ["#292c3c", "#303446", "#414559", "#ca9ee6", "#ef9f76"],
  },
  {
    value: "macchiato",
    label: "Macchiato",
    description: "Medium contrast with mauve and warm peach.",
    dark: true,
    swatches: ["#1e2030", "#24273a", "#363a4f", "#c6a0f6", "#f5a97f"],
  },
  {
    value: "mocha",
    label: "Mocha",
    description: "Deep theater mode with mauve and amber contrast.",
    dark: true,
    swatches: ["#181825", "#1e1e2e", "#313244", "#cba6f7", "#fab387"],
  },
] as const satisfies readonly CatppuccinThemeOption[];

export function isCatppuccinTheme(value: string | null | undefined): value is CatppuccinTheme {
  return CATPPUCCIN_THEMES.some((theme) => theme.value === value);
}

export function resolveCatppuccinTheme(value: string | null | undefined): CatppuccinTheme {
  return isCatppuccinTheme(value) ? value : DEFAULT_CATPPUCCIN_THEME;
}

export function getCatppuccinThemeOption(theme: CatppuccinTheme): CatppuccinThemeOption {
  return CATPPUCCIN_THEMES.find((option) => option.value === theme) ?? CATPPUCCIN_THEMES[0];
}
