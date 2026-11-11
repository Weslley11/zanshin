/** Componentes de motion (Reanimated): pressão com mola, anéis animados, ondas do microfone, digitação, cartão giratório, celebração. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import confettiAnim from "../assets/lottie/confetti.json";
import trophyAnim from "../assets/lottie/trophy.json";
import { tap } from "../lib/haptics";
import { useTheme } from "../lib/theme";
import Lottie from "./Lottie";

/** Botão/cartão que "afunda" com mola ao toque, com retorno tátil. */
export function PressableScale({ children, onPress, style, disabled, accessibilityLabel, accessibilityRole = "button", scaleTo = 0.965 }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean; accessibilityLabel?: string;
  accessibilityRole?: "button" | "link" | "tab" | "radio" | "checkbox"; scaleTo?: number;
}) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => (s.value = withSpring(scaleTo, { damping: 18, stiffness: 320 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 14, stiffness: 260 }))}
      onPress={() => {
        tap();
        onPress?.();
      }}
    >
      <Animated.View style={[style, anim, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Entrada escalonada (fade + subida com mola). */
export function Enter({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 12) * 55).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Interpola um número ao longo do tempo (usado por contadores e anéis). */
export function useTween(target: number, duration = 900): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const cur = a + (target - a) * e;
      setV(cur);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export function AnimatedNumber({ value, decimals = 0, suffix = "", render }: { value: number; decimals?: number; suffix?: string;
  render?: (s: string) => ReactNode }) {
  const v = useTween(value);
  const s = `${v.toFixed(decimals)}${suffix}`;
  return <>{render ? render(s) : s}</>;
}

/** Anel de progresso com gradiente que se preenche ao aparecer. */
export function ProgressRing({ value, size = 96, stroke = 10, colors = ["#6C5CE7", "#A66CFF"], track, children }: {
  value: number; size?: number; stroke?: number; colors?: readonly string[]; track?: string; children?: ReactNode;
}) {
  const { c } = useTheme();
  const pct = useTween(Math.max(0, Math.min(1, value)), 1100);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const id = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1] ?? colors[0]} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Anéis que pulsam em volta do microfone (ativo ou convidando a falar). */
export function PulseRings({ size = 72, color = "#FF2E7E", active = true, rings = 3 }: { size?: number; color?: string; active?: boolean; rings?: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      {Array.from({ length: rings }).map((_, i) => <Ring key={i} i={i} size={size} color={color} active={active} rings={rings} />)}
    </View>
  );
}
function Ring({ i, size, color, active, rings }: { i: number; size: number; color: string; active: boolean; rings: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = active ? withDelay(i * (1600 / rings), withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)) : withTiming(0);
  }, [active]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.1, 1], [0, 0.45, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [1, 1.9]) }],
  }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/** Barras de onda sonora animadas enquanto o microfone grava. */
export function Waveform({ active, color = "#FFFFFF", bars = 18, height = 34 }: { active: boolean; color?: string; bars?: number; height?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height }} accessibilityElementsHidden importantForAccessibility="no">
      {Array.from({ length: bars }).map((_, i) => <Bar key={i} i={i} active={active} color={color} height={height} />)}
    </View>
  );
}
function Bar({ i, active, color, height }: { i: number; active: boolean; color: string; height: number }) {
  const h = useSharedValue(0.2);
  useEffect(() => {
    if (!active) {
      h.value = withTiming(0.2, { duration: 250 });
      return;
    }
    const peaks = [0.9, 0.35, 0.7, 0.5, 1, 0.3];
    h.value = withDelay((i % 6) * 70, withRepeat(withSequence(
      withTiming(peaks[i % 6], { duration: 260 + (i % 4) * 60 }), withTiming(0.25, { duration: 240 + (i % 3) * 70 })), -1, true));
  }, [active]);
  const style = useAnimatedStyle(() => ({ height: Math.max(4, h.value * height) }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: color }, style]} />;
}

/** "Digitando…" com três pontos saltitantes. */
export function TypingDots({ color }: { color?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 5, padding: 14 }} accessibilityLabel="O tutor está respondendo">
      {[0, 1, 2].map((i) => <Dot key={i} i={i} color={color ?? c.textMuted} />)}
    </View>
  );
}
function Dot({ i, color }: { i: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(i * 140, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1, false));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

/** Cartão que gira (frente/verso) — usado na revisão de vocabulário. */
export function FlipCard({ flipped, front, back, style }: { flipped: boolean; front: ReactNode; back: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withSpring(flipped ? 1 : 0, { damping: 16, stiffness: 140 });
  }, [flipped]);
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(t.value, [0, 1], [0, 180])}deg` }],
    opacity: t.value < 0.5 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(t.value, [0, 1], [-180, 0])}deg` }],
    opacity: t.value >= 0.5 ? 1 : 0,
  }));
  return (
    <View style={style}>
      <Animated.View style={[frontStyle, { backfaceVisibility: "hidden" }]} pointerEvents={flipped ? "none" : "auto"}>{front}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle, { backfaceVisibility: "hidden" }]} pointerEvents={flipped ? "auto" : "none"}>{back}</Animated.View>
    </View>
  );
}

/** Celebração (confete + troféu em Lottie) que toca uma vez sobre a tela. */
export function Celebration({ show, trophy = true, onDone }: { show: boolean; trophy?: boolean; onDone?: () => void }) {
  useEffect(() => {
    if (show) tap("success");
  }, [show]);
  if (!show) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", zIndex: 50 }]}>
      <Lottie source={confettiAnim} loop={false} style={{ width: 420, height: 420, position: "absolute" }} onFinish={onDone} />
      {trophy ? <Lottie source={trophyAnim} loop={false} style={{ width: 180, height: 180 }} /> : null}
    </View>
  );
}

/** Flutuação suave contínua (para ícones e ilustrações). */
export function Float({ children, amplitude = 6, duration = 2400 }: { children: ReactNode; amplitude?: number; duration?: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(-amplitude, { duration, easing: Easing.inOut(Easing.sin) }),
                                      withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
