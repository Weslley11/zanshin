import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import mascotAnim from "../assets/lottie/mascot.json";
import mascotCheerAnim from "../assets/lottie/mascot-cheer.json";
import Lottie from "../components/Lottie";
import { Celebration, Enter, PressableScale, ProgressRing } from "../components/motion";
import { Banner, Button, Card, Collapsible, ErrorText, Gradient, Icon, Loading, ModuleHero, Pill, ProgressBar, Row, Screen, Stack, Text } from "../components/ui";
import type { IconName } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { tap } from "../lib/haptics";
import { CONTENT } from "../lib/local/content";
import { speak, stopSpeaking } from "../lib/speech";
import { radius, useTheme } from "../lib/theme";
import {
  answerRecall, challengeFor, confidenceSummary, FLUENCY_ROUNDS, METHODS, recallDone, recallRating, startRecall,
  type Recall, type RecallState, type TurboItem, type TurboLog,
} from "../lib/turbo";
import { prefetchRecorded } from "../lib/webAudio";

const KEY = "fluent.turbo.history";
type Step = "intro" | "before" | "recall" | "shadow" | "fluency" | "after" | "done";
const STEPS: { key: Step; label: string; icon: IconName }[] = [
  { key: "recall", label: "Lembrar", icon: "flash" }, { key: "shadow", label: "Imitar", icon: "repeat" },
  { key: "fluency", label: "Fluir", icon: "speedometer" }, { key: "after", label: "Confiança", icon: "heart" },
];
const FACES: { v: number; icon: IconName; label: string }[] = [
  { v: 1, icon: "sad", label: "Travado" }, { v: 2, icon: "sad-outline", label: "Nervoso" }, { v: 3, icon: "remove-circle", label: "Ok" },
  { v: 4, icon: "happy-outline", label: "Tranquilo" }, { v: 5, icon: "happy", label: "Solto" },
];

/** Contagem regressiva simples (segundos), que chama onEnd uma vez. */
function useCountdown(onEnd: () => void) {
  const [left, setLeft] = useState<number | null>(null);
  const total = useRef(1);
  const cb = useRef(onEnd);
  cb.current = onEnd;
  useEffect(() => {
    if (left == null) return;
    if (left <= 0) { cb.current(); return; }
    const t = setTimeout(() => setLeft((l) => (l == null ? null : l - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return {
    left, progress: left == null ? 0 : 1 - left / total.current,
    start: (s: number) => { total.current = s; setLeft(s); }, stop: () => setLeft(null),
  };
}

function Confidence({ value, onChange, question }: { value: number | null; onChange: (v: number) => void; question: string }) {
  const { c } = useTheme();
  return (
    <Stack gap={12}>
      <Text variant="h3" center>{question}</Text>
      <Row gap={6} style={{ justifyContent: "space-between" }}>
        {FACES.map((f) => {
          const sel = value === f.v;
          return (
            <PressableScale key={f.v} onPress={() => { tap(); onChange(f.v); }} accessibilityRole="radio" accessibilityLabel={f.label} style={{ flex: 1 }}>
              <View style={{ alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4,
                             borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primarySoft : c.card }}>
                <Icon name={f.icon} size={28} color={sel ? c.primary : c.textMuted} />
                <Text variant="tiny" weight={sel ? "800" : "500"} color={sel ? c.primary : c.textMuted}>{f.label}</Text>
              </View>
            </PressableScale>
          );
        })}
      </Row>
    </Stack>
  );
}

/** Turbo: os métodos com melhor evidência numa sessão diária de ~15 min para fixar rápido e falar sem medo. */
export default function Turbo() {
  const { c } = useTheme();
  const { profile, language } = useApp();
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const accent = profile?.preferred_accents?.[0] ?? "US";
  const [step, setStep] = useState<Step>("intro");
  const [history, setHistory] = useState<TurboLog[]>([]);
  const [items, setItems] = useState<TurboItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const [after, setAfter] = useState<number | null>(null);
  const [rec, setRec] = useState<RecallState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [shadowIdx, setShadowIdx] = useState(0);
  const [shadowReps, setShadowReps] = useState(0);
  const [round, setRound] = useState(0);
  const [roundDone, setRoundDone] = useState(false);
  const [topic, setTopic] = useState("");
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());
  const say = (t: string, rate = 0.95) => speak(t, { language: "en", accent, rate });

  const countdown = useCountdown(() => {
    if (step === "recall") reveal();
    if (step === "fluency") { setRoundDone(true); tap("success"); }
  });

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(KEY).then((v) => setHistory(v ? JSON.parse(v) : [])).catch(() => {});
    return () => { stopSpeaking(); };
  }, []));

  const load = async () => {
    try {
      const s = await api<any>(`/vocab/session?language=${language}&limit=8`);
      const list: TurboItem[] = s.cards.map((cd: any) => ({ id: cd.card_id, card_id: cd.card_id, en: cd.item.term, pt: cd.item.meaning_pt }));
      setItems(list);
      prefetchRecorded(list.map((i) => i.en), accent);
      const lvl = profile?.cefr_estimate ?? "B1";
      const topics: string[] = CONTENT.drills.topics[lvl] ?? CONTENT.drills.topics.B1 ?? ["Tell me about your typical workday."];
      setTopic(topics[(history.length + new Date().getDate()) % topics.length]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const summary = confidenceSummary(history);
  const challenge = challengeFor(history.length);
  const byId = Object.fromEntries((items ?? []).map((i) => [i.id, i]));
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ------------------------------- ações -------------------------------
  const reveal = () => {
    countdown.stop();
    setRevealed(true);
    const cur = rec && byId[rec.queue[rec.pos]];
    if (cur) say(cur.en, 0.95);
  };
  const askNext = (st: RecallState) => {
    setRevealed(false);
    if (recallDone(st)) {
      setStep("shadow");
      setShadowIdx(0);
      setShadowReps(0);
      return;
    }
    countdown.start(4);
  };
  const answer = (r: Recall) => {
    if (!rec) return;
    tap(r === "ok" ? "success" : "warning");
    const st = answerRecall(rec, r);
    setRec(st);
    askNext(st);
  };

  // frases para imitar: as que deram mais trabalho primeiro
  const shadowList = items && rec
    ? [...items].sort((a, b) => recallRating(rec.attempts[a.id]) - recallRating(rec.attempts[b.id])).slice(0, 3) : [];

  const finish = async () => {
    if (!items || !rec || saved) return;
    setSaved(true);
    const recalled = items.filter((i) => recallRating(rec.attempts[i.id]) >= 2).length;
    const entry: TurboLog = { date: new Date().toISOString().slice(0, 10), before: before ?? 3, after: after ?? 3, recalled, total: items.length };
    const next = [...history, entry].slice(-60);
    setHistory(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    for (const i of items) {
      if (i.card_id) api(`/vocab/cards/${i.card_id}/review`, { body: { rating: recallRating(rec.attempts[i.id]), mode: "turbo" } }).catch(() => {});
    }
    api("/activities", { body: { language, activity_type: "turbo", duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      score: recalled / Math.max(1, items.length), details: { conf_before: entry.before, conf_after: entry.after },
      ...(planDay && planActivity ? { plan_day: Number(planDay), plan_activity_id: planActivity } : {}) } }).catch(() => {});
    setStep("done");
  };

  // ------------------------------- cabeçalho de etapas -------------------------------
  const header = (progress: number) => (
    <Stack gap={10}>
      <Row gap={6} style={{ justifyContent: "space-between" }}>
        {STEPS.map((s, k) => {
          const active = k === stepIndex;
          const done = k < stepIndex;
          return (
            <View key={s.key} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
                             backgroundColor: active ? c.primary : done ? c.success : c.surfaceAlt }}>
                <Icon name={done ? "checkmark" : s.icon} size={18} color={active || done ? "#fff" : c.textMuted} />
              </View>
              <Text variant="tiny" weight={active ? "800" : "500"} color={active ? c.primary : c.textMuted}>{s.label}</Text>
            </View>
          );
        })}
      </Row>
      <ProgressBar value={progress} gradient="unlock" />
    </Stack>
  );

  // ------------------------------- telas -------------------------------
  if (step === "intro") {
    return (
      <Screen>
        <ModuleHero title="Turbo" icon="rocket" gradient="unlock"
          subtitle="15 minutos por dia com os métodos que a pesquisa mais apoia para fixar rápido e falar sem medo." />
        {summary ? (
          <Card style={{ gap: 6 }}>
            <Text variant="label" muted>Sua confiança para falar</Text>
            <Row gap={10}>
              <Text variant="h2">{summary.trendStart.toFixed(1)} → {summary.trendNow.toFixed(1)}</Text>
              <Pill label={`${summary.sessions} sessões`} icon="flame" />
            </Row>
            <Text variant="small" muted>Média antes da sessão (1 = travado, 5 = solto). Depois das sessões você sai, em média, com {summary.avgAfter.toFixed(1)}.</Text>
          </Card>
        ) : null}
        <Stack gap={10}>
          {[
            ["flash", "Lembrar em voz alta", "Você vê o português, fala em inglês antes de ouvir. O que não sair volta logo; o que sair volta mais tarde."],
            ["repeat", "Imitar (shadowing)", "Repita junto com o áudio as frases mais difíceis, copiando o ritmo."],
            ["speedometer", "Fluir (4/3/2)", "Conte a mesma história 3 vezes: 90 s, 60 s, 45 s. A fala acelera sem você perceber."],
            ["heart", "Sem medo", "Você mede a confiança antes e depois e ganha um desafio real pequeno para o dia."],
          ].map(([icon, title, text], k) => (
            <Enter key={title} index={k}>
              <Row gap={12}>
                <Gradient name="unlock" style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon as IconName} size={20} color="#fff" />
                </Gradient>
                <View style={{ flex: 1 }}>
                  <Text weight="800">{title}</Text>
                  <Text variant="small" muted>{text}</Text>
                </View>
              </Row>
            </Enter>
          ))}
        </Stack>
        <Button title="Começar o Turbo de hoje" size="lg" icon="rocket" gradient="unlock" onPress={() => { load(); setStep("before"); }} />
        <Collapsible title="Por que esses métodos (o que a pesquisa diz)">
          <Stack gap={10}>
            {METHODS.map((m) => (
              <View key={m.title_pt} style={{ gap: 2 }}>
                <Text variant="small" weight="800">{m.title_pt}</Text>
                <Text variant="small">{m.how_pt}</Text>
                <Text variant="tiny" muted>{m.evidence_pt}</Text>
              </View>
            ))}
            <Text variant="tiny" muted>Sem promessa milagrosa: a maior parte dos estudos é pequena. O que tem mais força é a combinação de recuperação espaçada com muita fala de baixo risco, todo dia.</Text>
          </Stack>
        </Collapsible>
      </Screen>
    );
  }

  if (step === "before") {
    return (
      <Screen>
        <Lottie source={mascotAnim} style={{ width: 150, height: 140, alignSelf: "center" }} />
        <Confidence value={before} onChange={setBefore} question="Se alguém te chamasse para falar inglês agora, como você se sentiria?" />
        <Text variant="small" muted center>Não tem resposta certa. Vamos comparar com o fim da sessão.</Text>
        <ErrorText error={error} />
        {!items && !error ? <Loading skeleton={false} label="Preparando suas frases…" /> : null}
        <Button title="Vamos lá" size="lg" icon="arrow-forward" gradient="unlock" disabled={before == null || !items}
          onPress={() => {
            if (!items) return;
            const st = startRecall(items.map((i) => i.id));
            setRec(st);
            setStep("recall");
            startedAt.current = Date.now();
            countdown.start(4);
          }} />
      </Screen>
    );
  }

  if (step === "recall" && rec && items) {
    const cur = byId[rec.queue[rec.pos]];
    if (!cur) return <Screen><Loading /></Screen>;
    const tries = rec.attempts[cur.id]?.length ?? 0;
    return (
      <Screen scrollKey={`r${rec.pos}`}>
        {header((rec.pos / rec.queue.length) * 0.25)}
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="label" muted>Diga em inglês · {rec.pos + 1}/{rec.queue.length}</Text>
          {tries ? <Pill label={tries === 1 ? "voltou para você" : `tentativa ${tries + 1}`} icon="refresh" color={c.warning} /> : null}
        </Row>
        <Animated.View key={rec.pos} entering={FadeInRight.duration(220)}>
          <Card style={{ gap: 14, alignItems: "center", paddingVertical: 24 }}>
            <Text variant="h2" center>{cur.pt}</Text>
            {!revealed ? (
              <PressableScale onPress={reveal} accessibilityLabel="Mostrar resposta">
                <ProgressRing value={countdown.progress} size={86} stroke={8} colors={["#FF6A3D", "#FF2E7E"]}>
                  <Icon name="mic" size={30} color="#FF2E7E" />
                </ProgressRing>
              </PressableScale>
            ) : (
              <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", gap: 8 }}>
                <Text variant="h2" center color={c.primary}>{cur.en}</Text>
                <Button title="Ouvir de novo" icon="volume-high" size="sm" variant="secondary" onPress={() => say(cur.en)} />
              </Animated.View>
            )}
            <Text variant="small" muted center>{revealed ? "Você disse algo parecido?" : "Fale em voz alta antes do círculo fechar — errar faz parte."}</Text>
          </Card>
        </Animated.View>
        {revealed ? (
          <Row gap={8}>
            <Button title="Não saiu" variant="danger" style={{ flex: 1 }} onPress={() => answer("miss")} />
            <Button title="Quase" variant="secondary" style={{ flex: 1 }} onPress={() => answer("almost")} />
            <Button title="Saiu!" gradient="vocab" style={{ flex: 1 }} onPress={() => answer("ok")} />
          </Row>
        ) : (
          <Button title="Já falei — mostrar" variant="secondary" icon="eye" onPress={reveal} />
        )}
      </Screen>
    );
  }

  if (step === "shadow") {
    const cur = shadowList[shadowIdx];
    if (!cur) {
      return (
        <Screen>
          {header(0.5)}
          <Button title="Ir para a fluência" size="lg" onPress={() => setStep("fluency")} />
        </Screen>
      );
    }
    const nextShadow = () => {
      if (shadowIdx + 1 < shadowList.length) { setShadowIdx(shadowIdx + 1); setShadowReps(0); }
      else { setStep("fluency"); setRound(0); setRoundDone(false); }
    };
    return (
      <Screen scrollKey={`s${shadowIdx}`}>
        {header(0.25 + (shadowIdx / shadowList.length) * 0.25)}
        <Text variant="label" muted>Imitar · {shadowIdx + 1}/{shadowList.length}</Text>
        <Card style={{ gap: 12, alignItems: "center", paddingVertical: 22 }}>
          <Text variant="h2" center>{cur.en}</Text>
          <Text variant="small" muted center>{cur.pt}</Text>
          <Row gap={8}>
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                                     backgroundColor: k < shadowReps ? c.success : c.surfaceAlt }}>
                {k < shadowReps ? <Icon name="checkmark" size={16} color="#fff" /> : null}
              </View>
            ))}
          </Row>
        </Card>
        <Text variant="small" muted center>Toque, ouça e repita junto (ao mesmo tempo ou logo atrás), copiando o ritmo. 3 vezes.</Text>
        <Button title={shadowReps < 3 ? `Ouvir e repetir (${shadowReps + 1}/3)` : "Próxima frase"} size="lg" icon={shadowReps < 3 ? "volume-high" : "arrow-forward"}
          gradient="shadowing"
          onPress={() => {
            if (shadowReps < 3) { say(cur.en, shadowReps === 0 ? 0.85 : 1); setShadowReps(shadowReps + 1); }
            else nextShadow();
          }} />
      </Screen>
    );
  }

  if (step === "fluency") {
    const secs = FLUENCY_ROUNDS[round];
    const running = countdown.left != null && !roundDone;
    const hints = items ? items.slice(0, 3).map((i) => i.en) : [];
    return (
      <Screen>
        {header(0.5 + (round / FLUENCY_ROUNDS.length) * 0.25)}
        <Text variant="label" muted>Fluir · rodada {round + 1} de 3 · {secs} s</Text>
        <Card style={{ gap: 10 }}>
          <Text variant="small" muted>Fale sobre:</Text>
          <Row gap={8}>
            <Text variant="h3" style={{ flex: 1 }}>{topic}</Text>
            <PressableScale onPress={() => say(topic)} accessibilityLabel="Ouvir o tema">
              <Icon name="volume-high" size={24} color={c.primary} />
            </PressableScale>
          </Row>
          {round > 0 ? <Text variant="small">Mesma história, menos tempo. Não precisa de palavras novas — só não pare.</Text> : (
            <Text variant="small">Fale sem parar até o tempo acabar. Travou? Use "What I mean is…" e continue.</Text>
          )}
        </Card>
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <ProgressRing value={running ? countdown.progress : roundDone ? 1 : 0} size={150} stroke={12} colors={["#FF6A3D", "#FFD43B"]}>
            <Text variant="display">{running ? countdown.left : roundDone ? "✓" : secs}</Text>
            <Text variant="tiny" muted>{running ? "falando…" : roundDone ? "tempo!" : "segundos"}</Text>
          </ProgressRing>
        </View>
        {hints.length && round > 0 ? <Text variant="small" muted center>Tente encaixar: {hints.join(" · ")}</Text> : null}
        {!running && !roundDone ? (
          <Button title={`Começar a falar (${secs} s)`} size="lg" icon="mic" gradient="unlock" onPress={() => { tap(); countdown.start(secs); }} />
        ) : running ? (
          <Button title="Terminei antes" variant="secondary" onPress={() => { countdown.stop(); setRoundDone(true); }} />
        ) : (
          <Button title={round + 1 < FLUENCY_ROUNDS.length ? `Próxima rodada (${FLUENCY_ROUNDS[round + 1]} s)` : "Concluir"} size="lg" icon="arrow-forward"
            onPress={() => {
              setRoundDone(false);
              if (round + 1 < FLUENCY_ROUNDS.length) setRound(round + 1);
              else setStep("after");
            }} />
        )}
      </Screen>
    );
  }

  if (step === "after") {
    return (
      <Screen>
        {header(0.85)}
        <Confidence value={after} onChange={setAfter} question="E agora, falar inglês parece…" />
        <Button title="Ver resultado" size="lg" icon="checkmark-done" disabled={after == null} onPress={finish} />
      </Screen>
    );
  }

  // done
  const recalled = items && rec ? items.filter((i) => recallRating(rec.attempts[i.id]) >= 2).length : 0;
  const delta = (after ?? 0) - (before ?? 0);
  return (
    <Screen scrollKey="done" overlay={<Celebration show trophy={false} />}>
      <Lottie source={mascotCheerAnim} style={{ width: 180, height: 168, alignSelf: "center" }} />
      <Text variant="display" center>Turbo feito!</Text>
      <Row gap={10}>
        {[[`${recalled}/${items?.length ?? 0}`, "frases que saíram"], ["3", "rodadas de fala"], [`${delta >= 0 ? "+" : ""}${delta}`, "confiança"]].map(([v, l]) => (
          <Card key={l} style={{ flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 8 }}>
            <Text variant="h2">{v}</Text>
            <Text variant="tiny" muted center>{l}</Text>
          </Card>
        ))}
      </Row>
      <Banner icon="trophy" title="Desafio de hoje (fora do app)">{challenge.text_pt}</Banner>
      <Text variant="small" muted>As frases foram para a sua Revisão espaçada com a nota de hoje. Amanhã, um novo Turbo — 15 minutos todo dia valem mais do que 2 horas no fim de semana.</Text>
      <Button title="Voltar ao início" icon="home" onPress={() => router.replace("/")} />
    </Screen>
  );
}
