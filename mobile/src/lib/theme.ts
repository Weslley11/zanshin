import { useColorScheme } from "react-native";
import { createContext, useContext } from "react";

export type ThemeMode = "system" | "light" | "dark";

const light = {
  bg: "#F6F5F2",
  surface: "#FFFFFF",
  surfaceAlt: "#EFEDE8",
  border: "#E2DFD8",
  text: "#14161A",
  textMuted: "#5D6470",
  primary: "#E8553A",
  primaryText: "#FFFFFF",
  primarySoft: "#FCE5DF",
  accent: "#2F6FDB",
  accentSoft: "#E3ECFB",
  success: "#1E8F5A",
  successSoft: "#DDF3E8",
  warning: "#B7791F",
  warningSoft: "#FBF0DB",
  danger: "#C8372D",
  dangerSoft: "#F9E1DF",
  chartGrid: "#E2DFD8",
};

const dark: typeof light = {
  bg: "#0F1115",
  surface: "#171A20",
  surfaceAlt: "#1F232B",
  border: "#2A2F38",
  text: "#ECEEF1",
  textMuted: "#9AA2AE",
  primary: "#FF6E52",
  primaryText: "#140B08",
  primarySoft: "#3A1F19",
  accent: "#6EA1FF",
  accentSoft: "#1B2840",
  success: "#4CC38A",
  successSoft: "#14301F",
  warning: "#E3B45B",
  warningSoft: "#33280F",
  danger: "#FF7A70",
  dangerSoft: "#3A1715",
  chartGrid: "#2A2F38",
};

export type Palette = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const font = { h1: 28, h2: 22, h3: 18, body: 16, small: 14, tiny: 12 };

export const ThemeModeContext = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>({
  mode: "system",
  setMode: () => {},
});

export function useTheme(): { c: Palette; dark: boolean } {
  const system = useColorScheme();
  const { mode } = useContext(ThemeModeContext);
  const isDark = mode === "dark" || (mode === "system" && system === "dark");
  return { c: isDark ? dark : light, dark: isDark };
}
