import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";

const light = {
  bg: "#F4F3FA",
  surface: "#FFFFFF",
  surfaceAlt: "#ECEAF5",
  border: "#E2E0EE",
  text: "#14121F",
  textMuted: "#6A6782",
  primary: "#6C5CE7",
  primaryText: "#FFFFFF",
  primarySoft: "#ECE9FF",
  accent: "#2F80ED",
  accentSoft: "#E4EEFD",
  success: "#16A34A",
  successSoft: "#DCF5E5",
  warning: "#B7791F",
  warningSoft: "#FDF1DA",
  danger: "#E03131",
  dangerSoft: "#FDE3E3",
  chartGrid: "#E2E0EE",
  shadow: "rgba(40, 28, 120, 0.12)",
  glass: "rgba(255,255,255,0.22)",
};

const dark: typeof light = {
  bg: "#0B0A14",
  surface: "#161522",
  surfaceAlt: "#201F2E",
  border: "#2B2A3C",
  text: "#F3F2FA",
  textMuted: "#A3A0BA",
  primary: "#8B7CFF",
  primaryText: "#FFFFFF",
  primarySoft: "#262046",
  accent: "#6EA1FF",
  accentSoft: "#1B2840",
  success: "#4ADE80",
  successSoft: "#13301F",
  warning: "#F2C14E",
  warningSoft: "#33280F",
  danger: "#FF6B6B",
  dangerSoft: "#3A1715",
  chartGrid: "#2B2A3C",
  shadow: "rgba(0, 0, 0, 0.45)",
  glass: "rgba(255,255,255,0.16)",
};

export type Palette = typeof light;

/** Gradientes de marca e de cada módulo (texto branco por cima). */
export const gradients = {
  speak: ["#FF6A3D", "#FF2E7E"],
  brand: ["#6C5CE7", "#A66CFF"],
  tutor: ["#6C5CE7", "#A66CFF"],
  unlock: ["#FF6A3D", "#FF2E7E"],
  listening: ["#00A6A6", "#3DD6F5"],
  shadowing: ["#E8437B", "#FF8FB1"],
  vocab: ["#0F9F6E", "#3DDC97"],
  scenarios: ["#2563EB", "#56CCF2"],
  india: ["#FF8A00", "#F2C94C"],
  plan: ["#7F5AF0", "#2CB67D"],
  assessment: ["#F08C00", "#FFD43B"],
  errors: ["#D6336C", "#FF8787"],
  documents: ["#495057", "#8B95A1"],
  progress: ["#2F80ED", "#9B51E0"],
} as const;
export type GradientName = keyof typeof gradients;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 };
export const font = { display: 34, h1: 28, h2: 22, h3: 18, body: 16, small: 14, tiny: 12 };

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
