import { APP_STORAGE_PREFIX } from "@arrtemplar/shared";
import { createContext, type ReactNode, use, useEffect, useMemo, useState } from "react";
import {
  APP_THEMES,
  type AppTheme,
  DEFAULT_THEME,
  getThemeOption,
  resolveAppTheme,
  THEME_PACKS,
} from "./theme-options";

const THEME_STORAGE_KEY = `${APP_STORAGE_PREFIX}.theme`;

type ThemeContextValue = {
  theme: AppTheme;
  selectedTheme: ReturnType<typeof getThemeOption>;
  themePacks: typeof THEME_PACKS;
  themes: typeof APP_THEMES;
  setTheme: (theme: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    return resolveAppTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme);
  const selectedTheme = getThemeOption(theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.remove(...APP_THEMES.map((option) => option.value));
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
      themePacks: THEME_PACKS,
      themes: APP_THEMES,
      setTheme: setThemeState,
    }),
    [selectedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = use(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
