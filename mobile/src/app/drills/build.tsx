import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, Card, Chip, ErrorText, Field, Loading, ModuleHero, Row, Screen, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { speak } from "../../lib/speech";

const STAGE_PT: Record<string, string> = { order: "Montar a frase", expand: "Expandir a frase", free: "Resposta completa" };

export default function SentenceBuilding() {
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const [items, setItems] = useState<any[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api("/drills/sentence-building").then(setItems).catch((e) => setError(e.message)); }, []);
  const it = items?.[i];
  const answer = it?.stage === "order" ? picked.join(" ") : text;

  const check = async () => {
    try { setRes(await api("/drills/sentence-building/evaluate", { body: { item_id: it.id, answer } })); } catch (e: any) { setError(e.message); }
  };
  const next = async () => {
    setRes(null); setPicked([]); setText("");
    const n = i + 1;
    setI(n);
    if (items && n >= items.length && planDay && planActivity) {
      await api("/activities", { body: { language: "en", activity_type: "other", duration_seconds: 0, plan_day: Number(planDay), plan_activity_id: planActivity } }).catch(() => {});
    }
  };

  if (!items) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  if (!it) return <Screen><Banner tone="success" title="Concluído!">Agora use essas estruturas em uma conversa com o tutor.</Banner></Screen>;
  return (
    <Screen>
      <ModuleHero title="Construção de frases" icon="extension-puzzle" gradient="plan" subtitle="Do bloco simples à resposta completa." />
      <Text variant="label" muted>{STAGE_PT[it.stage]} · {it.level} · {i + 1}/{items.length}</Text>
      <Text variant="h3">{it.situation_pt}</Text>
      {it.stage === "order" ? (
        <Stack>
          <Card style={{ minHeight: 60 }}><Text variant="h3">{picked.join(" ") || "Toque nos blocos na ordem certa"}</Text></Card>
          <Row wrap>
            {it.shuffled.map((w: string, k: number) => {
              const used = picked.filter((p) => p === w).length >= it.shuffled.filter((x: string) => x === w).length;
              return <Chip key={k} label={w} selected={used} onPress={() => !used && setPicked([...picked, w])} />;
            })}
          </Row>
          <Button title="Limpar" variant="ghost" size="sm" onPress={() => setPicked([])} />
        </Stack>
      ) : (
        <Stack>
          {it.base ? <Card><Text weight="600">{it.base}</Text><Text variant="small" muted>Adicione: {it.add.join(", ")}</Text></Card> : null}
          <Field multiline value={text} onChangeText={setText} placeholder="Escreva (e depois leia em voz alta)" />
        </Stack>
      )}
      {!res ? <Button title="Verificar" onPress={check} disabled={!answer.trim()} /> : (
        <Stack>
          <Banner tone={res.correct ? "success" : "warning"} title={res.correct ? "Muito bem!" : "Quase lá"}>
            {res.expected ? `Forma esperada: ${res.expected}` : res.expanded === false ? "Tente acrescentar mais informação (quando, por quê, contraste…)." : "Veja as sugestões abaixo."}
          </Banner>
          {res.corrections?.map((cr: any, k: number) => <Text key={k} variant="small">✓ {cr.corrected} — {cr.explanation_pt}</Text>)}
          {res.example ? (
            <Card style={{ gap: 6 }}>
              <Text variant="small" muted>Exemplo natural:</Text>
              <Text weight="600">{res.example}</Text>
              <Button title="🔊 Ouvir" size="sm" variant="secondary" onPress={() => speak(res.example)} />
            </Card>
          ) : null}
          <Button title="Próximo" onPress={next} />
        </Stack>
      )}
      <ErrorText error={error} />
    </Screen>
  );
}
