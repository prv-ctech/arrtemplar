export type CatppuccinTheme = "latte" | "frappe" | "macchiato" | "mocha";

export type CatppuccinThemeOption = {
  value: CatppuccinTheme;
  label: string;
  description: string;
  dark: boolean;
};

export const DEFAULT_CATPPUCCIN_THEME: CatppuccinTheme = "mocha";

export const CATPPUCCIN_PREVIEW_SWATCHES = [
  "var(--catppuccin-color-mantle)",
  "var(--catppuccin-color-base)",
  "var(--catppuccin-color-surface0)",
  "var(--catppuccin-color-mauve)",
  "var(--catppuccin-color-peach)",
] as const;

export const CATPPUCCIN_THEMES = [
  {
    value: "latte",
    label: "Latte",
    description: "Light flavor with calm base panels and mauve accents.",
    dark: false,
  },
  {
    value: "frappe",
    label: "Frappé",
    description: "Subdued dark flavor with softer contrast.",
    dark: true,
  },
  {
    value: "macchiato",
    label: "Macchiato",
    description: "Medium-contrast dark flavor with gentle colors.",
    dark: true,
  },
  {
    value: "mocha",
    label: "Mocha",
    description: "Original darkest flavor with cozy contrast.",
    dark: true,
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
