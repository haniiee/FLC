import { tokens, type ThemeColors, type ThemeMode } from "@app/brand";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  loadAppearancePreference,
  saveAppearancePreference,
  type AppearancePreference,
} from "./appearance-store";

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ThemeMode;
  preference: AppearancePreference;
  isDark: boolean;
  setPreference: (value: AppearancePreference) => void;
  cardShadow: typeof tokens.shadows.light.card | null;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>("system");

  useEffect(() => {
    void loadAppearancePreference().then((value) => {
      setPreferenceState(value);
    });
  }, []);

  const setPreference = useCallback((value: AppearancePreference) => {
    setPreferenceState(value);
    // Avoid Appearance.setColorScheme: Android NPE on null/"unspecified" in RN 0.88.
    // Theme mode is derived from preference + useColorScheme instead.
    void saveAppearancePreference(value);
  }, []);

  const mode: ThemeMode =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === "dark";
    return {
      colors: tokens.themes[mode],
      mode,
      preference,
      isDark,
      setPreference,
      cardShadow: isDark ? null : tokens.shadows.light.card,
    };
  }, [mode, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
