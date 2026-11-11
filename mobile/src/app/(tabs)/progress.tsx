import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";
import { LineChart, SkillBars, WeekBars } from "../../components/charts";
import { AnimatedNumber, Enter, ProgressRing } from "../../components/motion";
import { Button, Card, ErrorText, Gradient, Loading, ProgressBar, Row, Screen, Stack, Text } from "../../components/ui";
import { gradients } from "../../lib/theme";
import { formatMinutes } from "../../lib/activities";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { shareText } from "../../lib/share";

function reportText(d: any): string {
  const lines = [
    `Fluent AI — relatório de progresso (${new Date().toLocaleDateString("pt-BR")})`,
    `Idioma: ${d.language.name_pt} · Nível estimado: ${d.level_estimate ?? "não avaliado"} (estimativa interna, não certificação)`,
    "",
    "Competências (0–100):",
    ...d.skills.map((s: any) => `- ${s.label_pt}: ${s.score == null ? "não medido" : Math.round(s.score)}`),
    "",
    `Tempo total de estudo: ${formatMinutes(d.effort.total_minutes)} · sequência: ${d.effort.streak_days} dias`,
    `Vocabulário: ${d.vocabulary.learned} em revisão, ${d.vocabulary.retained_estimate} retidos`,
    `Conversas concluídas: ${d.conversation.sessions}`,
    d.plan ? `Plano: dia ${d.plan.day}/${d.plan.total_days}, ${d.plan.percent_activities_done}% das atividades concluídas` : "",
    "",
    "Histórico de avaliações:",
    ...d.skill_history.map((h: any) => `- ${h.date} (${h.kind}): ${h.overall ?? "-"}`),
    "",
    d.effort.note_pt,
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

export default function Progress() {
  const { language } = useApp();
  const { width } = useWindowDimensions();
  const chartW = Math.min(width, 640) - 64;
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    api(`/dashboard?language=${language}`).then(setD).catch((e) => setError(e.message));
  }, [language]));

  if (!d) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const conv = d.conversation.history as any[];
  return (
    <Screen>
      <Enter>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="display">Progresso</Text>
          <Button title="Exportar" size="sm" variant="ghost" icon="share-outline" onPress={() => shareText("fluent-ai-progresso.txt", reportText(d))} />
        </Row>
      </Enter>

      <Enter index={1}>
        <Gradient name="progress" style={{ borderRadius: 28, padding: 22, gap: 6, overflow: "hidden" }}>
          <Text variant="label" color="rgba(255,255,255,0.85)">{d.level_source === "assessment" ? "Nível estimado" : "Nível autodeclarado"} · {d.language.name_pt}</Text>
          <Text variant="display" color="#fff">{d.level_estimate ?? "—"}</Text>
          <Text variant="small" color="rgba(255,255,255,0.9)">{d.level_note_pt}</Text>
          {d.level_source !== "assessment" ? (
            <Button title="Fazer avaliação" size="sm" variant="secondary" icon="ribbon" style={{ alignSelf: "flex-start", marginTop: 6 }}
              onPress={() => router.push({ pathname: "/assessment", params: { kind: "placement" } })} />
          ) : null}
        </Gradient>
      </Enter>

      <Enter index={2}>
        <Row style={{ justifyContent: "space-around" }}>
          {[
            { label: "Jornada", value: (d.plan?.percent_activities_done ?? 0) / 100, text: `${Math.round(d.plan?.percent_activities_done ?? 0)}%`, colors: gradients.plan },
            { label: "Vocabulário", value: d.vocabulary.total ? d.vocabulary.learned / d.vocabulary.total : 0, text: String(d.vocabulary.learned), colors: gradients.vocab },
            { label: "Meta de hoje", value: d.effort.today_minutes / d.effort.daily_goal_minutes, text: `${Math.round(d.effort.today_minutes)}′`, colors: gradients.speak },
          ].map((r) => (
            <Stack key={r.label} gap={6} style={{ alignItems: "center" }}>
              <ProgressRing value={r.value} size={88} stroke={9} colors={r.colors}><Text variant="h3">{r.text}</Text></ProgressRing>
              <Text variant="tiny" muted>{r.label}</Text>
            </Stack>
          ))}
        </Row>
      </Enter>

      <Card index={3} style={{ gap: 12 }}>
        <Text variant="h3">Desempenho por competência</Text>
        <SkillBars skills={d.skills.map((s: any) => ({ label: s.label_pt, score: s.score }))} />
        <Text variant="tiny" muted>Medido nas avaliações e nas atividades. Pronúncia e interação são medidas no shadowing e nas conversas.</Text>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="h3">Esforço da semana</Text>
        <WeekBars data={d.effort.week} goal={d.effort.daily_goal_minutes} width={chartW} />
        <Row wrap gap={16}>
          <Text variant="small">Total: <AnimatedNumber value={d.effort.total_minutes} render={(v) => <Text variant="small" weight="700">{formatMinutes(Number(v))}</Text>} /></Text>
          <Text variant="small">Sequência: <Text variant="small" weight="700">{d.effort.streak_days} dias</Text></Text>
        </Row>
        <Text variant="tiny" muted>{d.effort.note_pt}</Text>
      </Card>

      {d.plan ? (
        <Card style={{ gap: 8 }}>
          <Text variant="h3">Programa intensivo</Text>
          <Text variant="small">Dia {d.plan.day} de {d.plan.total_days} · Fase {d.plan.phase ?? "-"}</Text>
          <ProgressBar value={d.plan.percent_activities_done / 100} color="#1E8F5A" />
          <Text variant="tiny" muted>{d.plan.percent_activities_done}% das atividades concluídas · {d.plan.days_completed} dias completos</Text>
        </Card>
      ) : null}

      <Card style={{ gap: 8 }}>
        <Text variant="h3">Vocabulário</Text>
        <Row wrap gap={16}>
          <Stack gap={0}><Text variant="h2">{d.vocabulary.learned}</Text><Text variant="tiny" muted>aprendidos (em revisão)</Text></Stack>
          <Stack gap={0}><Text variant="h2">{d.vocabulary.retained_estimate}</Text><Text variant="tiny" muted>retidos hoje (≥85%)</Text></Stack>
          <Stack gap={0}><Text variant="h2">{d.vocabulary.due_now}</Text><Text variant="tiny" muted>pendentes</Text></Stack>
        </Row>
        <Text variant="tiny" muted>{d.vocabulary.note_pt}</Text>
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="h3">Conversação</Text>
        <Text variant="small" muted>Palavras por fala (quanto mais, mais você sustenta a conversa)</Text>
        <LineChart width={chartW} points={conv.filter((h) => h.avg_words_per_turn != null).map((h) => ({ label: h.date, value: h.avg_words_per_turn }))} />
        <Text variant="small" muted>Tempo até começar a responder (menor é melhor)</Text>
        <LineChart width={chartW} invert suffix=" s" points={conv.filter((h) => h.latency_ms).map((h) => ({ label: h.date, value: h.latency_ms / 1000 }))} />
        {d.conversation.quick_response_median_ms ? (
          <Text variant="small">Quick Response — mediana: {(d.conversation.quick_response_median_ms / 1000).toFixed(1)} s</Text>
        ) : null}
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="h3">Compreensão auditiva</Text>
        <LineChart width={chartW} max={100} suffix="%" points={d.listening.history.map((p: any) => ({ label: p.date, value: p.value }))} />
      </Card>

      {d.skill_history.length ? (
        <Card style={{ gap: 6 }}>
          <Text variant="h3">Avaliações</Text>
          {d.skill_history.map((h: any) => (
            <Row key={h.date + h.kind} style={{ justifyContent: "space-between" }}>
              <Text variant="small">{h.date} · {h.kind === "placement" ? "inicial" : "progresso"}</Text>
              <Text variant="small" weight="700">{h.overall ?? "—"}</Text>
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
