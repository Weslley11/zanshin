import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AnswerBox } from "../components/AnswerBox";
import { LineChart } from "../components/charts";
import { Celebration, Enter, ProgressRing } from "../components/motion";
import { Banner, Button, Card, Chip, Collapsible, ErrorText, Loading, ModuleHero, Pill, Row, Screen, SectionHeader, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { tap } from "../lib/haptics";
import { compareChecks, PARTNERS, SPEAK_SECONDS, speakingMetrics, type SpeakingMetrics, type SpeakingPrompt } from "../lib/speaking";
import { speak, stopSpeaking } from "../lib/speech";
import { useTheme } from "../lib/theme";

type Step = "home" | "prep" | "talk" | "rate" | "done";

/**
 * Medidor de fala: 1 minuto falando sobre um tema, toda semana, para ver a evolução com números
 * (palavras por minuto, variedade, português no meio). E o registro das conversas com pessoas reais,
 * que é o que mais transforma prática em fala de verdade.
 */
export default function SpeakingCheck() {
  const { c, g } = useTheme();
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const [ov, setOv] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("home");
  const [left, setLeft] = useState(0);
  const [said, setSaid] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [result, setResult] = useState<{ metrics: SpeakingMetrics; prev: SpeakingMetrics | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [realMin, setRealMin] = useState(15);
  const [partner, setPartner] = useState<string>("india");
  const [realSaved, setRealSaved] = useState(false);
  const startedAt = useRef(0);
  const elapsed = useRef(0);

  useFocusEffect(useCallback(() => {
    api("/speaking").then(setOv).catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, []));

  useEffect(() => {
    if (step !== "talk" && step !== "prep") return;
    if (left <= 0) {
      if (step === "prep") beginTalk();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, step]);

  if (!ov) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const prompt: SpeakingPrompt = ov.prompt;
  const history: any[] = ov.history ?? [];

  function beginTalk() {
    tap("success");
    startedAt.current = Date.now();
    setLeft(SPEAK_SECONDS);
    setStep("talk");
  }
  const finishTalk = () => {
    elapsed.current = Math.min(SPEAK_SECONDS, Math.max(10, (Date.now() - startedAt.current) / 1000));
    setStep("rate");
  };
  const save = async () => {
    if (confidence == null) return;
    setSaving(true);
    setError(null);
    try {
      const last = history[history.length - 1];
      const r: any = await api("/speaking/checks", { body: { prompt_id: prompt.id, transcript: said, seconds: elapsed.current, confidence,
        ...(planDay && planActivity ? { plan_day: Number(planDay), plan_activity_id: planActivity } : {}) } });
      setResult({ metrics: r.metrics, prev: last ? (last as SpeakingMetrics) : null });
      setOv(r.overview);
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const saveReal = async () => {
    tap("success");
    try {
      setOv(await api("/speaking/real", { body: { minutes: realMin, partner } }));
      setRealSaved(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ------------------------------- falando -------------------------------
  if (step === "prep" || step === "talk") {
    const talking = step === "talk";
    const live = speakingMetrics(said, Math.max(10, (Date.now() - startedAt.current) / 1000));
    return (
      <Screen scrollKey={step}>
        <Card style={{ alignItems: "center", gap: 10 }}>
          <Text variant="label" muted>{talking ? "Fale sem parar — vale errar" : "Prepare-se: pense em 3 pontos"}</Text>
          <ProgressRing value={talking ? left / SPEAK_SECONDS : left / 15} size={120} colors={talking ? g.speak : g.brand}>
            <Text variant="h1">{left}</Text>
            <Text variant="tiny" muted>segundos</Text>
          </ProgressRing>
          <Text variant="h3" center>{prompt.en}</Text>
          <Text variant="small" muted center>{prompt.pt}</Text>
          <Pill label={prompt.tip_pt} icon="bulb" />
        </Card>
        {talking ? (
          <>
            <AnswerBox placeholder="Toque no microfone e fale (ou use o ditado do teclado)" onSubmit={(t) => setSaid((s) => (s ? `${s} ${t}` : t))} />
            {said ? (
              <Card tone="accent" style={{ gap: 4 }}>
                <Text variant="small">“{said}”</Text>
                <Text variant="tiny" muted>{live.words} palavras até agora</Text>
              </Card>
            ) : null}
            {left <= 0 ? <Banner icon="alarm" title="Tempo!">Se o microfone ainda estiver gravando, pare para o texto entrar.</Banner> : null}
            <Button title="Terminei" size="lg" icon="checkmark" onPress={finishTalk} disabled={!said.trim()} />
            {!said.trim() ? <Text variant="tiny" muted center>Fale pelo microfone (ou dite no teclado) para liberar o botão.</Text> : null}
          </>
        ) : (
          <Button title="Já sei o que dizer — começar" size="lg" icon="mic" onPress={beginTalk} />
        )}
      </Screen>
    );
  }

  // ------------------------------- como foi -------------------------------
  if (step === "rate") {
    return (
      <Screen>
        <Text variant="h2">Como você se sentiu falando?</Text>
        <Row gap={8} wrap>
          {[[1, "Travei muito"], [2, "Difícil"], [3, "Ok"], [4, "Bem"], [5, "Solto!"]].map(([v, l]) => (
            <Chip key={v} label={`${v} · ${l}`} selected={confidence === v} onPress={() => { tap(); setConfidence(v as number); }} />
          ))}
        </Row>
        <Card style={{ gap: 4 }}>
          <Text variant="label" muted>O que o app entendeu</Text>
          <Text variant="small">“{said}”</Text>
        </Card>
        <ErrorText error={error} />
        <Button title="Ver meus números" size="lg" icon="speedometer" loading={saving} disabled={confidence == null} onPress={save} />
      </Screen>
    );
  }

  // ------------------------------- resultado / início -------------------------------
  const s = ov.summary;
  const real = ov.real;
  const m = result?.metrics;
  return (
    <Screen scrollKey={step} overlay={<Celebration show={step === "done" && !!result && !!result.prev && result.metrics.wpm > result.prev.wpm} />}>
      {step === "done" && m ? (
        <Enter>
          <Card style={{ gap: 10 }}>
            <Text variant="label" muted>Seu minuto de hoje</Text>
            <Row gap={8} wrap>
              {[[`${m.wpm}`, "palavras/min"], [`${m.words}`, "palavras"], [`${m.variety_pct}%`, "variedade"], [`${m.pt_words}`, "em português"]].map(([v, l]) => (
                <View key={l} style={{ flexGrow: 1, minWidth: 70, alignItems: "center", padding: 8, borderRadius: 14, backgroundColor: c.surfaceAlt }}>
                  <Text variant="h2">{v}</Text>
                  <Text variant="tiny" muted center>{l}</Text>
                </View>
              ))}
            </Row>
            {compareChecks(result!.prev, m).map((t) => <Text key={t} variant="small">• {t}</Text>)}
          </Card>
        </Enter>
      ) : (
        <ModuleHero title="Medidor de fala" icon="speedometer" gradient="speak"
          subtitle="1 minuto por semana falando sobre um tema. Os números mostram se a sua fala está mesmo evoluindo.">
          <Row gap={6} wrap>
            <Pill label={s ? `${s.checks} medidas` : "nenhuma medida ainda"} icon="stats-chart" color="#fff" bg="rgba(255,255,255,0.22)" />
            {s ? <Pill label={`${s.change_wpm >= 0 ? "+" : ""}${s.change_wpm} palavras/min desde o início`} icon="trending-up" color="#fff" bg="rgba(255,255,255,0.22)" /> : null}
          </Row>
        </ModuleHero>
      )}

      {step === "home" ? (
        <Card style={{ gap: 8 }}>
          <Text variant="label" muted>Tema desta semana</Text>
          <Row gap={8}>
            <Text variant="h3" style={{ flex: 1 }}>{prompt.en}</Text>
            <Button title="" icon="volume-high" size="sm" variant="secondary" accessibilityLabel="Ouvir o tema" onPress={() => speak(prompt.en, { language: "en", accent: "US", rate: 0.9 })} />
          </Row>
          <Text variant="small" muted>{prompt.pt}</Text>
          <Button title="Começar (15 s para pensar + 60 s falando)" size="lg" icon="mic" onPress={() => { tap(); setSaid(""); setConfidence(null); setLeft(15); setStep("prep"); }} />
        </Card>
      ) : (
        <Button title="Fazer outra medida" variant="secondary" icon="refresh" onPress={() => { setResult(null); setStep("home"); }} />
      )}

      {history.length >= 2 ? (
        <Card style={{ gap: 8 }}>
          <Text variant="label" muted>Palavras por minuto, semana a semana</Text>
          <LineChart points={history.map((h) => ({ label: h.date.slice(5), value: h.wpm ?? 0 }))} />
        </Card>
      ) : null}

      <SectionHeader title="Conversas com pessoas reais" />
      <Card style={{ gap: 10 }}>
        <Row gap={12}>
          <ProgressRing value={real.week_minutes / real.week_goal} size={84} stroke={9} colors={g.tutor}>
            <Text weight="800">{real.week_minutes}</Text>
            <Text variant="tiny" muted>/ {real.week_goal} min</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="800">Esta semana</Text>
            <Text variant="small" muted>Total: {real.total_minutes} min em {real.sessions} {real.sessions === 1 ? "conversa" : "conversas"}.</Text>
            <Text variant="small" muted>Indianos {real.by_partner.india ?? 0} · Americanos {real.by_partner.us ?? 0} · Outros {real.by_partner.other ?? 0} min</Text>
          </View>
        </Row>
        <Text variant="small">Falou inglês com alguém hoje (call, reunião, colega, aula)? Registre:</Text>
        <Row gap={6} wrap>{[5, 10, 15, 30, 60].map((n) => <Chip key={n} label={`${n} min`} selected={realMin === n} onPress={() => setRealMin(n)} />)}</Row>
        <Row gap={6} wrap>{Object.entries(PARTNERS).map(([k, l]) => <Chip key={k} label={l} selected={partner === k} onPress={() => setPartner(k)} />)}</Row>
        <Button title={realSaved ? "Registrado! Registrar outra" : "Registrar conversa"} icon="people" variant={realSaved ? "secondary" : "primary"} onPress={saveReal} />
      </Card>
      <ErrorText error={error} />

      <Collapsible title="Por que medir assim (e o que não dá para garantir)">
        <Stack gap={6}>
          <Text variant="small">• Velocidade de fala, frases mais longas e menos pausas estão entre as medidas mais usadas em pesquisas de fluência oral. Aqui elas são estimadas a partir do texto que o reconhecimento de voz entendeu.</Text>
          <Text variant="small">• O tema muda a cada semana: compare a tendência de 3–4 medidas, não uma só. Como referência solta, nativos em conversa costumam falar algo como 120–160 palavras por minuto, e isso varia muito.</Text>
          <Text variant="small">• O que mais transforma estudo em fala é usar o inglês com pessoas. A meta de 60 min por semana de conversa real é um ponto de partida; mais é melhor.</Text>
          <Text variant="small" muted>Nenhum app consegue garantir fluência. Ele garante que você pratique do jeito que a pesquisa mais apoia e que veja, com números, se está funcionando.</Text>
        </Stack>
      </Collapsible>
    </Screen>
  );
}
