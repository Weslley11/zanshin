import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../lib/theme";

/** Mancha de luz suave (gradiente radial) que se move devagar — o "movimento" de fundo do tema. */
function Blob({ color, size, x, y, dx, dy, duration, opacity, still }: {
  color: string; size: number; x: number; y: number; dx: number; dy: number; duration: number; opacity: number; still: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!still) t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [still]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x + dx * t.value }, { translateY: y + dy * t.value }, { scale: 1 + 0.12 * t.value }],
  }));
  const id = `b${color.slice(1)}${size}`;
  return (
    <Animated.View style={[{ position: "absolute", width: size, height: size, opacity }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.9} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Fundo animado do tema (luzes coloridas em movimento lento). Desligado no tema Clássico e com "animações reduzidas" fica parado. */
export function Aurora({ intensity = 1 }: { intensity?: number }) {
  const { theme, themeId, dark, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  if (themeId === "classico") return null;
  const [a, b, c] = theme.blobs;
  const base = (dark ? 0.55 : 0.32) * intensity;
  const s = Math.max(width, 420);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Blob color={a} size={s * 1.1} x={-s * 0.45} y={-s * 0.5} dx={s * 0.25} dy={s * 0.18} duration={14000} opacity={base} still={reduceMotion} />
      <Blob color={b} size={s * 0.95} x={width - s * 0.5} y={height * 0.18} dx={-s * 0.22} dy={s * 0.25} duration={17000} opacity={base * 0.85} still={reduceMotion} />
      <Blob color={c} size={s * 0.85} x={-s * 0.2} y={height * 0.62} dx={s * 0.3} dy={-s * 0.2} duration={20000} opacity={base * 0.6} still={reduceMotion} />
    </View>
  );
}
