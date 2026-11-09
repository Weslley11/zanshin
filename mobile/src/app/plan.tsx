import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Banner, Button, Card, Collapsible, ErrorText, Loading, Row, Screen, Stack, Text } from "../components/ui";
import { ACTIVITY_ICONS, activityHref } from "../lib/activities";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { useTheme } from "../lib/theme";
import type { PlanDay } from "../lib/types";

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
  return (
    <Screen>
      <Text variant="h2">{plan.title}</Text>
      <Text variant="small" muted>{plan.start_date} → {plan.end_date} · {plan.daily_minutes} min/dia · hoje é o dia {plan.today}</Text>

      <Card tone="accent" style={{ gap: 6 }}>
        <Text weight="700">Expectativa realista</Text>
        <Text variant="small">{plan.expected_outcomes?.general_progress_pt}</Text>
        <Text variant="small">{plan.expected_outcomes?.task_readiness_pt}</Text>
        <Text variant="tiny" muted>{plan.expected_outcomes?.basis_pt} {plan.expected_outcomes?.no_guarantee_pt}</Text>
      </Card>

      {plan.insights?.length ? (
        <Card style={{ gap: 6 }}>
          <Text weight="700">Por que seu plano está assim</Text>
          {plan.insights.map((i: any) => <Text key={i.signal} variant="small">• {i.finding_pt} → {i.action_pt}</Text>)}
        </Card>
      ) : null}
      <Button title="Reajustar com meu desempenho recente" variant="secondary" size="sm" loading={adapting} onPress={async () => {
        setAdapting(true);
        try { await api(`/plans/current/adapt?language=${language}`, { method: "POST" }); setPlan(await api(`/plans/current?language=${language}`)); }
        catch (e: any) { setError(e.message); }
        setAdapting(false);
      }} />

      {[1, 2, 3].map((ph) => {
        const info = phases[ph] ?? phases[String(ph)];
        const days = plan.days.filter((d: any) => d.phase === ph);
        return (
          <Card key={ph} style={{ gap: 10 }}>
            <Text variant="label" muted>Fase {ph} · dias {days[0]?.day}–{days[days.length - 1]?.day}</Text>
            <Text variant="h3">{info?.title_pt}</Text>
            <Collapsible title="Objetivos e metas mensuráveis">
              <Stack gap={4}>
                {info?.objectives_pt?.map((o: string) => <Text key={o} variant="small">• {o}</Text>)}
                <Text variant="small" weight="700" style={{ marginTop: 6 }}>Metas</Text>
                {info?.measurable_goals_pt?.map((o: string) => <Text key={o} variant="small">🎯 {o}</Text>)}
              </Stack>
            </Collapsible>
            <Row wrap gap={5}>
              {days.map((d: any) => {
                const isToday = d.day === plan.today;
                const bg = d.completed ? c.success : d.done > 0 ? c.warning : d.day < plan.today ? c.surfaceAlt : c.surface;
                return (
                  <Pressable key={d.day} onPress={() => openDay(d.day)} accessibilityRole="button"
                    accessibilityLabel={`Dia ${d.day}${d.completed ? ", concluído" : ""}${d.is_assessment_day ? ", avaliação" : ""}`}
                    style={{ width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: bg,
                             borderWidth: isToday ? 2 : 1, borderColor: isToday ? c.primary : c.border }}>
                    <Text variant="tiny" weight={isToday ? "700" : "400"} color={d.completed ? "#fff" : c.text}>{d.is_assessment_day ? "★" : d.day}</Text>
                  </Pressable>
                );
              })}
            </Row>
          </Card>
        );
      })}

      {selected ? (
        <Card style={{ gap: 8 }}>
          <Text variant="h3">Dia {selected.day} · {new Date(selected.date + "T12:00:00").toLocaleDateString("pt-BR")}</Text>
          <Text variant="small" muted>{selected.focus} · {selected.minutes} min</Text>
          {selected.activities.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(activityHref(a, selected.day) as any)} accessibilityRole="button"
              style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 4 }}>
              <Text>{a.done ? "✅" : ACTIVITY_ICONS[a.type]}</Text>
              <View style={{ flex: 1 }}><Text variant="small" weight="600">{a.title_pt}</Text></View>
              <Text variant="tiny" muted>{a.minutes} min</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
      <Banner tone="accent">★ = avaliação de progresso (a cada 15 dias). O plano se ajusta após cada avaliação sem mudar os objetivos das fases.</Banner>
      <ErrorText error={error} />
    </Screen>
  );
}
