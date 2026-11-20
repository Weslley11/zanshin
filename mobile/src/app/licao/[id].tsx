import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeInRight, SlideInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import flameAnim from "../../assets/lottie/flame.json";
import levelupAnim from "../../assets/lottie/levelup.json";
import mascotCheerAnim from "../../assets/lottie/mascot-cheer.json";
import mascotAnim from "../../assets/lottie/mascot.json";
import { Aurora } from "../../components/Aurora";
import { AnswerBox } from "../../components/AnswerBox";
import Lottie from "../../components/Lottie";
import { AnimatedNumber, Celebration, Enter, PressableScale, ProgressRing } from "../../components/motion";
import { Button, ErrorText, Gradient, Icon, Loading, ProgressBar, Row, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { buildLesson, checkTiles, checkTyped, display, EXERCISE_TITLE, itemRatings, type Exercise, type Item, type Lesson } from "../../lib/course";
import { useDailyGoal } from "../../lib/coursePrefs";
import { tap } from "../../lib/haptics";
import { speak, stopSpeaking } from "../../lib/speech";
import { prefetchRecorded } from "../../lib/webAudio";
import { radius, useTheme } from "../../lib/theme";

type Entry = { ex: Exercise; retry: boolean };
type Feedback = { ok: boolean; correct: string; extra?: string };

const PRAISE = ["Excelente!", "Mandou bem!", "Isso aí!", "Perfeito!", "Muito bom!"];

/** Lição da Trilha: exercícios curtos, erros voltam no fim, XP e meta diária. */
export default function LessonPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useApp();
  const { c } = useTheme();
  const [goal] = useDailyGoal();
  const accent = profile?.preferred_accents?.[0] ?? "US";
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [queue, setQueue] = useState<Entry[]>([]);
  const [pos, setPos] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [log, setLog] = useState<{ itemId: string; ok: boolean; firstTry: boolean }[]>([]);
  const [firstOk, setFirstOk] = useState(0);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());
  const xpBefore = useRef(0);

  useEffect(() => {
    api<Lesson>(`/course/lessons/${id}`).then((l) => {
      setLesson(l);
      prefetchRecorded(l.items.map((i) => i.en), accent); // áudio pronto antes do primeiro "Ouvir"
    }).catch((e) => setError(e.message));
    api<any>("/course").then((o) => { xpBefore.current = o.xp_today; }).catch(() => {});
    return () => { stopSpeaking(); };
  }, [id]);

  const exercises = useMemo(() => (lesson ? buildLesson(lesson, String(Date.now() % 100000)) : []), [lesson]);
  const total = exercises.length;
  const say = (text: string, rate = 0.95) => speak(text, { language: "en", accent, rate });
  const autoplay = (e?: Exercise) => {
    if (!e) return;
    if (e.type === "choose_pt" || e.type === "listen_build") say(e.item.en);
  };

  if (!lesson) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}><ErrorText error={error} />{!error ? <Loading /> : null}</SafeAreaView>;
  }

  const start = () => {
    setQueue(exercises.map((ex) => ({ ex, retry: false })));
    setStarted(true);
    startedAt.current = Date.now();
    autoplay(exercises[0]);
  };

  const current = queue[pos];
  const answered = (ok: boolean, correct: string, extra?: string) => {
    const e = current.ex;
    if ("item" in e) setLog((l) => [...l, { itemId: e.item.id, ok, firstTry: !current.retry }]);
    if (!current.retry && ok) setFirstOk((n) => n + 1);
    if (!ok) setQueue((q) => [...q, { ex: current.ex, retry: true }]); // errou: volta no fim
    setCombo(ok ? combo + 1 : 0);
    tap(ok ? "success" : "warning");
    setFb({ ok, correct, extra });
    if ("item" in e && e.type !== "listen_build") say(e.item.en, 0.95);
  };

  const next = () => {
    setFb(null);
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      autoplay(queue[pos + 1].ex);
      return;
    }
    finish();
  };

  const finish = async () => {
    setSaving(true);
    setResult({ pending: true });
    try {
      const res = await api<any>(`/course/lessons/${lesson.id}/complete`, { body: {
        results: itemRatings(lesson.items, log), correct_first: firstOk, total,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      } });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------- abertura -------------------------------
  if (!started) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <Aurora />
        <View style={{ flex: 1, padding: 20, justifyContent: "space-between", maxWidth: 560, width: "100%", alignSelf: "center" }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Fechar" hitSlop={12}><Icon name="close" size={28} color={c.textMuted} /></Pressable>
          <Enter>
            <Stack gap={14}>
              <Lottie source={mascotAnim} style={{ width: 180, height: 168, alignSelf: "center" }} />
              <Text variant="label" muted center>Unidade {lesson.unit_order} · {lesson.unit_title_pt}</Text>
              <Text variant="display" center>{lesson.kind === "review" ? "Revisão da unidade" : lesson.title_pt}</Text>
              <Text muted center>
                {lesson.kind === "review" ? `${lesson.items.length} itens misturados — sem aprender nada novo, só fixar.` : `${lesson.items.length} frases/palavras novas · ${total} exercícios · ~3 min`}
              </Text>
              {lesson.kind === "learn" ? (
                <Stack gap={6}>
                  {lesson.items.map((it) => (
                    <Row key={it.id} gap={8}><Icon name="ellipse" size={8} color={c.primary} /><Text variant="small" style={{ flex: 1 }}><Text variant="small" weight="700">{display(it.en)}</Text> — {it.pt}</Text></Row>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Enter>
          <Stack gap={8}>
            <Button title="Começar" size="lg" icon="play" onPress={start} />
            <Text variant="tiny" muted center>Ligue o som: alguns exercícios são de ouvir.</Text>
          </Stack>
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------- resultado -------------------------------
  if (result) {
    const xpToday = result.xp_today ?? xpBefore.current;
    const goalJustReached = !result.pending && xpBefore.current < goal && xpToday >= goal;
    const accuracy = Math.round((firstOk / Math.max(1, total)) * 100);
    const secs = Math.round((Date.now() - startedAt.current) / 1000);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <Aurora intensity={1.3} />
        <Celebration show={!result.pending} trophy={false} />
        <View style={{ flex: 1, padding: 20, justifyContent: "space-between", maxWidth: 560, width: "100%", alignSelf: "center" }}>
          <View />
          {result.pending || saving ? <Loading /> : (
            <Enter>
              <Stack gap={18}>
                <View style={{ alignItems: "center", height: 170 }}>
                  <Lottie source={levelupAnim} loop={false} style={{ position: "absolute", width: 220, height: 220, top: -30 }} />
                  <Lottie source={mascotCheerAnim} style={{ width: 190, height: 178 }} />
                </View>
                <Text variant="display" center>{result.perfect ? "Lição perfeita!" : "Lição concluída!"}</Text>
                <Row gap={10}>
                  {[
                    ["flash", "#F5B700", <AnimatedNumber key="x" value={result.xp} render={(s) => <Text variant="h2">+{s}</Text>} />, "XP"],
                    ["checkmark-done", c.success, <Text key="a" variant="h2">{accuracy}%</Text>, "de primeira"],
                    ["time", c.primary, <Text key="t" variant="h2">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</Text>, "tempo"],
                  ].map(([icon, color, value, label]) => (
                    <View key={label as string} style={{ flex: 1, alignItems: "center", gap: 4, padding: 12, borderRadius: radius.lg, borderWidth: 2, borderColor: color as string, backgroundColor: c.surface }}>
                      <Icon name={icon as any} size={20} color={color as string} />
                      {value as any}
                      <Text variant="tiny" muted>{label as string}</Text>
                    </View>
                  ))}
                </Row>
                <Row gap={14} style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: 14 }}>
                  <ProgressRing value={Math.min(1, xpToday / goal)} size={64} stroke={7} colors={xpToday >= goal ? ["#22C55E", "#86EFAC"] : ["#F5B700", "#FF7A00"]}>
                    <Text weight="800" variant="small">{Math.min(xpToday, 999)}</Text>
                  </ProgressRing>
                  <View style={{ flex: 1 }}>
                    <Text weight="800">{goalJustReached ? "Meta diária batida! 🎉" : xpToday >= goal ? "Meta do dia cumprida" : `Faltam ${goal - xpToday} XP para a meta`}</Text>
                    <Row gap={4}>
                      <Lottie source={flameAnim} style={{ width: 26, height: 26 }} />
                      <Text variant="small" muted>{result.streak_days} {result.streak_days === 1 ? "dia" : "dias"} seguidos</Text>
                    </Row>
                  </View>
                </Row>
                <Text variant="small" muted center>{result.reviewed} itens foram para a sua Revisão espaçada.</Text>
              </Stack>
            </Enter>
          )}
          <Button title="Continuar" size="lg" icon="arrow-forward" disabled={!!result.pending} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------- exercício -------------------------------
  const e = current.ex;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Aurora intensity={0.6} />
      <View style={{ flex: 1, maxWidth: 620, width: "100%", alignSelf: "center" }}>
        <Row gap={12} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Sair da lição" hitSlop={12}><Icon name="close" size={28} color={c.textMuted} /></Pressable>
          <View style={{ flex: 1 }}><ProgressBar value={pos / queue.length} height={14} gradient="vocab" /></View>
          {combo >= 3 ? <Animated.View entering={FadeIn}><Row gap={2}><Icon name="flame" size={18} color="#FF7A00" /><Text weight="800" color="#FF7A00">{combo}</Text></Row></Animated.View> : null}
        </Row>
        <Animated.View key={pos} entering={FadeInRight.springify().damping(20)} style={{ flex: 1, padding: 16, gap: 14 }}>
          {current.retry ? <Row gap={6}><Icon name="refresh" size={16} color={c.warning} /><Text variant="tiny" weight="800" color={c.warning}>ERRO ANTERIOR — TENTE DE NOVO</Text></Row> : null}
          <Text variant="h2">{EXERCISE_TITLE[e.type]}</Text>
          <ExerciseView key={`${pos}-${e.type}`} ex={e} disabled={!!fb} onAnswer={answered} say={say} />
        </Animated.View>
      </View>
      {fb ? (
        <Animated.View entering={SlideInDown.springify().damping(20)}
          style={{ padding: 18, paddingBottom: 30, gap: 10, backgroundColor: fb.ok ? c.successSoft : c.dangerSoft }}>
          <Row gap={8}>
            <Icon name={fb.ok ? "checkmark-circle" : "close-circle"} size={28} color={fb.ok ? c.success : c.danger} />
            <Text variant="h3" color={fb.ok ? c.success : c.danger}>{fb.ok ? PRAISE[pos % PRAISE.length] : "Resposta correta:"}</Text>
          </Row>
          {!fb.ok ? <Text weight="700">{fb.correct}</Text> : null}
          {fb.extra ? <Text variant="small">{fb.extra}</Text> : null}
          <Button title="Continuar" size="lg" onPress={next} gradient={fb.ok ? "vocab" : "speak"} />
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

// =============================== exercícios ===============================
function ExerciseView({ ex, disabled, onAnswer, say }: {
  ex: Exercise; disabled: boolean; onAnswer: (ok: boolean, correct: string, extra?: string) => void; say: (t: string, rate?: number) => void;
}) {
  switch (ex.type) {
    case "choose_pt":
      return (
        <Choice options={ex.options} answer={ex.answer} disabled={disabled}
          header={<SpeakerPrompt text={display(ex.item.en)} onPlay={(r) => say(ex.item.en, r)} />}
          onAnswer={(ok) => onAnswer(ok, ex.options[ex.answer], `${display(ex.item.en)} = ${ex.item.pt}`)} />
      );
    case "choose_en":
      return (
        <Choice options={ex.options} answer={ex.answer} disabled={disabled} header={<Prompt text={ex.item.pt} />}
          onAnswer={(ok) => onAnswer(ok, ex.options[ex.answer])} />
      );
    case "cloze":
      return (
        <Choice options={ex.options} answer={ex.answer} disabled={disabled} chips
          header={<Prompt text={ex.sentence} sub={ex.item.pt} />}
          onAnswer={(ok) => onAnswer(ok, ex.sentence.replace("_____", ex.options[ex.answer]))} />
      );
    case "build":
    case "listen_build":
      return (
        <Tiles ex={ex} disabled={disabled} say={say}
          onAnswer={(ok) => onAnswer(ok, ex.item.en, ex.type === "listen_build" ? ex.item.pt : undefined)} />
      );
    case "match":
      return <Match pairs={ex.pairs} disabled={disabled} say={say} onDone={(ok) => onAnswer(ok, ok ? "" : "Revise os pares que você trocou.")} />;
    case "type":
      return (
        <Stack gap={14}>
          <Prompt text={ex.item.pt} />
          {!disabled ? <AnswerBox placeholder="Fale ou digite em inglês" onSubmit={(t) => {
            const r = checkTyped(t, ex.item);
            onAnswer(r.ok, ex.item.en, r.ok ? undefined : `Você: “${t}”`);
          }} /> : null}
        </Stack>
      );
  }
}

function Prompt({ text, sub }: { text: string; sub?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ padding: 16, borderRadius: radius.lg, borderWidth: 2, borderColor: c.border, backgroundColor: c.surface, gap: 6 }}>
      <Text variant="h3">{text}</Text>
      {sub ? <Text variant="small" muted>{sub}</Text> : null}
    </View>
  );
}

function SpeakerPrompt({ text, onPlay, hideText }: { text: string; onPlay: (rate?: number) => void; hideText?: boolean }) {
  const { c } = useTheme();
  return (
    <Row gap={12}>
      <PressableScale onPress={() => onPlay(0.95)} accessibilityLabel="Ouvir" scaleTo={0.9}>
        <Gradient name="listening" style={{ width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
          <Icon name="volume-high" size={30} color="#fff" />
        </Gradient>
      </PressableScale>
      <PressableScale onPress={() => onPlay(0.65)} accessibilityLabel="Ouvir devagar" scaleTo={0.9}>
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceAlt }}>
          <Icon name="speedometer" size={22} color={c.primary} />
        </View>
      </PressableScale>
      {!hideText ? <Text variant="h3" style={{ flex: 1 }}>{text}</Text> : <Text muted style={{ flex: 1 }}>Toque para ouvir de novo (ou devagar)</Text>}
    </Row>
  );
}

function Choice({ options, answer, onAnswer, disabled, header, chips }: {
  options: string[]; answer: number; onAnswer: (ok: boolean) => void; disabled: boolean; header: ReactNode; chips?: boolean;
}) {
  const { c } = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  return (
    <View style={{ flex: 1, gap: 14 }}>
      {header}
      <View style={{ gap: 10, flexDirection: chips ? "row" : "column", flexWrap: "wrap" }}>
        {options.map((o, k) => {
          const isSel = sel === k;
          const border = checked ? (k === answer ? c.success : isSel ? c.danger : c.border) : isSel ? c.primary : c.border;
          const bg = checked ? (k === answer ? "rgba(34,197,94,0.12)" : isSel ? "rgba(239,68,68,0.10)" : c.surface) : isSel ? c.primarySoft : c.surface;
          return (
            <PressableScale key={k} disabled={checked || disabled} onPress={() => { setSel(k); tap(); }} accessibilityLabel={o} accessibilityRole="radio" scaleTo={0.97}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4, borderColor: border, backgroundColor: bg }}>
                <Text weight="600">{o}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      {!checked ? (
        <Button title="Verificar" size="lg" disabled={sel == null} onPress={() => { setChecked(true); onAnswer(sel === answer); }} />
      ) : null}
    </View>
  );
}

function Tiles({ ex, onAnswer, disabled, say }: {
  ex: Extract<Exercise, { type: "build" | "listen_build" }>; onAnswer: (ok: boolean) => void; disabled: boolean; say: (t: string, rate?: number) => void;
}) {
  const { c } = useTheme();
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const tile = (w: string, onPress: () => void, k: string, ghost = false) => (
    <PressableScale key={k} onPress={onPress} disabled={ghost || checked || disabled} accessibilityLabel={w} scaleTo={0.92}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderBottomWidth: ghost ? 2 : 4,
                     borderColor: c.border, backgroundColor: ghost ? c.surfaceAlt : c.surface }}>
        <Text weight="600" color={ghost ? "transparent" : c.text}>{w}</Text>
      </View>
    </PressableScale>
  );
  return (
    <View style={{ flex: 1, gap: 16 }}>
      {ex.type === "listen_build"
        ? <SpeakerPrompt text="" hideText onPlay={(r) => say(ex.item.en, r)} />
        : <Prompt text={ex.item.pt} />}
      <View style={{ minHeight: 110, borderBottomWidth: 2, borderTopWidth: 2, borderColor: c.border, paddingVertical: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
        {picked.map((i, k) => tile(ex.tiles[i], () => setPicked(picked.filter((_, j) => j !== k)), `p${k}`))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {ex.tiles.map((w, i) => tile(w, () => { setPicked([...picked, i]); tap(); }, `b${i}`, picked.includes(i)))}
      </View>
      <View style={{ flex: 1 }} />
      {!checked ? (
        <Button title="Verificar" size="lg" disabled={!picked.length} onPress={() => { setChecked(true); onAnswer(checkTiles(picked.map((i) => ex.tiles[i]), ex.item)); }} />
      ) : null}
    </View>
  );
}

function Match({ pairs, onDone, disabled, say }: { pairs: Item[]; onDone: (ok: boolean) => void; disabled: boolean; say: (t: string, rate?: number) => void }) {
  const { c } = useTheme();
  const left = useMemo(() => [...pairs].sort((a, b) => (a.id < b.id ? -1 : 1)), [pairs]);
  const right = useMemo(() => [...pairs].sort((a, b) => (a.pt.length % 3) - (b.pt.length % 3) || (a.pt < b.pt ? -1 : 1)), [pairs]);
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    if (!selL || !selR) return;
    if (selL === selR) {
      const next = [...done, selL];
      setDone(next);
      tap("success");
      if (next.length === pairs.length) setTimeout(() => onDone(mistakes === 0), 250);
    } else {
      setMistakes((m) => m + 1);
      setWrong([selL, selR]);
      tap("warning");
      setTimeout(() => setWrong([]), 450);
    }
    setSelL(null);
    setSelR(null);
  }, [selL, selR]);

  const cell = (id: string, label: string, side: "l" | "r") => {
    const isDone = done.includes(id);
    const isSel = side === "l" ? selL === id : selR === id;
    const isWrong = wrong.length && (side === "l" ? wrong[0] === id : wrong[1] === id);
    return (
      <PressableScale key={side + id} disabled={isDone || disabled} accessibilityLabel={label}
        onPress={() => { if (side === "l") { setSelL(id); say(pairs.find((p) => p.id === id)!.en); } else setSelR(id); }} scaleTo={0.95}>
        <View style={{ minHeight: 56, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4,
                       borderColor: isWrong ? c.danger : isSel ? c.primary : c.border, backgroundColor: isDone ? c.surfaceAlt : isSel ? c.primarySoft : c.surface,
                       opacity: isDone ? 0.45 : 1 }}>
          <Text variant="small" weight="600" center>{label}</Text>
        </View>
      </PressableScale>
    );
  };
  return (
    <Row gap={10} style={{ alignItems: "flex-start" }}>
      <View style={{ flex: 1, gap: 10 }}>{left.map((p) => cell(p.id, display(p.en), "l"))}</View>
      <View style={{ flex: 1, gap: 10 }}>{right.map((p) => cell(p.id, p.pt, "r"))}</View>
    </Row>
  );
}
