import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ScrollView, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import flameAnim from "../../assets/lottie/flame.json";
import mascotAnim from "../../assets/lottie/mascot.json";
import { Aurora } from "../../components/Aurora";
import Lottie from "../../components/Lottie";
import { Enter, PressableScale, ProgressRing, PulseRings } from "../../components/motion";
import { Chip, ErrorText, Gradient, Icon, Loading, Row, Text } from "../../components/ui";
import type { IconName } from "../../components/ui";
import { api } from "../../lib/api";
import { useDailyGoal } from "../../lib/coursePrefs";
import { radius, useTheme, type GradientName } from "../../lib/theme";

const UNIT_GRADIENTS: GradientName[] = ["brand", "india", "listening", "vocab", "scenarios", "unlock", "tutor", "shadowing", "plan", "assessment"];
const ZIGZAG = [0, 52, 78, 52, 0, -52, -78, -52];

/** Trilha: caminho de lições curtas com XP, meta diária e sequência de dias. */
export default function Learn() {
  const { c, g: grad } = useTheme();
  const [ov, setOv] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [goal, setGoal] = useDailyGoal();
  const scroll = useRef<ScrollViewInstance>(null);
  const unitY = useRef<Record<string, number>>({});
  const scrolled = useRef(false);

  useFocusEffect(useCallback(() => {
    scrolled.current = false;
    api("/course").then(setOv).catch((e) => setError(e.message));
  }, []));

  if (!ov) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
        <ErrorText error={error} />{!error ? <Loading /> : null}
      </SafeAreaView>
    );
  }

  const reached = ov.xp_today >= goal;
  const open = (lesson: any) => {
    if (lesson.status === "locked") {
      setHint("Conclua as lições anteriores para desbloquear esta.");
      setTimeout(() => setHint(null), 2500);
      return;
    }
    router.push({ pathname: "/licao/[id]", params: { id: lesson.id } });
  };
  const scrollToCurrent = (y: number) => {
    if (scrolled.current) return;
    scrolled.current = true;
    scroll.current?.scrollTo({ y: Math.max(0, y - 260), animated: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <Aurora />
      {/* barra de status do curso */}
      <Row style={{ justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Row gap={2}>
          <Lottie source={flameAnim} style={{ width: 30, height: 30 }} />
          <Text weight="800" color={ov.streak_days ? "#FF7A00" : c.textMuted}>{ov.streak_days}</Text>
        </Row>
        <Row gap={6}>
          <Icon name="flash" size={20} color="#F5B700" />
          <Text weight="800">{ov.xp_today}/{goal} XP hoje</Text>
        </Row>
        <Row gap={6}>
          <Icon name="diamond" size={18} color={c.primary} />
          <Text weight="800">{ov.xp_total} XP</Text>
        </Row>
      </Row>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 18, maxWidth: 680, width: "100%", alignSelf: "center" }}
        showsVerticalScrollIndicator={false}>
        <Enter>
          <Row gap={14} style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: c.border }}>
            <ProgressRing value={Math.min(1, ov.xp_today / goal)} size={72} stroke={8} colors={reached ? ["#22C55E", "#86EFAC"] : ["#F5B700", "#FF7A00"]}>
              <Icon name={reached ? "checkmark" : "flash"} size={26} color={reached ? c.success : "#F5B700"} />
            </ProgressRing>
            <View style={{ flex: 1, gap: 6 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Text weight="800" style={{ flex: 1 }}>{reached ? "Meta diária batida!" : `Meta diária: faltam ${goal - ov.xp_today} XP`}</Text>
                <Lottie source={mascotAnim} style={{ width: 54, height: 50, marginTop: -10, marginRight: -6 }} />
              </Row>
              <Text variant="small" muted>{ov.lessons_done}/{ov.total_lessons} lições · uma lição leva ~3 min e vale 10–25 XP</Text>
              <Row gap={6}>{ov.daily_goal_options.map((g: number) => <Chip key={g} label={`${g} XP`} selected={goal === g} onPress={() => setGoal(g)} />)}</Row>
            </View>
          </Row>
        </Enter>
        {hint ? <Text variant="small" center color={c.warning}>{hint}</Text> : null}

        {ov.units.map((u: any, k: number) => {
          const g = UNIT_GRADIENTS[k % UNIT_GRADIENTS.length];
          const unitDone = u.done === u.lessons.length;
          return (
            <View key={u.id} style={{ gap: 14 }} onLayout={(e) => { unitY.current[u.id] = e.nativeEvent.layout.y; }}>
              <Gradient name={g} style={{ borderRadius: radius.lg, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" color="rgba(255,255,255,0.85)">Unidade {u.order} · {u.levels.join("–")}</Text>
                  <Text variant="h3" color="#fff">{u.title_pt}</Text>
                  <Text variant="tiny" color="rgba(255,255,255,0.9)">{u.done}/{u.lessons.length} lições</Text>
                </View>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={(unitDone ? "trophy" : u.icon) as IconName} size={24} color="#fff" />
                </View>
              </Gradient>
              {u.lessons.map((l: any, j: number) => {
                const x = ZIGZAG[(j + k * 3) % ZIGZAG.length];
                const isCurrent = l.status === "current";
                const locked = l.status === "locked";
                const icon: IconName = l.kind === "review" ? "trophy" : l.status === "done" ? "checkmark" : locked ? "lock-closed" : "star";
                return (
                  <View key={l.id} style={{ alignItems: "center", transform: [{ translateX: x }] }}
                    onLayout={isCurrent ? (e) => scrollToCurrent((unitY.current[u.id] ?? 0) + e.nativeEvent.layout.y) : undefined}>
                    {isCurrent ? (
                      <View style={{ backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8,
                                     borderWidth: 1.5, borderColor: c.border }}>
                        <Text variant="tiny" weight="800" color={c.primary}>{ov.lessons_done === 0 ? "COMECE AQUI" : "CONTINUAR"}</Text>
                      </View>
                    ) : null}
                    <PressableScale onPress={() => open(l)} accessibilityLabel={`${u.title_pt}: ${l.title_pt}${locked ? " (bloqueada)" : ""}`} scaleTo={0.9}>
                      <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center" }}>
                        {isCurrent ? <PulseRings size={76} color={grad[g][0]} rings={2} /> : null}
                        {/* "base" deslocada dá a sensação de botão 3D */}
                        <View style={{ position: "absolute", top: 10, width: 72, height: 72, borderRadius: 36,
                                       backgroundColor: locked ? c.border : "rgba(0,0,0,0.18)" }} />
                        {locked ? (
                          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", marginTop: -6 }}>
                            <Icon name={icon} size={28} color={c.textMuted} />
                          </View>
                        ) : (
                          <Gradient name={g} style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginTop: -6 }}>
                            <Icon name={icon} size={32} color="#fff" />
                          </Gradient>
                        )}
                      </View>
                    </PressableScale>
                    <Text variant="tiny" muted style={{ marginTop: 2 }}>{l.kind === "review" ? "Revisão" : l.title_pt}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
        <Text variant="small" muted center>Os itens que você pratica aqui entram na sua Revisão espaçada.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
