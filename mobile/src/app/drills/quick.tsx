import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card, ErrorText, Field, Loading, ModuleHero, ProgressBar, Row, Screen, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { speak, stopSpeaking } from "../../lib/speech";
import { useTheme } from "../../lib/theme";
import { useVoiceInput } from "../../lib/voice";

export default function QuickResponse() {
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const { language, profile, caps } = useApp();
  const { c } = useTheme();
  const [set, setSet] = useState<any>(null);
  const [i, setI] = useState(0);
  const [limit, setLimit] = useState(8000);
  const [phase, setPhase] = useState<"listen" | "answer" | "feedback">("listen");
  const [remaining, setRemaining] = useState(0);
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<any>(null);
  const [history, setHistory] = useState<{ latency: number; success: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readyAt = useRef(0);
  const firstAt = useRef<number | null>(null);
  const voice = useVoiceInput(!!caps?.stt.available, language);

  useEffect(() => {
    api(`/drills/quick-response?language=${language}&level=${profile?.cefr_estimate ?? "B1"}&count=8${profile?.trip_destination ? `&destination=${profile.trip_destination}` : ""}`)
      .then((s) => { setSet(s); setLimit(s.initial_time_limit_ms); })
      .catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, []);

  const q = set?.questions?.[i];

  const ask = () => {
    if (!q) return;
    setPhase("listen");
    setAnswer("");
    setFb(null);
    firstAt.current = null;
    speak(q.q, { language, accent: profile?.preferred_accents?.[0], onDone: () => {
      readyAt.current = Date.now();
      setRemaining(limit);
      setPhase("answer");
    } });
  };

  useEffect(() => { if (q) ask(); }, [i, set]);

  useEffect(() => {
    if (phase !== "answer") return;
    const t = setInterval(() => setRemaining(Math.max(0, limit - (Date.now() - readyAt.current))), 100);
    return () => clearInterval(t);
  }, [phase, limit]);

  const evaluate = async (text: string) => {
    setBusy(true);
    try {
      const latency = (firstAt.current ?? Date.now()) - readyAt.current;
      const r = await api("/drills/quick-response/evaluate", { body: { question_id: q.id, answer: text || "-", latency_ms: Math.max(0, latency), time_limit_ms: limit, language } });
      setFb(r);
      setHistory((h) => [...h, { latency: r.latency_ms, success: r.success }]);
      setLimit(r.next_time_limit_ms);
      setPhase("feedback");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const mic = async () => {
    if (!voice.recording) {
      if (firstAt.current == null) firstAt.current = Date.now();
      await voice.start();
      return;
    }
    const res = await voice.stop();
    if (!res) return;
    if (res.kind === "transcript") return evaluate(res.text);
    setBusy(true);
    try {
      const t = await api(`/speech/transcribe?language=${language}`, { form: res.form });
      await evaluate(t.text);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const finished = set && i >= set.questions.length;
  useEffect(() => {
    if (finished && planDay && planActivity) {
      api("/activities", { body: { language, activity_type: "other", duration_seconds: 0, plan_day: Number(planDay), plan_activity_id: planActivity } }).catch(() => {});
    }
  }, [finished]);

  if (!set) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  if (finished) {
    const avg = history.reduce((a, b) => a + b.latency, 0) / Math.max(history.length, 1);
    return (
      <Screen>
        <Text variant="h2">Resultado</Text>
        <Card tone="success" style={{ gap: 6 }}>
          <Text variant="h3">{history.filter((h) => h.success).length}/{history.length} respostas no tempo</Text>
          <Text>Tempo médio para começar a responder: {(avg / 1000).toFixed(1)} s</Text>
          <Text variant="small" muted>Janela final: {(limit / 1000).toFixed(1)} s (ela encurta a cada acerto).</Text>
        </Card>
        <Button title="Mais uma rodada" onPress={() => { setI(0); setHistory([]); api(`/drills/quick-response?language=${language}&level=${profile?.cefr_estimate ?? "B1"}`).then(setSet); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ModuleHero title="Quick Response" icon="flash" gradient="unlock" subtitle={set.instructions_pt} />
      <ProgressBar value={i / set.questions.length} />
      <Card style={{ gap: 10, alignItems: "center" }}>
        <Text variant="label" muted>Pergunta {i + 1}/{set.questions.length}</Text>
        <Text variant="h2" center>{phase === "listen" ? "🔊 Ouça…" : q.q}</Text>
        {phase === "answer" ? (
          <>
            <Text variant="h1" color={remaining < 2000 ? c.danger : c.primary}>{(remaining / 1000).toFixed(1)} s</Text>
            <ProgressBar value={remaining / limit} color={remaining < 2000 ? c.danger : c.primary} />
          </>
        ) : null}
      </Card>
      {phase === "answer" ? (
        <Stack>
          {voice.mode !== "none" ? (
            <Button title={voice.recording ? "■ Terminei" : "🎙 Responder falando"} variant={voice.recording ? "danger" : "primary"} size="lg" onPress={mic} loading={busy} />
          ) : null}
          <Row>
            <Field value={answer} onChangeText={(t) => { if (firstAt.current == null) firstAt.current = Date.now(); setAnswer(t); }}
              placeholder="ou digite" onSubmitEditing={() => evaluate(answer)} />
          </Row>
          {answer ? <Button title="Enviar" onPress={() => evaluate(answer)} loading={busy} /> : null}
          <Button title="Ouvir de novo" variant="ghost" size="sm" onPress={() => speak(q.q, { language })} />
        </Stack>
      ) : null}
      {phase === "feedback" && fb ? (
        <Stack>
          <Banner tone={fb.success ? "success" : "warning"} title={fb.in_time ? `No tempo! (${(fb.latency_ms / 1000).toFixed(1)} s)` : `Fora do tempo (${(fb.latency_ms / 1000).toFixed(1)} s)`}>
            {fb.feedback_pt}
          </Banner>
          {fb.corrections?.map((cr: any, j: number) => <Text key={j} variant="small">✓ {cr.corrected} — {cr.explanation_pt}</Text>)}
          <Card style={{ gap: 4 }}>
            <Text variant="small" muted>Uma resposta natural:</Text>
            <Text weight="600">{fb.natural_version ?? fb.model_answer}</Text>
            <Button title="🔊 Ouvir e repetir" size="sm" variant="secondary" onPress={() => speak(fb.natural_version ?? fb.model_answer, { language })} />
          </Card>
          <Button title="Próxima" size="lg" onPress={() => setI(i + 1)} />
        </Stack>
      ) : null}
      <ErrorText error={error ?? voice.error} />
    </Screen>
  );
}
