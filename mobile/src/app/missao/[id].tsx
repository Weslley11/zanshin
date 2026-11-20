import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { AnswerBox } from "../../components/AnswerBox";
import { Celebration, Enter, PressableScale, ProgressRing } from "../../components/motion";
import { Banner, Button, Card, ErrorText, Gradient, Icon, Loading, ModuleHero, Pill, ProgressBar, Row, Screen, Segmented, Stack, Text } from "../../components/ui";
import type { IconName } from "../../components/ui";
import { api } from "../../lib/api";
import { tap } from "../../lib/haptics";
import { checkChunk, checkTurn, missionScore, ratingFor, type Chunk, type Mission, type SayCheck } from "../../lib/missions";
import { speak, stopSpeaking } from "../../lib/speech";
import { prefetchRecorded } from "../../lib/webAudio";
import { radius, useTheme } from "../../lib/theme";

type Step = "intro" | "learn" | "speak" | "listen" | "talk" | "done";
const STEPS: { key: Step; label: string; icon: IconName }[] = [
  { key: "learn", label: "Ouvir", icon: "headset" },
  { key: "speak", label: "Falar", icon: "mic" },
  { key: "listen", label: "Entender", icon: "ear" },
  { key: "talk", label: "Conversar", icon: "chatbubbles" },
];

function shuffleInterleaved(chunks: Chunk[]): string[] {
  // intercala "dizer" e "entender" e embaralha levemente (prática intercalada)
  const say = chunks.filter((c) => c.kind === "say").map((c) => c.id).sort(() => Math.random() - 0.5);
  const hear = chunks.filter((c) => c.kind === "hear").map((c) => c.id).sort(() => Math.random() - 0.5);
  const out: string[] = [];
  while (say.length || hear.length) {
    if (say.length) out.push(say.shift()!);
    if (say.length) out.push(say.shift()!);
    if (hear.length) out.push(hear.shift()!);
  }
  return out;
}

export default function MissionPlayer() {
  const { id, planDay, planActivity } = useLocalSearchParams<{ id: string; planDay?: string; planActivity?: string }>();
  const navigation = useNavigation();
  const { c } = useTheme();
  const [mission, setMission] = useState<Mission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [voice, setVoice] = useState<"IN" | "US">("IN");
  const startedAt = useRef(Date.now());

  // Ouvir
  const [li, setLi] = useState(0);
  // Falar
  const [queue, setQueue] = useState<string[]>([]);
  const [qi, setQi] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [fb, setFb] = useState<{ check: SayCheck; answer: string; gaveUp?: boolean } | null>(null);
  // Entender
  const [ui, setUi] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [listenOk, setListenOk] = useState(0);
  // Conversar
  const [ti, setTi] = useState(0);
  const [turnFb, setTurnFb] = useState<{ ok: boolean; answer: string; tooShort: boolean; portuguese: boolean } | null>(null);
  const [turnTries, setTurnTries] = useState(0);
  const [talkOk, setTalkOk] = useState(0);
  const [showText, setShowText] = useState(false);
  // Resultado
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let mid = id;
        if (!mid || mid === "next") mid = (await api<any>("/india/missions")).next_mission_id;
        const m = await api<Mission>(`/india/missions/${mid}`);
        if (!alive) return;
        setMission(m);
        setVoice(m.accent === "US" ? "US" : "IN");
        // áudio pronto antes de tocar: falas indianas e as frases da missão
        prefetchRecorded([...m.chunks.map((c) => c.cue ?? ""), ...m.chunks.filter((c) => c.kind === "hear").map((c) => c.en),
                          ...m.listen.map((l) => l.say), ...m.dialog.turns.map((t) => t.say)].filter(Boolean), m.accent ?? "IN");
        prefetchRecorded(m.chunks.filter((c) => c.kind === "say").map((c) => c.en));
        navigation.setOptions({ title: `Missão ${m.order}` });
      } catch (e: any) {
        setError(e.message);
      }
    })();
    return () => { alive = false; stopSpeaking(); };
  }, [id]);

  if (!mission) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const chunks = mission.chunks;
  const byId = Object.fromEntries(chunks.map((x) => [x.id, x]));

  const IN = mission.accent ?? "IN"; // sotaque da missão (IN = Índia, US = Wisconsin/EUA)
  const isUS = IN === "US";
  const GR = isUS ? "usa" : "india";
  const say = (text: string, accent: string = IN, rate = 0.95) => speak(text, { language: "en", accent, rate });

  // ------------------------------- transições -------------------------------
  const startLearn = () => {
    startedAt.current = Date.now();
    setStep("learn");
    setLi(0);
    say(chunks[0].en, voice, 0.9);
  };
  const nextLearn = () => {
    if (li + 1 < chunks.length) {
      setLi(li + 1);
      say(chunks[li + 1].en, voice, 0.9);
      return;
    }
    const q = shuffleInterleaved(chunks);
    setQueue(q);
    setQi(0);
    setAttempts({});
    setSolved({});
    setFb(null);
    setStep("speak");
    promptChunk(byId[q[0]]);
  };

  const promptChunk = (ch: Chunk) => {
    if (ch.kind === "hear") say(ch.en, IN, 0.95);
    else if (ch.cue) say(ch.cue, IN, 0.95);
  };

  const current = step === "speak" ? byId[queue[qi]] : undefined;
  const submitChunk = (answer: string, gaveUp = false) => {
    if (!current) return;
    const n = (attempts[current.id] ?? 0) + 1;
    const check = gaveUp ? { ok: false, sim: 0, closest: current.en, diff: [] } : checkChunk(answer, current);
    setAttempts({ ...attempts, [current.id]: n });
    if (check.ok) {
      setSolved({ ...solved, [current.id]: true });
      tap("success");
    } else {
      tap("warning");
      if (n < 2) setQueue([...queue, current.id]); // volta no fim da fila para uma segunda chance
    }
    setFb({ check, answer, gaveUp });
    say(current.en, current.kind === "hear" ? IN : voice, 0.9);
  };
  const nextChunk = () => {
    setFb(null);
    if (qi + 1 < queue.length) {
      setQi(qi + 1);
      promptChunk(byId[queue[qi + 1]]);
      return;
    }
    setStep("listen");
    setUi(0);
    setChoice(null);
    setListenOk(0);
    say(mission.listen[0].say, IN, 1);
  };

  const listenItem = step === "listen" ? mission.listen[ui] : undefined;
  const choose = (k: number) => {
    if (choice != null || !listenItem) return;
    setChoice(k);
    const ok = k === listenItem.answer;
    tap(ok ? "success" : "warning");
    if (ok) setListenOk(listenOk + 1);
  };
  const nextListen = () => {
    setChoice(null);
    if (ui + 1 < mission.listen.length) {
      setUi(ui + 1);
      say(mission.listen[ui + 1].say, IN, 1);
      return;
    }
    setStep("talk");
    setTi(0);
    setTurnFb(null);
    setTurnTries(0);
    setTalkOk(0);
    setShowText(false);
    say(mission.dialog.turns[0].say, IN, 0.95);
  };

  const turn = step === "talk" ? mission.dialog.turns[ti] : undefined;
  const submitTurn = (answer: string) => {
    if (!turn) return;
    const r = checkTurn(answer, turn);
    setTurnTries(turnTries + 1);
    setTurnFb({ ...r, answer });
    tap(r.ok ? "success" : "warning");
    if (r.ok) setTalkOk(talkOk + 1);
  };
  const nextTurn = () => {
    setTurnFb(null);
    setTurnTries(0);
    setShowText(false);
    if (ti + 1 < mission.dialog.turns.length) {
      setTi(ti + 1);
      say(mission.dialog.turns[ti + 1].say, IN, 0.95);
      return;
    }
    finish();
  };

  const finish = async () => {
    const results = chunks.map((ch) => ({ chunk_id: ch.id, rating: ratingFor(!!solved[ch.id], attempts[ch.id] ?? 2) }));
    const speakScore = results.reduce((s, r) => s + (r.rating === 3 ? 1 : r.rating === 2 ? 0.6 : 0), 0) / chunks.length;
    const total = missionScore(speakScore, listenOk / mission.listen.length, talkOk / mission.dialog.turns.length);
    setScore(total);
    setStep("done");
    setSaving(true);
    try {
      setResult(await api("/india/missions/" + mission.id + "/complete", { body: {
        results, score: total, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
        details: { first_try: results.filter((r) => r.rating === 3).length, listen_correct: listenOk, talk_ok: talkOk },
        plan_day: planDay ? Number(planDay) : undefined, plan_activity_id: planActivity,
      } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------- cabeçalho de etapas -------------------------------
  const stepIndex = STEPS.findIndex((s) => s.key === step);
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
      <ProgressBar value={progress} gradient={GR} />
    </Stack>
  );

  // ------------------------------- telas -------------------------------
  if (step === "intro") {
    const sayCount = chunks.filter((x) => x.kind === "say").length;
    return (
      <Screen>
        <ModuleHero title={mission.title_pt} icon={mission.icon as IconName} gradient={GR} subtitle={mission.subtitle_pt}>
          <Row gap={6} wrap>
            <Pill label={`Missão ${mission.order}`} icon="flag" color="#fff" bg="rgba(255,255,255,0.22)" />
            <Pill label={`~${mission.minutes} min`} icon="time" color="#fff" bg="rgba(255,255,255,0.22)" />
            <Pill label={`${chunks.length} frases`} icon="chatbox-ellipses" color="#fff" bg="rgba(255,255,255,0.22)" />
          </Row>
        </ModuleHero>
        <Card style={{ gap: 6 }}>
          <Text variant="label" muted>Objetivo</Text>
          <Text weight="700">{mission.goal_pt}</Text>
        </Card>
        <Stack gap={10}>
          {[
            ["headset", "Ouvir", `Ouça as ${chunks.length} frases com voz ${isUS ? "americana" : "indiana"} e repita em voz alta.`],
            ["mic", "Falar", `Do português para o inglês, falando (${sayCount} frases) — e repita o que ouvir.`],
            ["ear", "Entender", isUS ? "Frases como os americanos do Meio-Oeste dizem, na velocidade normal." : "Frases como os indianos dizem, na velocidade normal."],
            ["chatbubbles", "Conversar", `Mini-conversa com ${mission.dialog.partner}.`],
          ].map(([icon, title, text], k) => (
            <Enter key={title} index={k}>
              <Row gap={12}>
                <Gradient name={GR} style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon as IconName} size={20} color="#fff" />
                </Gradient>
                <View style={{ flex: 1 }}>
                  <Text weight="800">{k + 1}. {title}</Text>
                  <Text variant="small" muted>{text}</Text>
                </View>
              </Row>
            </Enter>
          ))}
        </Stack>
        {!isUS ? <Row gap={10}>
          <Text variant="small" muted>Voz das suas frases</Text>
          <View style={{ flex: 1 }}>
            <Segmented<"IN" | "US"> value={voice} onChange={setVoice} options={[{ value: "IN", label: "Indiana" }, { value: "US", label: "Americana" }]} />
          </View>
        </Row> : null}
        <Button title="Começar missão" size="lg" icon="play" onPress={startLearn} />
        <Text variant="tiny" muted center>Use fones se estiver em público: você vai falar em voz alta. As frases entram na sua revisão espaçada no final.</Text>
      </Screen>
    );
  }

  if (step === "learn") {
    const ch = chunks[li];
    return (
      <Screen scrollKey={`learn-${li}`}>
        {header((li + 1) / chunks.length / 4)}
        <Text variant="label" muted>Frase {li + 1} de {chunks.length} · {ch.kind === "say" ? "você vai dizer" : "você vai ouvir"}</Text>
        <Animated.View key={ch.id} entering={FadeInRight.springify().damping(18)}>
          <Gradient name={GR} style={{ borderRadius: radius.xl, padding: 22, gap: 12 }}>
            {ch.cue ? <Text variant="small" color="rgba(255,255,255,0.92)">Quando alguém disser: “{ch.cue}”</Text> : null}
            <Text variant="h1" color="#fff">{ch.en}</Text>
            <Text color="rgba(255,255,255,0.95)">{ch.pt}</Text>
            <Row gap={8} wrap>
              <Button title={isUS ? "Ouvir (EUA)" : "Ouvir (Índia)"} icon="volume-high" size="sm" variant="secondary" onPress={() => say(ch.en, IN, 0.9)} />
              <Button title="Devagar" icon="speedometer" size="sm" variant="secondary" onPress={() => say(ch.en, voice, 0.7)} />
              {ch.kind === "say" && !isUS ? <Button title="EUA" icon="volume-medium" size="sm" variant="secondary" onPress={() => say(ch.en, "US", 0.9)} /> : null}
            </Row>
          </Gradient>
        </Animated.View>
        {ch.note_pt ? <Banner icon="bulb">{ch.note_pt}</Banner> : null}
        <Card tone="accent"><Text variant="small">Repita em voz alta 2 vezes, imitando o ritmo. Não precisa decorar agora — a próxima etapa puxa da memória.</Text></Card>
        <Button title={li + 1 < chunks.length ? "Repeti — próxima" : "Repeti — vamos falar!"} size="lg" icon="arrow-forward" onPress={nextLearn} />
      </Screen>
    );
  }

  if (step === "speak" && current) {
    const n = attempts[current.id] ?? 0;
    const doneCount = Object.keys(solved).length;
    return (
      <Screen scrollKey={`speak-${qi}`}>
        {header(0.25 + (qi / queue.length) * 0.25)}
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="label" muted>{current.kind === "say" ? "Diga em inglês" : "Ouça e repita"} · {qi + 1}/{queue.length}</Text>
          <Pill label={`${doneCount}/${chunks.length} certas`} icon="checkmark-circle" />
        </Row>
        <Animated.View key={`${current.id}-${qi}`} entering={FadeInRight.springify().damping(18)}>
          <Card style={{ gap: 12, minHeight: 150, justifyContent: "center" }}>
            {current.kind === "say" ? (
              <>
                {current.cue ? (
                  <PressableScale onPress={() => say(current.cue!, IN)} accessibilityLabel="Ouvir de novo">
                    <Row gap={8}><Icon name="volume-high" size={18} color={c.primary} /><Text variant="small" muted style={{ flex: 1 }}>Alguém diz: “{current.cue}”</Text></Row>
                  </PressableScale>
                ) : null}
                <Text variant="h2">{current.pt}</Text>
                {n > 0 && !fb ? <Text variant="tiny" muted>Segunda chance: começa com “{current.en.split(" ").slice(0, 2).join(" ")}…”</Text> : null}
              </>
            ) : (
              <Stack gap={10}>
                <Text variant="h3">O que você ouviu? Repita igualzinho.</Text>
                <Row gap={8} wrap>
                  <Button title="Ouvir de novo" icon="volume-high" size="sm" variant="secondary" onPress={() => say(current.en, IN, 0.95)} />
                  <Button title="Devagar" icon="speedometer" size="sm" variant="ghost" onPress={() => say(current.en, IN, 0.7)} />
                </Row>
              </Stack>
            )}
          </Card>
        </Animated.View>

        {!fb ? (
          <Stack gap={8}>
            <AnswerBox onSubmit={(t) => submitChunk(t)} placeholder={current.kind === "say" ? "Fale ou digite em inglês" : "Fale ou digite o que ouviu"} />
            <Button title="Não sei — mostrar" variant="ghost" size="sm" onPress={() => submitChunk("", true)} />
          </Stack>
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: 10 }}>
            <Card tone={fb.check.ok ? "success" : "warning"} style={{ gap: 8 }}>
              <Text weight="800">{fb.check.ok ? (n <= 1 ? "Perfeito, de primeira!" : "Boa, acertou!") : fb.gaveUp ? "Sem problema — guarde esta:" : "Quase! A frase é:"}</Text>
              <Text variant="h3">{current.en}</Text>
              {current.kind === "hear" ? <Text variant="small">{current.pt}</Text> : null}
              {!fb.check.ok && fb.answer ? (
                <Row wrap gap={4}>
                  <Text variant="small" muted>Você disse: </Text>
                  {fb.check.diff.filter((d) => d.hyp).map((d, k) => (
                    <Text key={k} variant="small" weight="600" color={d.op === "ok" ? c.success : c.danger}>{d.hyp} </Text>
                  ))}
                </Row>
              ) : null}
              {!fb.check.ok && n < 2 ? <Text variant="tiny" muted>Ela volta no fim da rodada para você tentar de novo.</Text> : null}
              <Button title="Ouvir" icon="volume-high" size="sm" variant="secondary" onPress={() => say(current.en, current.kind === "hear" ? IN : voice, 0.9)} />
            </Card>
            <Button title="Continuar" size="lg" icon="arrow-forward" onPress={nextChunk} />
          </Animated.View>
        )}
      </Screen>
    );
  }

  if (step === "listen" && listenItem) {
    return (
      <Screen scrollKey={`listen-${ui}`}>
        {header(0.5 + (ui / mission.listen.length) * 0.25)}
        <Text variant="label" muted>Entender · {ui + 1}/{mission.listen.length}</Text>
        <Card style={{ gap: 12 }}>
          <Row gap={8} wrap>
            <Button title="Ouvir" icon="volume-high" onPress={() => say(listenItem.say, IN, 1)} />
            <Button title="Devagar" icon="speedometer" variant="secondary" onPress={() => say(listenItem.say, IN, 0.75)} />
          </Row>
          <Text variant="h3">{listenItem.question_pt}</Text>
        </Card>
        <Stack gap={10}>
          {listenItem.options_pt.map((o, k) => {
            const isAnswer = k === listenItem.answer;
            const picked = choice === k;
            const tone = choice == null ? undefined : isAnswer ? "success" : picked ? "danger" : undefined;
            return (
              <Card key={k} tone={tone} onPress={() => choose(k)} accessibilityLabel={o}>
                <Row gap={10}>
                  <Icon name={choice == null ? "ellipse-outline" : isAnswer ? "checkmark-circle" : picked ? "close-circle" : "ellipse-outline"} size={22}
                    color={choice == null ? c.textMuted : isAnswer ? c.success : picked ? c.danger : c.textMuted} />
                  <Text style={{ flex: 1 }}>{o}</Text>
                </Row>
              </Card>
            );
          })}
        </Stack>
        {choice != null ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: 10 }}>
            <Card style={{ gap: 6 }}>
              <Text variant="small" muted>O que foi dito:</Text>
              <Text weight="700">{listenItem.say}</Text>
              {listenItem.note_pt ? <Text variant="small">💡 {listenItem.note_pt}</Text> : null}
            </Card>
            <Button title="Continuar" size="lg" icon="arrow-forward" onPress={nextListen} />
          </Animated.View>
        ) : null}
      </Screen>
    );
  }

  if (step === "talk" && turn) {
    const turns = mission.dialog.turns;
    return (
      <Screen scrollKey={`talk-${ti}`}>
        {header(0.75 + (ti / turns.length) * 0.25)}
        <Text variant="label" muted>Conversa com {mission.dialog.partner} · {ti + 1}/{turns.length}</Text>
        <Animated.View key={ti} entering={FadeInRight.springify().damping(18)}>
          <Row gap={10} style={{ alignItems: "flex-end" }}>
            <Gradient name={GR} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
              <Icon name="person" size={20} color="#fff" />
            </Gradient>
            <Card style={{ flex: 1, gap: 8, borderBottomLeftRadius: 6 }}>
              {showText ? <Text weight="600">{turn.say}</Text> : <Text muted>(ouça e tente entender sem ler)</Text>}
              <Row gap={8} wrap>
                <Button title="Ouvir" icon="volume-high" size="sm" variant="secondary" onPress={() => say(turn.say, IN, 0.95)} />
                <Button title={showText ? "Esconder texto" : "Ver texto"} icon={showText ? "eye-off" : "eye"} size="sm" variant="ghost" onPress={() => setShowText(!showText)} />
              </Row>
            </Card>
          </Row>
        </Animated.View>
        <Banner icon="bulb" title="Sua vez">{turn.hint_pt}</Banner>
        {!turnFb ? (
          <AnswerBox onSubmit={submitTurn} placeholder="Responda em inglês" />
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: 10 }}>
            <Card tone={turnFb.ok ? "success" : "warning"} style={{ gap: 8 }}>
              <Text weight="800">
                {turnFb.ok ? "Mandou bem!" : turnFb.portuguese ? "Tente em inglês — frases simples já resolvem." : turnFb.tooShort ? "Tente uma frase completa." : "Faltou a ideia principal."}
              </Text>
              <Text variant="small" muted>Você: “{turnFb.answer}”</Text>
              <Text variant="small">{turnFb.ok ? "Outra forma natural:" : "Uma resposta possível:"}</Text>
              <Text weight="700">{turn.model}</Text>
              <Button title="Ouvir" icon="volume-high" size="sm" variant="secondary" onPress={() => say(turn.model, voice, 0.9)} />
            </Card>
            {!turnFb.ok && turnTries < 2 ? <Button title="Tentar de novo" variant="secondary" icon="refresh" onPress={() => setTurnFb(null)} /> : null}
            <Button title={ti + 1 < turns.length ? "Continuar" : "Concluir missão"} size="lg" icon="arrow-forward" onPress={nextTurn} />
          </Animated.View>
        )}
      </Screen>
    );
  }

  // ------------------------------- resultado -------------------------------
  const firstTry = chunks.filter((ch) => solved[ch.id] && (attempts[ch.id] ?? 0) <= 1).length;
  const nextId = result?.overview?.next_mission_id;
  const allDone = result?.overview && result.overview.completed === result.overview.total;
  return (
    <Screen scrollKey="done" overlay={<Celebration show={!saving && !!result && score >= 0.6} />}>
      <Enter>
        <Gradient name={GR} style={{ borderRadius: radius.xl, padding: 22, alignItems: "center", gap: 10 }}>
          <Text variant="label" color="rgba(255,255,255,0.9)">Missão {mission.order} concluída</Text>
          <ProgressRing value={score} size={120} colors={["#FFFFFF", "#FFE7A3"]} track="rgba(255,255,255,0.25)">
            <Text variant="h1" color="#fff">{Math.round(score * 100)}%</Text>
          </ProgressRing>
          <Text variant="h3" color="#fff" center>{mission.title_pt}</Text>
        </Gradient>
      </Enter>
      <Row gap={10}>
        {[
          [`${firstTry}/${chunks.length}`, "frases de primeira"],
          [`${listenOk}/${mission.listen.length}`, "áudios entendidos"],
          [`${talkOk}/${mission.dialog.turns.length}`, "respostas na conversa"],
        ].map(([v, l]) => (
          <Card key={l} style={{ flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 8 }}>
            <Text variant="h2">{v}</Text>
            <Text variant="tiny" muted center>{l}</Text>
          </Card>
        ))}
      </Row>
      {saving ? <Loading /> : null}
      <ErrorText error={error} />
      {result ? (
        <Banner tone="success" icon="albums" title="Na sua revisão espaçada">
          {`${result.reviewed} frases agendadas (${result.added} novas). As que você errou voltam antes; as fáceis, mais tarde.`}
        </Banner>
      ) : null}
      {score < 0.6 && result ? <Text variant="small" muted>Dica: repita esta missão amanhã — a segunda rodada costuma ser bem mais fácil.</Text> : null}
      <Stack gap={10}>
        {nextId && nextId !== mission.id && !allDone ? (
          <Button title="Próxima missão" size="lg" icon="arrow-forward" onPress={() => router.replace({ pathname: "/missao/[id]", params: { id: nextId } })} />
        ) : null}
        <Button title="Revisar as frases agora" variant="secondary" icon="albums" onPress={() => router.push("/(tabs)/vocab")} />
        <Button title="Mapa das missões" variant="ghost" icon="map" onPress={() => router.replace("/missao")} />
      </Stack>
    </Screen>
  );
}
