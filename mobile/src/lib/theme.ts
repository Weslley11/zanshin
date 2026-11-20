import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeId = "aurora" | "oceano" | "por-do-sol" | "floresta" | "classico";
export type MotionPref = "full" | "reduced";

const light = {
  bg: "#F5F4FF",
  surface: "#FFFFFF",
  surfaceAlt: "#EEEBFB",
  /** Cartões translúcidos sobre o fundo animado ("vidro"). */
  card: "rgba(255,255,255,0.78)",
  border: "#E3E0F3",
  text: "#13111F",
  textMuted: "#66637E",
  primary: "#7C5CFF",
  primaryText: "#FFFFFF",
  primarySoft: "#EDE8FF",
  accent: "#0EA5E9",
  accentSoft: "#E0F4FD",
  success: "#16A34A",
  successSoft: "#DCF5E5",
  warning: "#B7791F",
  warningSoft: "#FDF1DA",
  danger: "#E03131",
  dangerSoft: "#FDE3E3",
  chartGrid: "#E3E0F3",
  shadow: "rgba(46, 28, 140, 0.14)",
  glass: "rgba(255,255,255,0.22)",
};

const dark: typeof light = {
  bg: "#07060F",
  surface: "#14121F",
  surfaceAlt: "#1E1B2D",
  card: "rgba(22,20,36,0.72)",
  border: "#2A2740",
  text: "#F4F2FF",
  textMuted: "#A6A2C2",
  primary: "#9B85FF",
  primaryText: "#FFFFFF",
  primarySoft: "#272048",
  accent: "#38BDF8",
  accentSoft: "#10283A",
  success: "#4ADE80",
  successSoft: "#13301F",
  warning: "#F2C14E",
  warningSoft: "#33280F",
  danger: "#FF6B6B",
  dangerSoft: "#3A1715",
  chartGrid: "#2A2740",
  shadow: "rgba(0, 0, 0, 0.5)",
  glass: "rgba(255,255,255,0.16)",
};

export type Palette = typeof light;

/** Gradientes de cada módulo (texto branco por cima). "brand", "tutor", "speak" e "progress" mudam com o tema. */
export const gradients = {
  speak: ["#FF6A3D", "#FF2E7E"],
  brand: ["#7C5CFF", "#00C2FF"],
  tutor: ["#7C5CFF", "#B26CFF"],
  unlock: ["#FF6A3D", "#FF2E7E"],
  listening: ["#00A6A6", "#3DD6F5"],
  shadowing: ["#E8437B", "#FF8FB1"],
  vocab: ["#0F9F6E", "#3DDC97"],
  scenarios: ["#2563EB", "#56CCF2"],
  india: ["#FF8A00", "#F2C94C"],
  usa: ["#1E40AF", "#E11D48"],
  maps: ["#8B5CF6", "#06B6D4"],
  plan: ["#7F5AF0", "#2CB67D"],
  assessment: ["#F08C00", "#FFD43B"],
  errors: ["#D6336C", "#FF8787"],
  documents: ["#495057", "#8B95A1"],
  progress: ["#2F80ED", "#9B51E0"],
} as const;
export type GradientName = keyof typeof gradients;
type Gradients = Record<GradientName, readonly string[]>;

type ThemeDef = {
  name_pt: string;
  description_pt: string;
  light: Partial<Palette>;
  dark: Partial<Palette>;
  gradients: Partial<Gradients>;
  /** Cores das "manchas" de luz do fundo animado. */
  blobs: [string, string, string];
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  aurora: {
    name_pt: "Aurora", description_pt: "Violeta e ciano, com luzes em movimento",
    light: {}, dark: {},
    gradients: { brand: ["#7C5CFF", "#00C2FF"], tutor: ["#7C5CFF", "#B26CFF"], progress: ["#7C5CFF", "#00C2FF"] },
    blobs: ["#7C5CFF", "#00C2FF", "#FF5FA2"],
  },
  oceano: {
    name_pt: "Oceano", description_pt: "Azuis calmos e turquesa",
    light: { primary: "#0284C7", primarySoft: "#E0F2FE", bg: "#F2F8FC", surfaceAlt: "#E6F1F8", border: "#D9E8F2" },
    dark: { primary: "#38BDF8", primarySoft: "#0C2A3D", bg: "#04101A", surface: "#0C1A26", surfaceAlt: "#132433", border: "#1C3446", card: "rgba(12,26,38,0.72)" },
    gradients: { brand: ["#0284C7", "#22D3EE"], tutor: ["#2563EB", "#22D3EE"], progress: ["#0284C7", "#22D3EE"], speak: ["#06B6D4", "#3B82F6"] },
    blobs: ["#0EA5E9", "#22D3EE", "#6366F1"],
  },
  "por-do-sol": {
    name_pt: "Pôr do sol", description_pt: "Laranja, coral e rosa — cheio de energia",
    light: { primary: "#EA580C", primarySoft: "#FFEDD5", bg: "#FFF7F2", surfaceAlt: "#FCEDE4", border: "#F5DFD2" },
    dark: { primary: "#FB923C", primarySoft: "#3A1C0C", bg: "#140906", surface: "#1E120D", surfaceAlt: "#2A1A12", border: "#3A261B", card: "rgba(30,18,13,0.72)" },
    gradients: { brand: ["#F97316", "#EC4899"], tutor: ["#F97316", "#F43F5E"], progress: ["#F97316", "#EC4899"], speak: ["#F43F5E", "#F59E0B"] },
    blobs: ["#F97316", "#EC4899", "#FACC15"],
  },
  floresta: {
    name_pt: "Floresta", description_pt: "Verdes frescos e lima",
    light: { primary: "#059669", primarySoft: "#D1FAE5", bg: "#F3FAF6", surfaceAlt: "#E5F3EB", border: "#D5E9DD" },
    dark: { primary: "#34D399", primarySoft: "#0B2E22", bg: "#04110C", surface: "#0B1C15", surfaceAlt: "#11281E", border: "#1A392B", card: "rgba(11,28,21,0.72)" },
    gradients: { brand: ["#059669", "#84CC16"], tutor: ["#047857", "#10B981"], progress: ["#059669", "#84CC16"], speak: ["#10B981", "#0EA5E9"] },
    blobs: ["#10B981", "#84CC16", "#22D3EE"],
  },
  classico: {
    name_pt: "Clássico", description_pt: "O visual original, sem luzes no fundo",
    light: { primary: "#6C5CE7", primarySoft: "#ECE9FF", bg: "#F4F3FA", card: "#FFFFFF" },
    dark: { primary: "#8B7CFF", primarySoft: "#262046", bg: "#0B0A14", surface: "#161522", card: "#161522" },
    gradients: { brand: ["#6C5CE7", "#A66CFF"], tutor: ["#6C5CE7", "#A66CFF"], progress: ["#2F80ED", "#9B51E0"] },
    blobs: ["#6C5CE7", "#A66CFF", "#2F80ED"],
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 };
export const font = { display: 34, h1: 28, h2: 22, h3: 18, body: 16, small: 14, tiny: 12 };

/** Fonte da marca (Plus Jakarta Sans) por peso; cai na fonte do sistema se ainda não carregou. */
const FAMILY: Record<string, string> = {
  "400": "PlusJakartaSans_400Regular", normal: "PlusJakartaSans_400Regular", "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold", "700": "PlusJakartaSans_700Bold", bold: "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold", "900": "PlusJakartaSans_800ExtraBold",
};
let fontsLoaded = false;
export const setFontsLoaded = (v: boolean) => { fontsLoaded = v; };
export function fontFamily(weight?: string | number): string | undefined {
  if (!fontsLoaded) return undefined;
  return FAMILY[String(weight ?? "400")] ?? FAMILY["400"];
}

export const ThemeModeContext = createContext<{
  mode: ThemeMode; setMode: (m: ThemeMode) => void;
  themeId: ThemeId; setThemeId: (t: ThemeId) => void;
  motion: MotionPref; setMotion: (m: MotionPref) => void;
}>({ mode: "system", setMode: () => {}, themeId: "aurora", setThemeId: () => {}, motion: "full", setMotion: () => {} });

export function useTheme(): {
  c: Palette; dark: boolean; g: Gradients; themeId: ThemeId; theme: ThemeDef; reduceMotion: boolean;
} {
  const system = useColorScheme();
  const systemReduced = useReducedMotion();
  const { mode, themeId, motion } = useContext(ThemeModeContext);
  const isDark = mode === "dark" || (mode === "system" && system === "dark");
  const theme = THEMES[themeId] ?? THEMES.aurora;
  const c = { ...(isDark ? dark : light), ...(isDark ? theme.dark : theme.light) } as Palette;
  const g = { ...gradients, ...theme.gradients } as Gradients;
  return { c, dark: isDark, g, themeId, theme, reduceMotion: motion === "reduced" || !!systemReduced };
}
