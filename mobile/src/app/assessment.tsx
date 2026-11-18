import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SkillBars } from "../components/charts";
import { Banner, Button, Card, ErrorText, Field, Loading, ProgressBar, Row, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { speak, stopSpeaking } from "../lib/speech";
import { useTheme } from "../lib/theme";
import { useVoiceInput } from "../lib/voice";

const SECTION_PT: Record<string, string> = { listening: "Listening", vocabulary: "Vocabulário", grammar: "Gramática em contexto", reading: "Leitura" };
const SKILL_PT: Record<string, string> = {
  listening: "Compreensão auditiva", vocabulary: "Vocabulário", grammar: "Gramática", reading: "Leitura",
  speaking: "Produção oral", fluency: "Fluência", pronunciation: "Pronúncia", interaction: "Interação",
};

const METHOD_PT: Record<string, string> = {
  items: "itens objetivos", "items+practice": "itens + desempenho nas atividades", heuristic: "métricas automáticas (sem IA)",
  llm_rubric: "rubrica CEFR avaliada por IA",
};
const CONF_PT: Record<string, string> = { high: "alta", medium: "média", low: "baixa" };

type Step = { kind: "item"; item: any } | { kind: "speaking"; prompt: any } | { kind: "self" };

export default function Assessment() {
  const p = useLocalSearchParams<{ kind?: string; thenPlan?: string; planDay?: string; planActivity?: string }>();
  const { language, caps, refreshMe } = useApp();
  const { c } = useTheme();
  const [a, setA] = useState<any>(null);
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [speaking, setSpeaking] = useState<Record<string, { transcript: string; duration_seconds?: number }>>({});
  const [selfA, setSelfA] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plays, setPlays] = useState<Record<string, number>>({});
  const startedAt = useRef(Date.now());
  const voice = useVoiceInput(!!caps?.stt.available, language);

  useEffect(() => {
    api("/assessments", { body: { language, kind: p.kind ?? "placement" } }).then(setA).catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, []);

  const steps: Step[] = useMemo(() => {
    if (!a) return [];
    const order = ["listening", "vocabulary", "grammar", "reading"];
    const s: Step[] = [];
    for (const sec of order) for (const item of a.sections[sec] ?? []) s.push({ kind: "item", item });
    for (const prompt of a.speaking) s.push({ kind: "speaking", prompt });
    if (a.self_assessment?.length) s.push({ kind: "self" });
    return s;
  }, [a]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api(`/assessments/${a.id}/submit`, { body: {
        answers, self_assessment: selfA, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
        speaking: Object.entries(speaking).map(([id, v]) => ({ id, ...v })),
      } });
      setResult(r);
      await refreshMe();
      if (p.planDay && p.planActivity) {
        await api("/activities", { body: { language, activity_type: "other", duration_seconds: 0, plan_day: Number(p.planDay), plan_activity_id: p.planActivity } });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const recordSpeaking = async (promptId: string) => {
    if (!voice.recording) {
      await voice.start();
      return;
    }
    const res = await voice.stop();
    if (!res) return;
    if (res.kind === "transcript") {
      setSpeaking((s) => ({ ...s, [promptId]: { transcript: res.text, duration_seconds: res.durationSec } }));
      return;
    }
    setBusy(true);
    try {
      const t = await api(`/speech/transcribe?language=${language}`, { form: res.form });
      setSpeaking((s) => ({ ...s, [promptId]: { transcript: t.text, duration_seconds: t.duration_seconds } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !a) return <Screen><ErrorText error={error} /></Screen>;
  if (!a) return <Screen><Loading label="Montando sua avaliação…" /></Screen>;

  if (result) {
    return (
      <Screen>
        <Text variant="h2">Resultado</Text>
        <Card tone="accent" style={{ gap: 4 }}>
          <Text variant="label" muted>Nível geral estimado</Text>
          <Text variant="h1">{result.overall_cefr ?? "—"}</Text>
          <Text variant="small">{result.overall_descriptor_pt}</Text>
        </Card>
        <Card style={{ gap: 10 }}>
          <SkillBars skills={Object.entries(result.skills).map(([k, v]: any) => ({ label: `${SKILL_PT[k] ?? k}${v.level ? ` · ${v.level}` : ""}`, score: v.score }))} />
          {Object.entries(result.skills).map(([k, v]: any) => (
            <Text key={k} variant="tiny" muted>
              {SKILL_PT[k] ?? k}: {v.method === "not_measured" ? v.note_pt : `${METHOD_PT[v.method] ?? v.method} · confiança ${CONF_PT[v.confidence] ?? "-"}`}
            </Text>
          ))}
        </Card>
        <Banner tone="warning">{result.disclaimer_pt}</Banner>
        {result.plan_adaptation?.insights?.length ? (
          <Card style={{ gap: 6 }}>
            <Text weight="700">Seu plano foi ajustado</Text>
            {result.plan_adaptation.insights.map((i: any) => <Text key={i.signal} variant="small">• {i.finding_pt} {i.action_pt}</Text>)}
          </Card>
        ) : null}
        <Button title={p.thenPlan ? "Gerar meu programa de 90 dias" : "Voltar ao início"} size="lg" loading={busy} onPress={async () => {
          if (p.thenPlan) {
            setBusy(true);
            try { await api("/plans", { body: { language } }); } catch (e: any) { setError(e.message); }
            setBusy(false);
          }
          router.replace("/(tabs)");
        }} />
        <ErrorText error={error} />
      </Screen>
    );
  }

  if (step < 0) {
    return (
      <Screen>
        <Text variant="h2">{a.kind === "placement" ? "Avaliação inicial" : "Avaliação de progresso"}</Text>
        <Text>{steps.length} etapas · cerca de 20 minutos. Ouça os áudios com fone, se possível.</Text>
        <Card style={{ gap: 4 }}>
          {["listening", "vocabulary", "grammar", "reading"].map((s) => (
            <Text key={s} variant="small">• {SECTION_PT[s]}: {(a.sections[s] ?? []).length} itens</Text>
          ))}
          <Text variant="small">• Fala: {a.speaking.length} respostas{caps?.stt.available ? " gravadas" : voice.mode === "browser" ? " (reconhecimento do navegador)" : " (digitadas — sem reconhecimento de voz disponível)"}</Text>
        </Card>
        <Banner tone="accent">{a.disclaimer_pt}</Banner>
        <Button title="Começar" size="lg" onPress={() => { startedAt.current = Date.now(); setStep(0); }} />
      </Screen>
    );
  }

  const cur = steps[step];
  const last = step === steps.length - 1;
  const next = () => (last ? submit() : setStep(step + 1));

  return (
    <Screen>
      <ProgressBar value={(step + 1) / steps.length} />
      {cur.kind === "item" ? (
        <Stack>
          <Text variant="label" muted>{SECTION_PT[cur.item.skill]} · {cur.item.level}</Text>
          {cur.item.skill === "listening" ? (
            <Card style={{ gap: 8, alignItems: "flex-start" }}>
              <Button title={`🔊 Ouvir${plays[cur.item.id] ? ` (${plays[cur.item.id]}×)` : ""}`} onPress={() => {
                setPlays((x) => ({ ...x, [cur.item.id]: (x[cur.item.id] ?? 0) + 1 }));
                speak(cur.item.audio_text, { language, accent: cur.item.accent, rate: cur.item.rate ?? 1 });
              }} />
              <Text variant="tiny" muted>Sotaque: {cur.item.accent} · você pode ouvir até 2 vezes, como em uma conversa real.</Text>
            </Card>
          ) : null}
          {cur.item.passage ? <Card><Text>{cur.item.passage}</Text></Card> : null}
          {cur.item.prompt ? <Text variant="h3">{cur.item.prompt}</Text> : null}
          {cur.item.hint_pt ? <Text variant="small" muted>Dica: {cur.item.hint_pt}</Text> : null}
          {cur.item.question ? <Text weight="600">{cur.item.question}</Text> : null}
          {cur.item.type === "mc" ? (
            <Stack gap={8}>
              {cur.item.options.map((o: string, i: number) => (
                <Pressable key={i} onPress={() => setAnswers({ ...answers, [cur.item.id]: i })} accessibilityRole="radio"
                  accessibilityState={{ selected: answers[cur.item.id] === i }}
                  style={{ padding: 14, borderRadius: 12, borderWidth: 2, borderColor: answers[cur.item.id] === i ? c.primary : c.border, backgroundColor: c.surface }}>
                  <Text>{o}</Text>
                </Pressable>
              ))}
            </Stack>
          ) : (
            <Field value={answers[cur.item.id] ?? ""} onChangeText={(t) => setAnswers({ ...answers, [cur.item.id]: t })}
              placeholder={cur.item.type === "dictation" ? "Escreva o que ouviu" : "Digite a palavra"} />
          )}
        </Stack>
      ) : cur.kind === "speaking" ? (
        <Stack>
          <Text variant="label" muted>Fala · {cur.prompt.level}</Text>
          <Text variant="h3">{cur.prompt.prompt}</Text>
          <Text variant="small" muted>Pense por ~{cur.prompt.prep_seconds} s e fale por até {cur.prompt.speak_seconds} s. Não se preocupe com sotaque.</Text>
          {voice.mode !== "none" ? (
            <Button title={voice.recording ? `■ Parar (${voice.elapsed.toFixed(0)} s)` : "🎙 Gravar resposta"} variant={voice.recording ? "danger" : "primary"}
              onPress={() => recordSpeaking(cur.prompt.id)} loading={busy} />
          ) : null}
          <Field multiline label={voice.mode === "none" ? "Escreva como você falaria" : "Transcrição (pode corrigir erros de reconhecimento)"}
            value={speaking[cur.prompt.id]?.transcript ?? ""}
            onChangeText={(t) => setSpeaking({ ...speaking, [cur.prompt.id]: { ...speaking[cur.prompt.id], transcript: t } })} />
          <ErrorText error={voice.error} />
        </Stack>
      ) : (
        <Stack>
          <Text variant="h3">Autoavaliação</Text>
          <Text variant="small" muted>Marque o que você consegue fazer hoje. Isso complementa (não substitui) as medidas.</Text>
          {a.self_assessment.map((s: any) => (
            <Pressable key={s.id} onPress={() => setSelfA({ ...selfA, [s.id]: !selfA[s.id] })} accessibilityRole="checkbox"
              accessibilityState={{ checked: !!selfA[s.id] }} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.primary, backgroundColor: selfA[s.id] ? c.primary : "transparent" }} />
              <Text variant="small" style={{ flex: 1 }}>{s.statement_pt}</Text>
            </Pressable>
          ))}
        </Stack>
      )}
      <ErrorText error={error} />
      <Row gap={10}>
        {step > 0 ? <Button title="Voltar" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Button title={last ? "Enviar avaliação" : "Próximo"} onPress={next} loading={busy} style={{ flex: 2 }} />
      </Row>
      {cur.kind === "item" ? <Button title="Não sei — pular" variant="ghost" size="sm" onPress={next} /> : null}
    </Screen>
  );
}
