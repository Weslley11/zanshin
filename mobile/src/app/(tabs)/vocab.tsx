import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import successAnim from "../../assets/lottie/success.json";
import Lottie from "../../components/Lottie";
import { Celebration, Enter, FlipCard, PressableScale, ProgressRing } from "../../components/motion";
import { Banner, Button, Card, ErrorText, Field, Gradient, Icon, Loading, Pill, ProgressBar, Row, Screen, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { tap } from "../../lib/haptics";
import { speak } from "../../lib/speech";
import { gradients, useTheme } from "../../lib/theme";
import type { Card as VCard } from "../../lib/types";

const KIND_PT: Record<string, string> = {
  phrase: "expressão", phrasal_verb: "phrasal verb", collocation: "collocation", idiom: "idiom", technical: "termo técnico",
  corporate: "corporativo", travel: "viagem", correction: "seu erro", word: "palavra", false_friend: "falso cognato",
  pronunciation: "pronúncia", grammar: "gramática", indian_english: "inglês indiano",
};
const RATINGS = [
  { v: 1, label: "Errei", color: "#E03131" }, { v: 2, label: "Difícil", color: "#F08C00" },
  { v: 3, label: "Bom", color: "#2F80ED" }, { v: 4, label: "Fácil", color: "#16A34A" },
];

function fmtInterval(days: number) {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} d`;
  return `${Math.round(days / 30)} m`;
}

export default function Vocab() {
  const { language } = useApp();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const [cards, setCards] = useState<VCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [check, setCheck] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [celebrate, setCelebrate] = useState(false);
  const shownAt = useRef(Date.now());

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
      const r = await api(`/vocab/cards/${card.card_id}/check`, { body: { answer: giveUp ? "" : answer, response_ms: Date.now() - shownAt.current } });
      setCheck(r);
      tap(r.correct ? "success" : "warning");
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
      if (next >= (cards?.length ?? 0)) {
        setCelebrate(true);
        if (params.planDay && params.planActivity) {
          await api("/activities", { body: { language, activity_type: "other", duration_seconds: 0, plan_day: Number(params.planDay), plan_activity_id: params.planActivity } });
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const front = card ? (
    <Gradient name="vocab" style={{ borderRadius: 26, padding: 22, minHeight: 230, gap: 12, overflow: "hidden" }}>
      <View style={{ position: "absolute", width: 200, height: 200, borderRadius: 100, right: -60, top: -70, backgroundColor: "rgba(255,255,255,0.13)" }} />
      <Row style={{ justifyContent: "space-between" }}>
        <Pill label={`${card.state === "new" ? "Novo" : "Revisão"} · ${KIND_PT[card.item.kind] ?? card.item.kind}`} color="#fff" bg="rgba(255,255,255,0.22)" />
        <Text variant="tiny" color="rgba(255,255,255,0.9)">{idx + 1}/{cards!.length}</Text>
      </Row>
      <Text variant="h2" color="#FFFFFF">{card.prompt.meaning_pt}</Text>
      {card.prompt.cloze ? <Text color="rgba(255,255,255,0.92)">“{card.prompt.cloze}”</Text> : null}
      <Text variant="tiny" color="rgba(255,255,255,0.85)">Recupere da memória e escreva (ou diga em voz alta) antes de ver a resposta.</Text>
    </Gradient>
  ) : null;

  const back = card && check ? (
    <View style={{ borderRadius: 26, padding: 22, minHeight: 230, gap: 10, backgroundColor: check.correct ? c.successSoft : c.dangerSoft,
                   borderWidth: 1, borderColor: c.border }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Text weight="800" color={check.correct ? c.success : c.danger}>{check.correct ? "Isso!" : "Resposta esperada"}</Text>
        {check.correct ? <Lottie source={successAnim} loop={false} style={{ width: 44, height: 44 }} /> : <Icon name="refresh-circle" size={30} color={c.danger} />}
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="h2" style={{ flex: 1 }}>{card.item.term}</Text>
        <PressableScale onPress={() => speak(card.item.term, { language })} accessibilityLabel="Ouvir pronúncia"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
          <Icon name="volume-high" size={22} color={c.primary} />
        </PressableScale>
      </Row>
      {card.item.pronunciation ? <Text variant="small" muted>{card.item.pronunciation}</Text> : null}
      {card.item.example && card.item.kind !== "correction" ? <Text variant="small">“{card.item.example}”</Text> : null}
      {card.item.definition ? <Text variant="small" muted>{card.item.definition}</Text> : null}
    </View>
  ) : <View />;

  return (
    <Screen overlay={<Celebration show={celebrate} onDone={() => setCelebrate(false)} />}>
      <Enter>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text variant="display">Revisão</Text>
            <Text muted variant="small">Repetição espaçada (FSRS) com recuperação ativa</Text>
          </View>
          {stats ? (
            <ProgressRing value={stats.total ? stats.learned / stats.total : 0} size={74} stroke={8} colors={gradients.vocab}>
              <Text weight="800">{stats.learned}</Text>
              <Text variant="tiny" muted>aprendidas</Text>
            </ProgressRing>
          ) : null}
        </Row>
      </Enter>
      {stats ? (
        <Row wrap gap={6}>
          <Pill icon="shield-checkmark" label={`${stats.retained_estimate} retidas`} />
          <Pill icon="time" label={`${stats.due_now} vencidas`} />
          {stats.true_retention_30d != null ? <Pill icon="analytics" label={`retenção ${Math.round(stats.true_retention_30d * 100)}%`} /> : null}
        </Row>
      ) : null}
      <ErrorText error={error} />
      {!cards && !error ? <Loading /> : null}
      {cards && cards.length === 0 ? (
        <Banner tone="success" title="Tudo em dia!">Nenhum cartão vencido agora. O FSRS agenda a próxima revisão no momento ideal.</Banner>
      ) : null}

      {cards && card ? (
        <Stack>
          <ProgressBar value={idx / cards.length} gradient="vocab" />
          <FlipCard key={card.card_id} flipped={!!check} front={front} back={back} />
          {!check ? (
            <Stack>
              <Field value={answer} onChangeText={setAnswer} placeholder="Sua resposta" onSubmitEditing={() => verify()} />
              <Row>
                <Button title="Verificar" icon="checkmark" gradient="vocab" onPress={() => verify()} style={{ flex: 1 }} disabled={!answer.trim()} />
                <Button title="Não lembro" variant="ghost" onPress={() => verify(true)} style={{ flex: 1 }} />
              </Row>
            </Stack>
          ) : (
            <Stack gap={8}>
              <Text variant="small" muted>Como foi lembrar? (sugestão destacada)</Text>
              <Row gap={8}>
                {RATINGS.map((r) => (
                  <View key={r.v} style={{ flex: 1, gap: 4 }}>
                    <PressableScale onPress={() => rate(r.v)} accessibilityLabel={`${r.label}, próxima revisão em ${fmtInterval(card.intervals_days[String(r.v)])}`}
                      style={{ paddingVertical: 12, borderRadius: 14, alignItems: "center",
                               backgroundColor: check.suggested_rating === r.v ? r.color : c.surfaceAlt,
                               borderWidth: check.suggested_rating === r.v ? 0 : 1, borderColor: c.border }}>
                      <Text weight="800" color={check.suggested_rating === r.v ? "#fff" : c.text}>{r.label}</Text>
                    </PressableScale>
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
          <Text variant="h3">Sessão concluída: {done} cartões 🎉</Text>
          <Text variant="small">Use estas expressões hoje na conversa com o tutor — aplicar em contexto consolida a memória.</Text>
          <Button title="Carregar mais" variant="secondary" icon="refresh" onPress={load} />
        </Card>
      ) : null}
      <Text variant="tiny" muted center>FSRS-5 com meta de 90% de retenção.</Text>
    </Screen>
  );
}
