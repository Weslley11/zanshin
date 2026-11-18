import { useContext, useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { tap } from "../lib/haptics";
import { THEMES, ThemeModeContext, type MotionPref, type ThemeId, type ThemeMode, radius, useTheme } from "../lib/theme";
import { PressableScale } from "./motion";
import { Gradient, Icon, Segmented, Text } from "./ui";

function Swatch({ id, selected, onPress }: { id: ThemeId; selected: boolean; onPress: () => void }) {
  const { c, reduceMotion } = useTheme();
  const t = THEMES[id];
  const spin = useSharedValue(0);
  const pop = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) spin.value = withRepeat(withTiming(1, { duration: 6000 }), -1, false);
  }, [reduceMotion]);
  useEffect(() => {
    pop.value = withSpring(selected ? 1 : 0, { damping: 12 });
  }, [selected]);
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 0.9 + 0.1 * pop.value }], opacity: 0.25 + 0.75 * pop.value }));
  const brand = (t.gradients.brand ?? ["#7C5CFF", "#00C2FF"]) as readonly string[];
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityLabel={`Tema ${t.name_pt}`} style={{ flexBasis: "30%", flexGrow: 1 }}>
      <View style={{ alignItems: "center", gap: 6, padding: 10, borderRadius: radius.lg, borderWidth: 2,
                     borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.surface }}>
        <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[{ position: "absolute", width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: c.primary }, ring]} />
          <Gradient colors={brand} style={{ width: 50, height: 50, borderRadius: 25, overflow: "hidden" }}>
            <Animated.View style={[{ flex: 1 }, orbit]}>
              {t.blobs.map((b, i) => (
                <View key={i} style={{ position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: b, opacity: 0.85,
                                       left: [6, 26, 14][i], top: [8, 14, 28][i] }} />
              ))}
            </Animated.View>
          </Gradient>
          {selected ? (
            <View style={{ position: "absolute", right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary,
                           alignItems: "center", justifyContent: "center" }}>
              <Icon name="checkmark" size={14} color="#fff" />
            </View>
          ) : null}
        </View>
        <Text variant="small" weight="800" center>{t.name_pt}</Text>
      </View>
    </PressableScale>
  );
}

/** Seleção de tema (cores + fundo animado), modo claro/escuro e intensidade das animações. */
export function ThemePicker() {
  const { mode, setMode, themeId, setThemeId, motion, setMotion } = useContext(ThemeModeContext);
  const { theme } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {(Object.keys(THEMES) as ThemeId[]).map((id) => (
          <Swatch key={id} id={id} selected={themeId === id} onPress={() => { tap("success"); setThemeId(id); }} />
        ))}
      </View>
      <Text variant="small" muted center>{theme.description_pt}</Text>
      <Segmented<ThemeMode> value={mode} onChange={setMode}
        options={[{ value: "system", label: "Sistema" }, { value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
      <Segmented<MotionPref> value={motion} onChange={setMotion}
        options={[{ value: "full", label: "Animações completas" }, { value: "reduced", label: "Reduzidas" }]} />
    </View>
  );
}
