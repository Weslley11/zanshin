import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, ZoomIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { BRANCH_COLORS, branchAngles, polar, type MindMap } from "../lib/mindMaps";
import { useTheme } from "../lib/theme";
import { PressableScale } from "./motion";
import { Gradient, Icon, Text } from "./ui";
import type { IconName } from "./ui";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type LeafStatus = "ok" | "almost" | "miss" | "pending";

/** Linha curva do centro até o ramo, "desenhada" ao aparecer. */
function Branchline({ d, color, length, delay, dim, reduce }: { d: string; color: string; length: number; delay: number; dim: boolean; reduce: boolean }) {
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) p.value = withDelay(delay, withTiming(1, { duration: 650 }));
  }, []);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - p.value) }));
  return <AnimatedPath d={d} stroke={color} strokeWidth={5} strokeLinecap="round" fill="none" opacity={dim ? 0.25 : 0.9}
    strokeDasharray={`${length} ${length}`} animatedProps={props} />;
}

/**
 * Mapa radial: o tema no centro e 4 ramos coloridos. Os pontinhos de cada ramo mostram o estado das frases
 * (verde = lembrou, amarelo = quase, vermelho = não lembrou, cinza = ainda não).
 */
export function MindMapView({ map, status = {}, focus, onBranch, showPt = true }: {
  map: MindMap; status?: Record<string, LeafStatus>; focus?: string | null; onBranch?: (id: string) => void; showPt?: boolean;
}) {
  const { c, reduceMotion } = useTheme();
  const [w, setW] = useState(0);
  const h = Math.round(w * 0.82);
  const cx = w / 2;
  const cy = h / 2;
  const angles = branchAngles(map.branches.length);
  const r = w * 0.34;
  const nodeW = Math.min(158, w * 0.42);
  const dot = (s: LeafStatus) => (s === "ok" ? c.success : s === "almost" ? "#F2B705" : s === "miss" ? c.danger : c.border);

  return (
    <View onLayout={(e) => setW(Math.min(e.nativeEvent.layout.width, 480))} style={{ width: "100%", alignItems: "center" }}
      accessibilityLabel={`Mapa mental: ${map.center_en}`}>
      {w > 0 ? (
        <View style={{ width: w, height: h }}>
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            {map.branches.map((b, k) => {
              const [x, y] = polar(cx, cy, r, angles[k]);
              const [mx, my] = polar(cx, cy, r * 0.55, angles[k] + (k % 2 ? 14 : -14));
              return <Branchline key={b.id} d={`M ${cx} ${cy} Q ${mx} ${my} ${x} ${y}`} color={BRANCH_COLORS[k % BRANCH_COLORS.length]}
                length={r * 1.15} delay={120 + k * 110} dim={!!focus && focus !== b.id} reduce={reduceMotion} />;
            })}
          </Svg>

          {map.branches.map((b, k) => {
            const [x, y] = polar(cx, cy, r, angles[k]);
            const color = BRANCH_COLORS[k % BRANCH_COLORS.length];
            const dim = !!focus && focus !== b.id;
            const left = Math.max(0, Math.min(w - nodeW, x - nodeW / 2));
            const node = (
              <View style={{ width: nodeW, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10, gap: 3, alignItems: "center",
                             backgroundColor: c.surface, borderWidth: 2, borderColor: color, opacity: dim ? 0.4 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Icon name={b.icon as IconName} size={14} color={color} />
                  <Text variant="small" weight="800" numberOfLines={2} center style={{ flexShrink: 1 }}>{b.en}</Text>
                </View>
                {showPt ? <Text variant="tiny" muted numberOfLines={1} center>{b.pt}</Text> : null}
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {b.leaves.map((l) => <View key={l.id} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot(status[l.id] ?? "pending") }} />)}
                </View>
              </View>
            );
            return (
              <Animated.View key={b.id} entering={reduceMotion ? undefined : ZoomIn.delay(260 + k * 110).springify().damping(14)}
                style={{ position: "absolute", left, top: y - 34 }}>
                {onBranch ? (
                  <PressableScale onPress={() => onBranch(b.id)} accessibilityLabel={`Ramo ${b.en}`}>{node}</PressableScale>
                ) : node}
              </Animated.View>
            );
          })}

          <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
            style={{ position: "absolute", left: cx - 62, top: cy - 40, width: 124, height: 80 }}>
            <Gradient name="maps" style={{ flex: 1, borderRadius: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
              <Text weight="800" color="#fff" center numberOfLines={2}>{map.center_en}</Text>
              {showPt ? <Text variant="tiny" color="rgba(255,255,255,0.9)" center numberOfLines={1}>{map.center_pt}</Text> : null}
            </Gradient>
          </Animated.View>
        </View>
      ) : <View style={{ height: 240 }} />}
    </View>
  );
}
