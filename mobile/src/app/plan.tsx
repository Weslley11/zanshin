import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { ActivityRow } from "../components/ActivityRow";
import { Enter, PressableScale, ProgressRing, PulseRings } from "../components/motion";
import { Button, Card, Collapsible, ErrorText, Gradient, Icon, Loading, ModuleHero, Row, Screen, Stack, Text } from "../components/ui";
import { activityHref } from "../lib/activities";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { useTheme, type GradientName } from "../lib/theme";
import type { PlanDay } from "../lib/types";

const PHASE_GRADIENT: Record<number, GradientName> = { 1: "listening", 2: "tutor", 3: "unlock" };

export default function Plan() {
  const { language } = useApp();
  const { c } = useTheme();
  const [plan, setPlan] = useState<any>(null);
  const [selected, setSelected] = useState<PlanDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adapting, setAdapting] = useState(false);

  const openDay = async (day: number) => {
    try { setSelected(await api(`/plans/current/days/${day}?language=${language}`)); } catch (e: any) { setError(e.message); }
  };

  useFocusEffect(useCallback(() => {
    api(`/plans/current?language=${language}`).then((p) => { setPlan(p); openDay(p.today); }).catch((e) => setError(e.message));
  }, [language]));

  if (!plan) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const phases = plan.phases ?? {};
  const doneDays = plan.days.filter((d: any) => d.completed).length;
  const totalActs = plan.days.reduce((s: number, d: any) => s + d.total, 0);
  const doneActs = plan.days.reduce((s: number, d: any) => s + d.done, 0);

  return (
    <Screen>
      <ModuleHero title={`Jornada de ${plan.total_days} dias`} icon="map" gradient="plan"
        subtitle={`${plan.daily_minutes} min/dia · termina em ${new Date(plan.end_date + "T12:00:00").toLocaleDateString("pt-BR")}`}
        right={
          <ProgressRing value={totalActs ? doneActs / totalActs : 0} size={78} stroke={8} colors={["#FFFFFF", "#FFFFFF"]} track="rgba(255,255,255,0.25)">
            <Text weight="900" color="#fff">{plan.today}</Text>
            <Text variant="tiny" color="rgba(255,255,255,0.85)">dia</Text>
          </ProgressRing>
        }>
        <Text variant="small" color="rgba(255,255,255,0.9)">{doneDays} dias completos · {doneActs}/{totalActs} atividades</Text>
      </ModuleHero>

      <Card index={1} style={{ gap: 6 }}>
        <Row gap={8}><Icon name="compass" size={18} color={c.primary} /><Text weight="800">Expectativa realista</Text></Row>
        <Text variant="small">{plan.expected_outcomes?.general_progress_pt}</Text>
        <Text variant="small">{plan.expected_outcomes?.task_readiness_pt}</Text>
        <Text variant="tiny" muted>{plan.expected_outcomes?.basis_pt} {plan.expected_outcomes?.no_guarantee_pt}</Text>
      </Card>

      {plan.insights?.length ? (
        <Card index={2} style={{ gap: 8 }}>
          <Row gap={8}><Icon name="sparkles" size={18} color={c.primary} /><Text weight="800">Por que seu plano está assim</Text></Row>
          {plan.insights.map((i: any) => <Text key={i.signal} variant="small">• {i.finding_pt} → {i.action_pt}</Text>)}
          <Button title="Reajustar com meu desempenho" variant="secondary" size="sm" icon="refresh" loading={adapting} onPress={async () => {
            setAdapting(true);
            try { await api(`/plans/current/adapt?language=${language}`, { method: "POST" }); setPlan(await api(`/plans/current?language=${language}`)); }
            catch (e: any) { setError(e.message); }
            setAdapting(false);
          }} />
        </Card>
      ) : null}

      {[1, 2, 3].map((ph, pi) => {
        const info = phases[ph] ?? phases[String(ph)];
        const days = plan.days.filter((d: any) => d.phase === ph);
        const done = days.filter((d: any) => d.completed).length;
        return (
          <Enter key={ph} index={3 + pi}>
            <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
              <Gradient name={PHASE_GRADIENT[ph]} style={{ padding: 16, gap: 4 }}>
                <Text variant="label" color="rgba(255,255,255,0.88)">Capítulo {ph} · dias {days[0]?.day}–{days[days.length - 1]?.day}</Text>
                <Text variant="h2" color="#fff">{info?.title_pt}</Text>
                <Text variant="tiny" color="rgba(255,255,255,0.88)">{done}/{days.length} dias completos</Text>
              </Gradient>
              <View style={{ padding: 16, gap: 12 }}>
                <Row wrap gap={7}>
                  {days.map((d: any) => {
                    const isToday = d.day === plan.today;
                    const isSel = selected?.day === d.day;
                    const bg = d.completed ? c.success : d.done > 0 ? c.warning : d.day < plan.today ? c.surfaceAlt : c.bg;
                    return (
                      <PressableScale key={d.day} onPress={() => openDay(d.day)} scaleTo={0.85}
                        accessibilityLabel={`Dia ${d.day}${d.completed ? ", concluído" : ""}${d.is_assessment_day ? ", avaliação" : ""}`}>
                        <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                          {isToday ? <PulseRings size={32} color={c.primary} rings={2} /> : null}
                          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? c.primary : bg,
                                         borderWidth: isSel && !isToday ? 2 : 1, borderColor: isSel ? c.primary : c.border }}>
                            {d.completed ? <Icon name="checkmark" size={16} color="#fff" />
                              : d.is_assessment_day ? <Icon name="star" size={15} color={isToday ? "#fff" : c.warning} />
                              : <Text variant="tiny" weight="800" color={isToday ? "#fff" : c.text}>{d.day}</Text>}
                          </View>
                        </View>
                      </PressableScale>
                    );
                  })}
                </Row>
                <Collapsible title="Objetivos e metas mensuráveis">
                  <Stack gap={4}>
                    {info?.objectives_pt?.map((o: string) => <Text key={o} variant="small">• {o}</Text>)}
                    <Text variant="small" weight="700" style={{ marginTop: 6 }}>Metas</Text>
                    {info?.measurable_goals_pt?.map((o: string) => <Row key={o} gap={6} style={{ alignItems: "flex-start" }}><Icon name="flag" size={14} color={c.primary} /><Text variant="small" style={{ flex: 1 }}>{o}</Text></Row>)}
                  </Stack>
                </Collapsible>
              </View>
            </View>
          </Enter>
        );
      })}

      {selected ? (
        <Card style={{ gap: 4 }}>
          <Text variant="h3">Dia {selected.day} · {new Date(selected.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}</Text>
          <Text variant="small" muted>{selected.focus} · {selected.minutes} min</Text>
          {selected.activities.map((a, i) => <ActivityRow key={a.id} a={a} index={i} onPress={() => router.push(activityHref(a, selected.day) as any)} />)}
        </Card>
      ) : null}
      <Row gap={8} style={{ justifyContent: "center" }}>
        <Icon name="star" size={14} color={c.warning} />
        <Text variant="tiny" muted>avaliação a cada 15 dias · o plano se ajusta sem mudar os objetivos das fases</Text>
      </Row>
      <ErrorText error={error} />
    </Screen>
  );
}
