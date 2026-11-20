import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { Celebration, Enter, PressableScale, ProgressRing } from "../components/motion";
import { Banner, Button, Card, Chip, ErrorText, Icon, Loading, ModuleHero, Pill, ProgressBar, Row, Screen, Segmented, Stack, Text } from "../components/ui";
import type { IconName } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { tap } from "../lib/haptics";
import { speak, stopSpeaking } from "../lib/speech";
import { buildQuiz, quizRating, type Guide, type GuideItem, type QuizQuestion } from "../lib/speechGuide";
import { radius, useTheme } from "../lib/theme";
import { prefetchRecorded } from "../lib/webAudio";

type Code = "IN" | "US";
const TABS: { id: string; label: string }[] = [
  { id: "pron", label: "Pronúncia" }, { id: "daily", label: "Dia a dia" }, { id: "slang", label: "Gírias" },
  { id: "style", label: "Conversa" }, { id: "accents", label: "Sotaques" },
];

/** Um item do guia: frase com áudio (normal, devagar e "rápido"), significado, como soa e a dica. */
function ItemCard({ item, accent, color }: { item: GuideItem; accent: string; color: string }) {
  const { c } = useTheme();
  const say = (t: string, rate: number) => speak(t, { language: "en", accent, rate });
  return (
    <Card style={{ gap: 6 }}>
      <PressableScale onPress={() => say(item.en, 0.95)} accessibilityLabel={`Ouvir: ${item.en}`}>
        <Row gap={10}>
          <Icon name="volume-high" size={22} color={color} />
          <Text weight="800" style={{ flex: 1 }}>{item.en}</Text>
        </Row>
      </PressableScale>
      <Text variant="small">{item.pt}</Text>
      {item.sounds_pt ? <Text variant="small" color={color}>Soa como: “{item.sounds_pt}”</Text> : null}
      <Text variant="small" muted>{item.note_pt}</Text>
      <Row gap={8} wrap>
        <Button title="Devagar" icon="speedometer" size="sm" variant="secondary" onPress={() => say(item.en, 0.7)} />
        {item.fast ? <Button title="Na fala rápida" icon="flash" size="sm" variant="secondary" onPress={() => say(item.fast!, 1)} /> : null}
      </Row>
    </Card>
  );
}

export default function SpeechGuide() {
  const { c } = useTheme();
  const { profile } = useApp();
  const params = useLocalSearchParams<{ country?: string }>();
  const initial: Code = params.country === "US" || (!params.country && profile?.trip_destination === "US") ? "US" : "IN";
  const [code, setCode] = useState<Code>(initial);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("pron");
  // treino de ouvido
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [qi, setQi] = useState(0);
  const [replays, setReplays] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<{ item_id: string; rating: number; correct: boolean }[]>([]);
  const [saved, setSaved] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setGuide(null);
    setError(null);
    api<Guide>(`/guides/${code}`).then((g) => {
      setGuide(g);
      const all = g.sections.flatMap((s) => s.items);
      prefetchRecorded([...all.map((i) => i.en), ...all.map((i) => i.fast ?? "").filter(Boolean)], g.accent);
    }).catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, [code]);

  const color = code === "IN" ? "#E8590C" : "#1E40AF";
  const play = (q: QuizQuestion, rate = 0.95) => {
    setReplays((n) => n + 1);
    speak(q.item.en, { language: "en", accent: guide?.accent ?? "US", rate });
  };

  const startQuiz = (sectionId?: string) => {
    if (!guide) return;
    tap();
    const q = buildQuiz(guide, 10, Date.now(), sectionId);
    setQuiz(q);
    setQi(0);
    setPicked(null);
    setResults([]);
    setSaved(null);
    setReplays(0);
    startedAt.current = Date.now();
    setTimeout(() => q[0] && play(q[0]), 300);
  };

  const saveQuiz = async (rs: typeof results) => {
    if (!guide) return;
    setSaving(true);
    try {
      setSaved(await api(`/guides/${guide.code}/complete`, { body: { results: rs.map(({ item_id, rating }) => ({ item_id, rating })),
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000) } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const picker = (
    <Segmented<Code> value={code} onChange={(v) => { setQuiz(null); setCode(v); }}
      options={[{ value: "IN", label: "Índia" }, { value: "US", label: "EUA (Wisconsin)" }]} />
  );
  if (!guide) return <Screen>{picker}<ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;

  // ------------------------------- treino de ouvido -------------------------------
  if (quiz) {
    if (qi >= quiz.length) {
      const right = results.filter((r) => r.correct).length;
      return (
        <Screen scrollKey="quiz-done" overlay={<Celebration show={!!saved && right / quiz.length >= 0.7} />}>
          <Card style={{ alignItems: "center", gap: 8 }}>
            <Text variant="label" muted>Treino de ouvido · {guide.title_pt}</Text>
            <ProgressRing value={right / quiz.length} size={116}>
              <Text variant="h1">{right}/{quiz.length}</Text>
            </ProgressRing>
            <Text variant="small" muted center>entendidas</Text>
          </Card>
          {saving ? <Loading /> : null}
          <ErrorText error={error} />
          {saved ? (
            <Banner tone="success" icon="albums" title="Na sua revisão espaçada">
              {`${saved.reviewed} frases agendadas (${saved.added} novas). As que você errou voltam antes.`}
            </Banner>
          ) : null}
          {results.filter((r) => !r.correct).length ? <Text variant="label" muted>Para ouvir de novo</Text> : null}
          {results.filter((r) => !r.correct).map((r) => {
            const item = quiz.find((q) => q.item.id === r.item_id)!.item;
            return <ItemCard key={item.id} item={item} accent={guide.accent} color={color} />;
          })}
          <Button title="Outro treino" size="lg" icon="refresh" onPress={() => startQuiz()} />
          <Button title="Voltar ao guia" variant="ghost" icon="arrow-back" onPress={() => setQuiz(null)} />
        </Screen>
      );
    }
    const q = quiz[qi];
    const answered = picked != null;
    const correct = picked === q.answer;
    const choose = (k: number) => {
      if (answered) return;
      const ok = k === q.answer;
      tap(ok ? "success" : "warning");
      setPicked(k);
      setResults((rs) => [...rs, { item_id: q.item.id, rating: quizRating(ok, replays), correct: ok }]);
    };
    const next = () => {
      const n = qi + 1;
      if (n >= quiz.length) saveQuiz(results);
      setQi(n);
      setPicked(null);
      setReplays(0);
      if (quiz[n]) setTimeout(() => play(quiz[n]), 250);
    };
    return (
      <Screen scrollKey={`q-${qi}`}>
        <ProgressBar value={qi / quiz.length} gradient={code === "IN" ? "india" : "usa"} />
        <Text variant="label" muted>Treino de ouvido · {qi + 1} de {quiz.length} · {TABS.find((t) => t.id === q.section)?.label}</Text>
        <Animated.View key={q.item.id} entering={FadeInRight.springify().damping(18)}>
          <Card style={{ alignItems: "center", gap: 12, paddingVertical: 22 }}>
            <PressableScale onPress={() => play(q)} accessibilityLabel="Ouvir a frase">
              <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: color }}>
                <Icon name="volume-high" size={40} color="#fff" />
              </View>
            </PressableScale>
            <Row gap={8}>
              <Button title="De novo" icon="refresh" size="sm" variant="secondary" onPress={() => play(q)} />
              <Button title="Devagar" icon="speedometer" size="sm" variant="secondary" onPress={() => play(q, 0.7)} />
            </Row>
            <Text variant="small" muted center>{answered ? "" : "Ouça sem ler. O que a pessoa quis dizer?"}</Text>
            {answered ? <Text variant="h3" center>{q.item.en}</Text> : null}
          </Card>
        </Animated.View>
        <Stack gap={8}>
          {q.options.map((o, k) => {
            const isAns = k === q.answer;
            const border = answered ? (isAns ? c.success : k === picked ? c.danger : c.border) : c.border;
            return (
              <PressableScale key={o} onPress={() => choose(k)} accessibilityLabel={o} disabled={answered}>
                <View style={{ padding: 14, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4, borderColor: border, backgroundColor: c.card,
                               flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {answered && (isAns || k === picked) ? <Icon name={isAns ? "checkmark-circle" : "close-circle"} size={22} color={isAns ? c.success : c.danger} /> : null}
                  <Text weight="700" style={{ flex: 1 }}>{o}</Text>
                </View>
              </PressableScale>
            );
          })}
        </Stack>
        {answered ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ gap: 10 }}>
            <Banner tone={correct ? "success" : "warning"} icon={correct ? "checkmark-circle" : "bulb"} title={correct ? "Entendeu!" : "Quase. Ouça de novo:"}>
              {q.item.note_pt}
            </Banner>
            {q.item.sounds_pt ? <Text variant="small" color={color}>Soa como: “{q.item.sounds_pt}”</Text> : null}
            <Button title={qi + 1 < quiz.length ? "Próxima" : "Ver resultado"} size="lg" icon="arrow-forward" onPress={next} />
          </Animated.View>
        ) : null}
      </Screen>
    );
  }

  // ------------------------------- guia -------------------------------
  const section = guide.sections.find((s) => s.id === tab);
  return (
    <Screen scrollKey={`${code}-${tab}`}>
      {picker}
      <ModuleHero title="Como eles falam" icon={guide.icon as IconName} gradient={code === "IN" ? "india" : "usa"} subtitle={guide.intro_pt}>
        <Row gap={6} wrap>
          <Pill label={`${guide.sections.reduce((n, s) => n + s.items.length, 0)} frases com áudio`} icon="volume-high" color="#fff" bg="rgba(255,255,255,0.22)" />
        </Row>
      </ModuleHero>

      <Enter index={1}>
        <Card onPress={() => startQuiz()} accessibilityLabel="Treino de ouvido" style={{ gap: 6, borderColor: c.primary, borderWidth: 1.5 }}>
          <Row gap={12}>
            <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: color }}>
              <Icon name="ear" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="800">Treino de ouvido · 10 frases</Text>
              <Text variant="small" muted>Ouça sem ler e escolha o significado. O que você errar entra na revisão.</Text>
            </View>
            <Icon name="play-circle" size={34} color={c.primary} />
          </Row>
        </Card>
      </Enter>

      <Row gap={6} wrap>
        {TABS.map((t) => <Chip key={t.id} label={t.label} selected={tab === t.id} onPress={() => { tap(); setTab(t.id); }} />)}
      </Row>

      {section ? (
        <>
          <Text variant="small" muted>{section.intro_pt}</Text>
          {section.items.map((it, k) => (
            <Enter key={it.id} index={k}><ItemCard item={it} accent={guide.accent} color={color} /></Enter>
          ))}
          <Button title={`Treinar só "${TABS.find((t) => t.id === tab)?.label}"`} variant="secondary" icon="ear" onPress={() => startQuiz(tab)} />
        </>
      ) : (
        <Stack gap={10}>
          {guide.accents.map((a) => (
            <Card key={a.title_pt} style={{ gap: 4, borderLeftWidth: 5, borderLeftColor: color }}>
              <Text weight="800">{a.title_pt}</Text>
              <Text variant="small">{a.text_pt}</Text>
            </Card>
          ))}
          <Card tone="accent" style={{ gap: 6 }}>
            <Text weight="800">Como entender mais rápido</Text>
            {guide.listening_tips.map((t) => <Text key={t} variant="small">• {t}</Text>)}
          </Card>
        </Stack>
      )}
      <Text variant="tiny" muted center>
        A voz gravada fala de forma mais clara do que pessoas reais. Use o guia para saber o que esperar e complemente com
        conversas e vídeos reais.
      </Text>
    </Screen>
  );
}
