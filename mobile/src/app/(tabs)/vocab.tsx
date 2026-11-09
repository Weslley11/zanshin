import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Card, ErrorText, Field, Loading, ProgressBar, Row, Screen, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { speak } from "../../lib/speech";
import type { Card as VCard } from "../../lib/types";

const KIND_PT: Record<string, string> = {
  phrase: "expressão", phrasal_verb: "phrasal verb", collocation: "collocation", idiom: "idiom", technical: "termo técnico",
  corporate: "corporativo", travel: "viagem", correction: "seu erro", word: "palavra", false_friend: "falso cognato",
  pronunciation: "pronúncia", grammar: "gramática",
};

const RATINGS = [
  { v: 1, label: "Errei" }, { v: 2, label: "Difícil" }, { v: 3, label: "Bom" }, { v: 4, label: "Fácil" },
];

function fmtInterval(days: number) {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  return `${Math.round(days / 30)} m`;
}

export default function Vocab() {
  const { language } = useApp();
  const params = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const [cards, setCards] = useState<VCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [check, setCheck] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const shownAt = useRef(Date.now());
  const sessionStart = useRef(Date.now());

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await api(`/vocab/session?language=${language}&limit=20`);
      setCards(s.cards);
      setIdx(0);
      setDone(0);
      setCheck(null);
      setAnswer("");
      shownAt.current = Date.now();
      sessionStart.current = Date.now();
      setStats(await api(`/vocab/stats?language=${language}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [language]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const card = cards?.[idx];

  const verify = async (giveUp = false) => {
    if (!card) return;
    try {
      const r = await api(`/vocab/cards/${card.card_id}/check`, {
        body: { answer: giveUp ? "" : answer, response_ms: Date.now() - shownAt.current },
      });
      setCheck(r);
      speak(card.item.term, { language });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const rate = async (rating: number) => {
    if (!card) return;
    try {
      await api(`/vocab/cards/${card.card_id}/review`, { body: { rating, response_ms: Date.now() - shownAt.current } });
      setDone((d) => d + 1);
      setCheck(null);
      setAnswer("");
      shownAt.current = Date.now();
      const next = idx + 1;
      setIdx(next);
      if (next >= (cards?.length ?? 0) && params.planDay && params.planActivity) {
        await api("/activities", { body: {
          language, activity_type: "other", duration_seconds: 0, plan_day: Number(params.planDay), plan_activity_id: params.planActivity,
        } });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Screen>
      <Text variant="h2">Revisão espaçada</Text>
      {stats ? (
        <Text variant="small" muted>
          {stats.learned} em revisão · {stats.retained_estimate} retidas (≥85%) · {stats.due_now} vencidas
          {stats.true_retention_30d != null ? ` · retenção real 30d: ${Math.round(stats.true_retention_30d * 100)}%` : ""}
        </Text>
      ) : null}
      <ErrorText error={error} />
      {!cards && !error ? <Loading /> : null}
      {cards && cards.length === 0 ? (
        <Banner tone="success" title="Tudo em dia!">Nenhum cartão vencido agora. O algoritmo FSRS agenda a próxima revisão no momento ideal.</Banner>
      ) : null}

      {cards && card ? (
        <Stack>
          <ProgressBar value={idx / cards.length} />
          <Card style={{ gap: 10 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="label" muted>{card.state === "new" ? "Novo" : "Revisão"} · {KIND_PT[card.item.kind] ?? card.item.kind}</Text>
              <Text variant="tiny" muted>{idx + 1}/{cards.length}</Text>
            </Row>
            <Text variant="h3">{card.prompt.meaning_pt}</Text>
            {card.prompt.cloze ? <Text muted>“{card.prompt.cloze}”</Text> : null}
            <Text variant="small" muted>Recupere a expressão da memória e escreva (ou diga em voz alta) antes de ver a resposta.</Text>
          </Card>
          {!check ? (
            <Stack>
              <Field value={answer} onChangeText={setAnswer} placeholder="Sua resposta" onSubmitEditing={() => verify()} autoFocus />
              <Row>
                <Button title="Verificar" onPress={() => verify()} style={{ flex: 1 }} disabled={!answer.trim()} />
                <Button title="Não lembro" variant="ghost" onPress={() => verify(true)} style={{ flex: 1 }} />
              </Row>
            </Stack>
          ) : (
            <Stack>
              <Card tone={check.correct ? "success" : "danger"} style={{ gap: 6 }}>
                <Text weight="700">{check.correct ? "Isso!" : "Resposta esperada:"}</Text>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text variant="h3" style={{ flex: 1 }}>{card.item.term}</Text>
                  <Button title="🔊" size="sm" variant="ghost" accessibilityLabel="Ouvir pronúncia" onPress={() => speak(card.item.term, { language })} />
                </Row>
                {card.item.pronunciation ? <Text variant="small" muted>{card.item.pronunciation}</Text> : null}
                {card.item.example && card.item.kind !== "correction" ? <Text variant="small">“{card.item.example}”</Text> : null}
                {card.item.definition ? <Text variant="small" muted>{card.item.definition}</Text> : null}
              </Card>
              <Text variant="small" muted>Como foi lembrar? (sugestão destacada)</Text>
              <Row gap={8}>
                {RATINGS.map((r) => (
                  <View key={r.v} style={{ flex: 1, gap: 4 }}>
                    <Button title={r.label} size="sm" variant={check.suggested_rating === r.v ? "primary" : "secondary"} onPress={() => rate(r.v)} />
                    <Text variant="tiny" muted center>{fmtInterval(card.intervals_days[String(r.v)])}</Text>
                  </View>
                ))}
              </Row>
            </Stack>
          )}
        </Stack>
      ) : null}

      {cards && cards.length > 0 && idx >= cards.length ? (
        <Card tone="success" style={{ gap: 8 }}>
          <Text variant="h3">Sessão concluída: {done} cartões</Text>
          <Text variant="small">Use estas expressões hoje na conversa com o tutor — aplicar em contexto consolida a memória.</Text>
          <Button title="Carregar mais" variant="secondary" onPress={load} />
        </Card>
      ) : null}
      <Text variant="tiny" muted center>Agendamento por FSRS-5 com meta de 90% de retenção.</Text>
    </Screen>
  );
}
