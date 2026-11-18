import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { Banner, Button, Card, Chip, ErrorText, Field, Loading, Row, Screen, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { ACCENT_LABELS, speak, speakLines, stopSpeaking } from "../../lib/speech";
import { useTheme } from "../../lib/theme";

const SPEEDS = [0.75, 0.9, 1.0, 1.15];

export default function ListeningExercise() {
  const { id, planDay, planActivity } = useLocalSearchParams<{ id: string; planDay?: string; planActivity?: string }>();
  const { c } = useTheme();
  const [ex, setEx] = useState<any>(null);
  const [rate, setRate] = useState(0.9);
  const [playing, setPlaying] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const started = useRef(Date.now());

  useEffect(() => {
    api(`/listening/${id}`).then(setEx).catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, [id]);

  const play = () => {
    cancel.current?.();
    setPlays((p) => p + 1);
    cancel.current = speakLines(ex.lines, { rate, onLine: setPlaying, onDone: () => setPlaying(null) });
  };

  const submit = async () => {
    try {
      const r = await api(`/listening/${id}/submit`, { body: {
        answers, speed: rate, plays, duration_seconds: Math.round((Date.now() - started.current) / 1000),
      } });
      setResult(r);
      if (planDay && planActivity) {
        await api("/activities", { body: { language: "en", activity_type: "other", duration_seconds: 0, plan_day: Number(planDay), plan_activity_id: planActivity } });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!ex) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  return (
    <Screen>
      <Text variant="h2">{ex.title}</Text>
      <Text variant="small" muted>{ex.level} · {ex.accents.map((a: string) => ACCENT_LABELS[a] ?? a).join(" · ")}</Text>

      <Card style={{ gap: 10 }}>
        <Row wrap>
          {SPEEDS.map((s) => <Chip key={s} label={`${s}x`} selected={rate === s} onPress={() => setRate(s)} />)}
        </Row>
        <Row gap={10}>
          <Button title={playing != null ? `Tocando ${playing + 1}/${ex.lines.length}…` : plays ? "🔊 Ouvir de novo" : "🔊 Ouvir diálogo"} onPress={play} style={{ flex: 1 }} />
          {playing != null ? <Button title="Parar" variant="ghost" onPress={() => { cancel.current?.(); setPlaying(null); }} /> : null}
        </Row>
        <Text variant="tiny" muted>Ouça primeiro na velocidade reduzida e depois em 1.0x. Reproduções: {plays}</Text>
      </Card>

      <Stack>
        <Text variant="h3">Compreensão</Text>
        {ex.questions.map((q: any, i: number) => (
          <Card key={i} style={{ gap: 8 }}>
            <Text weight="600">{i + 1}. {q.q}</Text>
            {q.type === "mc" ? q.options.map((o: string, j: number) => {
              const sel = answers[String(i)] === j;
              const res = result?.questions?.[i];
              return (
                <Pressable key={j} onPress={() => !result && setAnswers({ ...answers, [String(i)]: j })} accessibilityRole="radio" accessibilityState={{ selected: sel }}
                  style={{ padding: 10, borderRadius: 10, borderWidth: 2, borderColor: sel ? (res ? (res.correct ? c.success : c.danger) : c.primary) : c.border }}>
                  <Text variant="small">{o}</Text>
                </Pressable>
              );
            }) : (
              <Field value={answers[String(i)] ?? ""} onChangeText={(t) => setAnswers({ ...answers, [String(i)]: t })} placeholder="Resposta" />
            )}
            {result ? <Text variant="small" color={result.questions[i].correct ? c.success : c.danger}>{result.questions[i].correct ? "✓ Correto" : `✗ Resposta: ${result.questions[i].expected}`}</Text> : null}
          </Card>
        ))}
        {ex.dictation?.length ? (
          <Card style={{ gap: 8 }}>
            <Text weight="600">Ditado de trechos-chave</Text>
            {ex.dictation.map((d: string, j: number) => (
              <Stack key={j} gap={6}>
                <Button title={`🔊 Trecho ${j + 1}`} size="sm" variant="secondary" onPress={() => speak(d, { accent: ex.accents[0], rate })} />
                <Field value={answers[`d${j}`] ?? ""} onChangeText={(t) => setAnswers({ ...answers, [`d${j}`]: t })} placeholder="Escreva o que ouviu" />
                {result?.dictation?.[j] ? <Text variant="small" muted>{result.dictation[j].accuracy}% · “{result.dictation[j].target}”</Text> : null}
              </Stack>
            ))}
          </Card>
        ) : null}
      </Stack>
      <ErrorText error={error} />
      {!result ? <Button title="Ver resultado" size="lg" onPress={submit} /> : (
        <Stack>
          <Banner tone={result.score >= 0.7 ? "success" : "warning"} title={`Acerto: ${Math.round(result.score * 100)}%`}>
            {result.score >= 0.7 ? "Ótimo! Tente na próxima velocidade." : "Ouça de novo acompanhando a transcrição abaixo e repita em voz alta (shadowing)."}
          </Banner>
          <Card style={{ gap: 6 }}>
            <Text variant="h3">Transcrição</Text>
            {result.transcript.map((l: any, i: number) => (
              <Pressable key={i} onPress={() => speak(l.text, { accent: l.accent, rate })} accessibilityRole="button">
                <Text variant="small"><Text variant="small" weight="700">{l.speaker} ({l.accent}): </Text>{l.text}</Text>
              </Pressable>
            ))}
          </Card>
          <Card style={{ gap: 4 }}>
            <Text weight="700">Connected speech</Text>
            {result.connected_speech.map((t: string) => <Text key={t} variant="small">• {t}</Text>)}
            <Text weight="700" style={{ marginTop: 6 }}>Expressões-chave</Text>
            {result.key_phrases.map((t: string) => <Text key={t} variant="small">• {t}</Text>)}
            {ex.structure_tip_pt ? <Text variant="small" muted style={{ marginTop: 6 }}>{ex.structure_tip_pt}</Text> : null}
          </Card>
        </Stack>
      )}
    </Screen>
  );
}
