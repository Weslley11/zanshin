import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, Card, Chip, ErrorText, Field, Loading, ModuleHero, Row, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { ACCENT_LABELS, speak } from "../lib/speech";
import { useTheme } from "../lib/theme";
import { useVoiceInput } from "../lib/voice";

export default function Shadowing() {
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const { language, caps, profile } = useApp();
  const { c } = useTheme();
  const [items, setItems] = useState<any[] | null>(null);
  const [i, setI] = useState(0);
  const [rate, setRate] = useState(0.9);
  const [fb, setFb] = useState<any>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const voice = useVoiceInput(!!caps?.stt.available || !!caps?.pronunciation_assessment.available, language);

  useEffect(() => {
    const first = profile?.preferred_accents?.[0];
    api(`/shadowing?language=${language}`)
      .then((all: any[]) => setItems(first ? [...all.filter((x) => x.accent === first), ...all.filter((x) => x.accent !== first)] : all))
      .catch((e) => setError(e.message));
  }, [language, profile]);
  const it = items?.[i];

  const send = async (form: FormData) => {
    setBusy(true);
    setError(null);
    try {
      form.append("rate", String(rate));
      const r = await api(`/shadowing/${it.id}/attempt`, { form });
      setFb(r);
      setAttempts((a) => a + 1);
      if (planDay && planActivity && attempts + 1 >= 3) {
        api("/activities", { body: { language, activity_type: "other", duration_seconds: 0, plan_day: Number(planDay), plan_activity_id: planActivity } }).catch(() => {});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const mic = async () => {
    if (!voice.recording) { setFb(null); await voice.start(); return; }
    const res = await voice.stop();
    if (!res) return;
    if (res.kind === "audio") return send(res.form);
    const f = new FormData();
    f.append("transcript", res.text);
    f.append("duration_seconds", String(res.durationSec));
    return send(f);
  };

  const sendTyped = () => {
    const f = new FormData();
    f.append("transcript", typed);
    return send(f);
  };

  if (!items) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  if (!it) return <Screen><Banner tone="success" title="Fim da lista">Volte amanhã: repetição espaçada vale para a pronúncia também.</Banner></Screen>;
  return (
    <Screen>
      <ModuleHero title="Shadowing" icon="repeat" gradient="shadowing"
        subtitle="Ouça, imite o ritmo e a entonação e receba feedback de inteligibilidade. Imitar ajuda a perceber — não é preciso adotar o sotaque." />
      <Text variant="label" muted>{it.level} · {ACCENT_LABELS[it.accent] ?? it.accent} · {i + 1}/{items.length}</Text>
      <Card style={{ gap: 10 }}>
        <Text variant="h2">{it.text}</Text>
        <Text variant="small" muted>{it.focus_pt}</Text>
        <Row wrap>{[0.75, 0.9, 1.0].map((s) => <Chip key={s} label={`${s}x`} selected={rate === s} onPress={() => setRate(s)} />)}</Row>
        <Button title="🔊 Ouvir o modelo" variant="secondary" onPress={() => speak(it.text, { language, accent: it.accent, rate })} />
      </Card>
      <Text variant="small" muted>1) Ouça 2–3 vezes · 2) Grave imitando ritmo, ligações e entonação · 3) Compare e repita os trechos difíceis.</Text>
      {voice.mode !== "none" ? (
        <Button title={voice.recording ? `■ Parar (${voice.elapsed.toFixed(0)} s)` : "🎙 Gravar minha versão"} size="lg"
          variant={voice.recording ? "danger" : "primary"} onPress={mic} loading={busy} />
      ) : (
        <Stack>
          <Banner tone="warning">Sem reconhecimento de voz neste dispositivo/servidor. Você pode treinar ouvindo e repetindo; para feedback automático, use o navegador Chrome ou configure STT no servidor.</Banner>
          <Field value={typed} onChangeText={setTyped} placeholder="(opcional) digite o que você disse" />
          <Button title="Comparar texto" variant="secondary" onPress={sendTyped} disabled={!typed} />
        </Stack>
      )}
      <ErrorText error={error ?? voice.error} />

      {fb ? (
        fb.status === "inconclusive" ? (
          <Banner tone="warning" title="Avaliação inconclusiva">{fb.reasons_pt.join(" ")} {fb.advice_pt}</Banner>
        ) : (
          <Stack>
            <Card tone={fb.intelligibility >= 85 ? "success" : "warning"} style={{ gap: 6 }}>
              <Text variant="h3">Inteligibilidade estimada: {Math.round(fb.intelligibility)}%</Text>
              <Row wrap gap={4}>
                {fb.word_alignment.map((w: any, k: number) => (
                  <Text key={k} weight="600" color={w.op === "ok" ? c.success : w.op === "ins" ? c.textMuted : c.danger}>
                    {w.op === "ins" ? `(+${w.heard})` : w.expected}{" "}
                  </Text>
                ))}
              </Row>
              {fb.pronunciation_scores ? (
                <Text variant="small">Precisão {fb.pronunciation_scores.accuracy} · Fluência {fb.pronunciation_scores.fluency} · Prosódia {fb.pronunciation_scores.prosody ?? "-"}</Text>
              ) : null}
              {fb.timing?.ratio ? <Text variant="small" muted>Ritmo: {fb.timing.ratio}× o tempo do modelo</Text> : null}
            </Card>
            {fb.tips_pt.map((t: string) => <Text key={t} variant="small">• {t}</Text>)}
            {fb.notes_pt.map((t: string) => <Text key={t} variant="tiny" muted>{t}</Text>)}
          </Stack>
        )
      ) : null}
      <Row gap={10}>
        <Button title="Repetir esta" variant="ghost" style={{ flex: 1 }} onPress={() => setFb(null)} />
        <Button title="Próxima frase" variant="secondary" style={{ flex: 1 }} onPress={() => { setFb(null); setTyped(""); setI(i + 1); }} />
      </Row>
    </Screen>
  );
}
