import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Button, Card, ErrorText, Field, Loading, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { speak } from "../lib/speech";

export default function Errors() {
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const { language } = useApp();
  const [items, setItems] = useState<any[] | null>(null);
  const [all, setAll] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/errors/review?language=${language}`).then(setItems).catch((e) => setError(e.message));
    api(`/errors?language=${language}`).then(setAll).catch(() => {});
  }, [language]);

  const it = items?.[i];
  const check = async () => {
    try { setRes(await api(`/errors/${it.id}/attempt`, { body: { answer } })); } catch (e: any) { setError(e.message); }
  };
  const next = () => {
    setRes(null);
    setAnswer("");
    setI(i + 1);
    if (items && i + 1 >= items.length && planDay && planActivity) {
      api("/activities", { body: { language, activity_type: "other", duration_seconds: 0, plan_day: Number(planDay), plan_activity_id: planActivity } }).catch(() => {});
    }
  };

  if (!items) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  return (
    <Screen>
      <Text variant="h2">Revisão dos seus erros</Text>
      <Text variant="small" muted>Erros das suas conversas voltam aqui até você acertar 3 vezes seguidas.</Text>
      {items.length === 0 ? <Banner tone="success" title="Nada pendente">Converse com o tutor — os erros recorrentes aparecerão aqui para revisão.</Banner> : null}
      {it ? (
        <Stack>
          <Card style={{ gap: 6 }}>
            <Text variant="label" muted>{i + 1}/{items.length} · {it.subtype || "geral"}</Text>
            <Text variant="h3">{it.prompt}</Text>
            <Text variant="small" muted>{it.instruction_pt}</Text>
          </Card>
          {!res ? (
            <>
              <Field value={answer} onChangeText={setAnswer} placeholder="Reescreva corretamente" onSubmitEditing={check} />
              <Button title="Verificar" onPress={check} disabled={!answer.trim()} />
            </>
          ) : (
            <Stack>
              <Banner tone={res.correct ? "success" : "warning"} title={res.correct ? "Correto!" : "Ainda não"}>
                {res.expected} — {res.explanation_pt}
              </Banner>
              <Button title="🔊 Ouvir e repetir" variant="secondary" size="sm" onPress={() => speak(res.expected, { language })} />
              {res.resolved ? <Text variant="small" muted>Erro superado: saiu da sua lista de revisão. 🎉</Text> : null}
              <Button title="Próximo" onPress={next} />
            </Stack>
          )}
        </Stack>
      ) : items.length ? <Banner tone="success" title="Revisão concluída">Boa! Volte amanhã para consolidar.</Banner> : null}
      {all.length ? (
        <Stack gap={8}>
          <Text variant="h3">Seu caderno de erros</Text>
          {all.slice(0, 20).map((e) => (
            <Card key={e.id} style={{ gap: 2 }}>
              <Text variant="tiny" muted>{e.occurrences}× · {e.subtype || e.category} · acertos seguidos: {e.correct_streak}/3</Text>
              <Text variant="small" weight="600">{e.corrected}</Text>
              <Text variant="tiny" muted>{e.explanation_pt}</Text>
            </Card>
          ))}
        </Stack>
      ) : null}
      <ErrorText error={error} />
    </Screen>
  );
}
