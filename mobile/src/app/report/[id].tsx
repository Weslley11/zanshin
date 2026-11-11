import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AnimatedNumber, Celebration, Enter } from "../../components/motion";
import { Banner, Button, Card, ErrorText, Gradient, Icon, Loading, Row, Screen, Stack, Text, type IconName } from "../../components/ui";
import { api } from "../../lib/api";
import { speak } from "../../lib/speech";
import { useTheme } from "../../lib/theme";
import type { Report } from "../../lib/types";

function Metric({ label, value, decimals = 0, suffix = "", icon }: { label: string; value: number; decimals?: number; suffix?: string; icon: IconName }) {
  return (
    <Stack gap={2} style={{ minWidth: 120, flexGrow: 1, flexBasis: "45%" }}>
      <Icon name={icon} size={18} color="rgba(255,255,255,0.9)" />
      <AnimatedNumber value={value} decimals={decimals} suffix={suffix} render={(s) => <Text variant="h2" color="#fff">{s}</Text>} />
      <Text variant="tiny" color="rgba(255,255,255,0.88)">{label}</Text>
    </Stack>
  );
}

function Exercise({ ex }: { ex: Report["exercises"][number] }) {
  const [open, setOpen] = useState(false);
  const { c } = useTheme();
  return (
    <Card style={{ gap: 6 }}>
      <Text variant="small" muted>{ex.instruction_pt}</Text>
      <Text weight="600">{ex.prompt}</Text>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
        <Text variant="small" color={c.accent}>{open ? `✓ ${ex.answer}` : "Mostrar resposta (tente antes!)"}</Text>
      </Pressable>
    </Card>
  );
}

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    api(`/tutor/sessions/${id}`).then((r) => { setS(r); setCelebrate(true); }).catch((e) => setError(e.message));
  }, [id]);

  if (!s) return <Screen><ErrorText error={error} />{!error ? <Loading label="Gerando relatório…" /> : null}</Screen>;
  const r: Report = s.report;
  const m = r.metrics ?? {};
  return (
    <Screen overlay={<Celebration show={celebrate} onDone={() => setCelebrate(false)} />}>
      <Enter>
        <Gradient name="tutor" style={{ borderRadius: 28, padding: 22, gap: 14, overflow: "hidden" }}>
          <View style={{ position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, top: -80, backgroundColor: "rgba(255,255,255,0.13)" }} />
          <Text variant="label" color="rgba(255,255,255,0.85)">Sessão concluída</Text>
          <Text variant="h1" color="#fff">{s.title}</Text>
          <Text variant="small" color="rgba(255,255,255,0.92)">{r.summary_pt}</Text>
          <Row wrap gap={12}>
            <Metric icon="chatbubble-ellipses" label="falas suas" value={Number(m.user_turns ?? 0)} />
            <Metric icon="text" label="palavras por fala" value={Number(m.avg_words_per_turn ?? 0)} decimals={1} />
            <Metric icon="time" label="minutos" value={Math.round(Number(m.duration_seconds ?? 0) / 60)} />
            {m.avg_response_latency_ms ? <Metric icon="flash" label="para começar a responder" value={Number(m.avg_response_latency_ms) / 1000} decimals={1} suffix=" s" /> : null}
          </Row>
        </Gradient>
      </Enter>
      {r.limitations_pt ? <Banner tone="accent" icon="phone-portrait">{r.limitations_pt}</Banner> : null}

      {r.goals?.length ? (
        <Card style={{ gap: 6 }}>
          <Text variant="h3">Objetivos da simulação</Text>
          {r.goals.map((g) => <Text key={g.id} color={g.achieved ? c.success : c.textMuted}>{g.achieved ? "✓" : "○"} {g.pt}</Text>)}
          {r.goals_note_pt ? <Text variant="tiny" muted>{r.goals_note_pt}</Text> : null}
        </Card>
      ) : null}

      {r.strengths_pt?.length ? (
        <Card tone="success" style={{ gap: 4 }}>
          <Text weight="700">Pontos fortes</Text>
          {r.strengths_pt.map((t) => <Text key={t} variant="small">• {t}</Text>)}
        </Card>
      ) : null}

      <Stack gap={10}>
        <Text variant="h3">1. Principais erros</Text>
        {r.main_errors.length === 0 ? <Text muted variant="small">Nenhum erro relevante identificado.</Text> : null}
        {r.main_errors.map((e, i) => (
          <Card key={i} tone={e.severity === "minor" ? "default" : "warning"} style={{ gap: 4 }}>
            <Text variant="tiny" muted>{e.severity === "blocks_understanding" ? "Impede a compreensão" : e.severity === "may_confuse" ? "Pode confundir" : "Pequena imperfeição"}{e.count > 1 ? ` · ${e.count}×` : ""}</Text>
            <Text variant="small" color={c.danger} style={{ textDecorationLine: "line-through" }}>{e.original}</Text>
            <Text weight="600">{e.corrected}</Text>
            <Text variant="small" muted>{e.explanation_pt}</Text>
          </Card>
        ))}
      </Stack>

      {r.corrected_sentences.length ? (
        <Stack gap={8}>
          <Text variant="h3">2. Frases corrigidas</Text>
          {r.corrected_sentences.map((x, i) => (
            <Pressable key={i} onPress={() => speak(x.corrected)} accessibilityRole="button" accessibilityLabel={`Ouvir: ${x.corrected}`}>
              <Text variant="small" muted>{x.original}</Text>
              <Text weight="600">🔊 {x.corrected}</Text>
            </Pressable>
          ))}
        </Stack>
      ) : null}

      {r.natural_expressions.length ? (
        <Stack gap={8}>
          <Text variant="h3">3. Expressões mais naturais</Text>
          {r.natural_expressions.map((x, i) => (
            <Card key={i} style={{ gap: 2 }}>
              <Text variant="small" muted>Você disse: {x.learner_said}</Text>
              <Text weight="600">Mais natural: {x.more_natural}</Text>
              <Text variant="small" muted>{x.note_pt}</Text>
            </Card>
          ))}
        </Stack>
      ) : null}

      {r.new_vocabulary.length ? (
        <Stack gap={8}>
          <Text variant="h3">4. Vocabulário novo</Text>
          {r.new_vocabulary.map((v) => (
            <Card key={v.term} style={{ gap: 2 }}>
              <Text weight="700">{v.term}</Text>
              <Text variant="small">{v.meaning_pt}</Text>
              {v.example ? <Text variant="small" muted>“{v.example}”</Text> : null}
            </Card>
          ))}
          {r.added_to_review ? <Text variant="small" muted>{r.added_to_review} itens foram adicionados à sua revisão espaçada.</Text> : null}
        </Stack>
      ) : null}

      <Stack gap={6}>
        <Text variant="h3">5. Recomendações</Text>
        {r.recommendations_pt.map((t) => <Text key={t} variant="small">• {t}</Text>)}
        {r.cefr_observation_pt ? <Text variant="small" muted>{r.cefr_observation_pt}</Text> : null}
      </Stack>

      {r.exercises.length ? (
        <Stack gap={8}>
          <Text variant="h3">6. Exercícios personalizados</Text>
          {r.exercises.map((ex, i) => <Exercise key={i} ex={ex} />)}
        </Stack>
      ) : null}

      <Row gap={10}>
        <Button title="Praticar de novo" style={{ flex: 1 }} onPress={() => router.replace({ pathname: "/tutor/new", params: { mode: s.mode, scenario: s.scenario_id ?? "" } })} />
        <Button title="Ir para revisão" variant="secondary" style={{ flex: 1 }} onPress={() => router.replace("/(tabs)/vocab")} />
      </Row>
    </Screen>
  );
}
