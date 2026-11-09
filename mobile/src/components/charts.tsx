import { View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../lib/theme";
import { Text } from "./ui";

/** Minutos por dia na semana, com linha da meta diária. */
export function WeekBars({ data, goal, width = 320, height = 140 }: {
  data: { date: string; minutes: number }[]; goal: number; width?: number; height?: number;
}) {
  const { c } = useTheme();
  const max = Math.max(goal * 1.25, ...data.map((d) => d.minutes), 1);
  const pad = 22;
  const bw = (width - pad) / data.length;
  const y = (v: number) => height - 18 - (v / max) * (height - 30);
  const days = ["D", "S", "T", "Q", "Q", "S", "S"];
  const summary = data.map((d) => `${d.date}: ${Math.round(d.minutes)} min`).join(", ");
  return (
    <View accessible accessibilityLabel={`Minutos por dia na última semana. Meta ${goal} minutos. ${summary}`}>
      <Svg width={width} height={height}>
        <Line x1={pad} x2={width} y1={y(goal)} y2={y(goal)} stroke={c.textMuted} strokeDasharray="4 4" strokeWidth={1} />
        <SvgText x={0} y={y(goal) + 4} fontSize={10} fill={c.textMuted}>{goal}</SvgText>
        {data.map((d, i) => {
          const h = Math.max(2, height - 18 - y(d.minutes));
          const met = d.minutes >= goal;
          const wd = new Date(d.date + "T12:00:00").getDay();
          return (
            <G key={d.date}>
              <Rect x={pad + i * bw + bw * 0.2} y={height - 18 - h} width={bw * 0.6} height={h} rx={4}
                fill={met ? c.success : d.minutes > 0 ? c.primary : c.surfaceAlt} />
              <SvgText x={pad + i * bw + bw / 2} y={height - 4} fontSize={11} fill={c.textMuted} textAnchor="middle">{days[wd]}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const CEFR_TICKS: [string, number][] = [["A2", 25], ["B1", 45], ["B2", 65], ["C1", 82]];

/** Barras horizontais 0–100 por competência, com marcos CEFR. */
export function SkillBars({ skills }: { skills: { label: string; score: number | null }[] }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {skills.map((s) => (
        <View key={s.label} accessible accessibilityLabel={`${s.label}: ${s.score == null ? "ainda não medido" : Math.round(s.score)}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="small">{s.label}</Text>
            <Text variant="small" muted>{s.score == null ? "não medido" : Math.round(s.score)}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: c.surfaceAlt, overflow: "hidden", marginTop: 4 }}>
            {s.score != null ? <View style={{ width: `${s.score}%`, height: 10, backgroundColor: c.accent }} /> : null}
            {CEFR_TICKS.map(([, v]) => (
              <View key={v} style={{ position: "absolute", left: `${v}%`, top: 0, bottom: 0, width: 1, backgroundColor: c.bg }} />
            ))}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", position: "relative", height: 14 }}>
        {CEFR_TICKS.map(([l, v]) => (
          <Text key={l} variant="tiny" muted style={{ position: "absolute", left: `${v - 3}%` }}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

/** Linha simples de evolução (valores 0–100 ou outra escala). */
export function LineChart({ points, width = 320, height = 120, suffix = "", max: fixedMax, invert }: {
  points: { label: string; value: number }[]; width?: number; height?: number; suffix?: string; max?: number; invert?: boolean;
}) {
  const { c } = useTheme();
  if (points.length === 0) return <Text muted variant="small">Ainda sem dados suficientes.</Text>;
  const vals = points.map((p) => p.value);
  const max = fixedMax ?? Math.max(...vals) * 1.15;
  const min = fixedMax ? 0 : Math.min(...vals) * 0.85;
  const x = (i: number) => (points.length === 1 ? width / 2 : 12 + (i / (points.length - 1)) * (width - 24));
  const y = (v: number) => 10 + (1 - (v - min) / Math.max(max - min, 1e-6)) * (height - 30);
  const last = points[points.length - 1];
  const first = points[0];
  const trendUp = invert ? last.value < first.value : last.value > first.value;
  return (
    <View accessible accessibilityLabel={`Evolução: de ${Math.round(first.value)}${suffix} para ${Math.round(last.value)}${suffix}`}>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={0} x2={width} y1={10 + f * (height - 30)} y2={10 + f * (height - 30)} stroke={c.chartGrid} strokeWidth={1} />
        ))}
        <Polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke={c.accent} strokeWidth={2.5} />
        {points.map((p, i) => <Circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={c.accent} />)}
        <SvgText x={width - 4} y={height - 4} fontSize={11} fill={trendUp ? c.success : c.textMuted} textAnchor="end">
          {`${Math.round(last.value)}${suffix}`}
        </SvgText>
      </Svg>
    </View>
  );
}
