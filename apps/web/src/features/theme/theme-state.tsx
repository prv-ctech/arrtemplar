import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  CATPPUCCIN_THEMES,
  type CatppuccinTheme,
  DEFAULT_CATPPUCCIN_THEME,
  getCatppuccinThemeOption,
  resolveCatppuccinTheme,
} from "./theme-options";

const THEME_STORAGE_KEY = "arrtemplar.catppuccin-theme";

type ThemeContextValue = {
  theme: CatppuccinTheme;
  selectedTheme: ReturnType<typeof getCatppuccinThemeOption>;
  themes: typeof CATPPUCCIN_THEMES;
  setTheme: (theme: CatppuccinTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): CatppuccinTheme {
  if (typeof window === "undefined") {
    return DEFAULT_CATPPUCCIN_THEME;
  }

  try {
    return resolveCatppuccinTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_CATPPUCCIN_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<CatppuccinTheme>(readStoredTheme);
  const selectedTheme = getCatppuccinThemeOption(theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.remove(...CATPPUCCIN_THEMES.map((option) => option.value));
    root.classList.add(theme);
    root.style.colorScheme = selectedTheme.dark ? "dark" : "light";

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Persisting the theme is progressive enhancement; the active theme is already applied.
    }
  }, [selectedTheme.dark, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      selectedTheme,
      themes: CATPPUCCIN_THEMES,
      setTheme: setThemeState,
    }),
    [selectedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
