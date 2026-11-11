import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import globeAnim from "../assets/lottie/globe.json";
import Lottie from "../components/Lottie";
import { Banner, Button, Card, Chip, Collapsible, ErrorText, Field, Loading, ModuleHero, ModuleTile, Row, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { indianFormat, indianWords, internationalFormat, parseAmount, randomAmount } from "../lib/indianNumbers";
import { speak } from "../lib/speech";
import { useTheme } from "../lib/theme";

const say = (text: string, rate = 0.95) => speak(text, { language: "en", accent: "IN", rate });

/** Treino de compreensão de números em lakh/crore, falados com voz en-IN. */
function NumbersTrainer() {
  const { c } = useTheme();
  const [value, setValue] = useState(() => randomAmount());
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [rate, setRate] = useState(1.0);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const started = useRef(false);

  const play = () => say(`The total is ${indianWords(value)} rupees.`, rate);
  useEffect(() => { if (started.current) play(); started.current = true; }, [value]);

  const check = () => {
    const ok = parseAmount(answer) === value;
    setResult(ok);
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => { setAnswer(""); setResult(null); setValue(randomAmount()); };

  return (
    <Card style={{ gap: 10 }}>
      <Text variant="h3">Treino: valores em lakh e crore</Text>
      <Text variant="small" muted>Ouça o valor (voz en-IN) e digite em números. Ex.: “twelve lakh fifty thousand” = 12,50,000 = 1.250.000.</Text>
      <Row wrap>{[0.8, 1.0, 1.15].map((r) => <Chip key={r} label={`${r}x`} selected={rate === r} onPress={() => setRate(r)} />)}</Row>
      <Button title="🔊 Ouvir valor" variant="secondary" onPress={play} />
      <Field value={answer} onChangeText={setAnswer} keyboardType="numeric" placeholder="Digite o valor (só números)" onSubmitEditing={check} />
      {result === null ? <Button title="Conferir" onPress={check} disabled={!answer} /> : (
        <Stack gap={6}>
          <Text weight="700" color={result ? c.success : c.danger}>{result ? "Certo!" : "Ainda não."}</Text>
          <Text variant="small">Falado: “{indianWords(value)}”</Text>
          <Text variant="small">Escrito na Índia: ₹{indianFormat(value)} · internacional: {internationalFormat(value)}</Text>
          <Button title="Próximo valor" onPress={next} />
        </Stack>
      )}
      {score.total ? <Text variant="tiny" muted>Acertos: {score.ok}/{score.total}</Text> : null}
    </Card>
  );
}

export default function IndiaGuide() {
  const { c } = useTheme();
  const [g, setG] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api("/varieties/IN", { auth: false }).then(setG).catch((e) => setError(e.message)); }, []);
  if (!g) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;

  return (
    <Screen>
      <ModuleHero title={g.title_pt} icon="earth" gradient="india" subtitle={g.intro_pt}
        right={<Lottie source={globeAnim} style={{ width: 70, height: 70 }} />} />

      <Row gap={12} wrap>
        <ModuleTile title="Listening" subtitle="Falantes indianos, ritmo real" icon="headset" gradient="listening" index={1}
          onPress={() => router.push({ pathname: "/listening", params: { accent: "IN" } })} />
        <ModuleTile title="Simulações" subtitle="Aeroporto, planta, fornecedor" icon="airplane" gradient="scenarios" index={2}
          onPress={() => router.push({ pathname: "/scenarios", params: { country: "IN" } })} />
        <ModuleTile title="Conversar com o tutor" subtitle="Sotaque indiano · relatório no final" icon="chatbubbles" gradient="tutor" index={3} wide
          onPress={() => router.push({ pathname: "/tutor/new", params: { mode: "natural" } })} />
      </Row>

      <Stack gap={10}>
        <Text variant="h3">Como soa</Text>
        {g.pronunciation.map((p: any) => (
          <Card key={p.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Text weight="700" style={{ flex: 1 }}>{p.title_pt}</Text>
              <Button title="🔊" size="sm" variant="ghost" accessibilityLabel={`Ouvir exemplos: ${p.example}`} onPress={() => say(p.example.replace(/\.\.\./g, " "))} />
            </Row>
            <Text variant="small" muted>{p.example}</Text>
            <Text variant="small">{p.explain_pt}</Text>
            <Text variant="small" color={c.accent}>Dica: {p.tip_pt}</Text>
          </Card>
        ))}
      </Stack>

      <NumbersTrainer />

      <Stack gap={8}>
        <Text variant="h3">Expressões que você vai ouvir</Text>
        <Text variant="small" muted>Toque para ouvir. Todas já estão na sua revisão espaçada quando o destino é a Índia.</Text>
        {g.expressions.map((e: any) => (
          <Pressable key={e.term} onPress={() => say(e.example)} accessibilityRole="button" accessibilityLabel={`${e.term}: ${e.meaning_pt}`}>
            <Card style={{ gap: 2 }}>
              <Text weight="700">🔊 {e.term}</Text>
              <Text variant="small">{e.meaning_pt}</Text>
              <Text variant="small" muted>“{e.example}”</Text>
            </Card>
          </Pressable>
        ))}
      </Stack>

      <Collapsible title="Gramática e uso que podem confundir">
        <Stack gap={8}>
          {g.grammar_usage.map((x: any) => (
            <Card key={x.pattern} style={{ gap: 2 }}>
              <Text weight="700">{x.pattern}</Text>
              <Text variant="small">“{x.example}”</Text>
              <Text variant="small" muted>{x.meaning_pt}</Text>
            </Card>
          ))}
        </Stack>
      </Collapsible>

      <Collapsible title="Comunicação no trabalho e cultura">
        <Stack gap={8}>
          {g.culture.map((x: any) => (
            <Card key={x.title_pt} style={{ gap: 2 }}>
              <Text weight="700">{x.title_pt}</Text>
              <Text variant="small">{x.tip_pt}</Text>
            </Card>
          ))}
        </Stack>
      </Collapsible>

      <Card tone="accent" style={{ gap: 6 }}>
        <Text weight="700">Complete com áudio real</Text>
        {g.authentic_audio_pt.map((t: string) => <Text key={t} variant="small">• {t}</Text>)}
      </Card>
      <Banner tone="warning">{g.voice_note_pt}</Banner>
    </Screen>
  );
}
