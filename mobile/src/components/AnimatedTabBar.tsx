import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
// Tipos mínimos da barra de abas (expo-router/js-tabs repassa as props do React Navigation)
type BottomTabBarProps = { state: { index: number; routes: { key: string; name: string }[] }; descriptors: Record<string, { options: { title?: string } }> };
const TAB_HREF: Record<string, string> = { index: "/", learn: "/learn", practice: "/practice", vocab: "/vocab", profile: "/profile" };
import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tap } from "../lib/haptics";
import { fontFamily, useTheme } from "../lib/theme";
import { Gradient } from "./ui";

type Name = ComponentProps<typeof Ionicons>["name"];
export const TAB_ICONS: Record<string, Name> = { index: "home", learn: "footsteps", practice: "grid", vocab: "albums", profile: "person-circle" };

function TabItem({ focused, label, icon, onPress }: { focused: boolean; label: string; icon: Name; onPress: () => void }) {
  const { c, reduceMotion } = useTheme();
  const s = useSharedValue(1);
  const y = useSharedValue(0);
  useEffect(() => {
    if (focused && !reduceMotion) {
      s.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1.12, { damping: 6, stiffness: 260 }), withSpring(1, { damping: 12 }));
      y.value = withSequence(withTiming(-5, { duration: 120 }), withSpring(0, { damping: 8 }));
    }
  }, [focused]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { translateY: y.value }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 6 }}>
      <Animated.View style={anim}>
        <Ionicons name={focused ? icon : (`${icon}-outline` as Name)} size={23} color={focused ? "#fff" : c.textMuted} />
      </Animated.View>
      <Animated.Text style={{ fontSize: 11, fontWeight: "700", fontFamily: fontFamily("700"), color: focused ? "#fff" : c.textMuted }}>{label}</Animated.Text>
    </Pressable>
  );
}

/** Barra de abas flutuante com "pílula" em gradiente que desliza até a aba ativa. */
export function AnimatedTabBar({ state, descriptors }: BottomTabBarProps) {
  const { c, dark, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TAB_ICONS[r.name]);
  const activeIdx = routes.findIndex((r) => r.key === state.routes[state.index].key);
  const [w, setW] = useState(0);
  const tabW = routes.length ? w / routes.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    if (activeIdx < 0) return;
    x.value = reduceMotion ? activeIdx * tabW : withSpring(activeIdx * tabW, { damping: 18, stiffness: 180 });
  }, [activeIdx, tabW]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 10), paddingTop: 6, backgroundColor: "transparent" }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width - 12)}
        style={[styles.bar, { backgroundColor: dark ? "rgba(20,18,32,0.92)" : "rgba(255,255,255,0.94)", borderColor: c.border, shadowColor: c.shadow }]}>
        {tabW > 0 && activeIdx >= 0 ? (
          <Animated.View style={[{ position: "absolute", left: 6, top: 6, bottom: 6, width: tabW }, pill]}>
            <Gradient name="brand" style={{ flex: 1, borderRadius: 18 }} />
          </Animated.View>
        ) : null}
        {routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const focused = i === activeIdx;
          return (
            <TabItem key={route.key} focused={focused} label={label} icon={TAB_ICONS[route.name]}
              onPress={() => {
                if (focused) return;
                tap();
                router.navigate(TAB_HREF[route.name] as any);
              }} />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderRadius: 24, padding: 6, borderWidth: StyleSheet.hairlineWidth, shadowOpacity: 0.25, shadowRadius: 20,
         shadowOffset: { width: 0, height: 8 }, elevation: 10 },
});
