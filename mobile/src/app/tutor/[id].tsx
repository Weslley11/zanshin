import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View, type ScrollViewInstance } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { PressableScale, PulseRings, TypingDots, Waveform } from "../../components/motion";
import { Banner, Button, Card, ErrorText, Gradient, Icon, Loading, Pill, Row, Segmented, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { ACCENT_LABELS, speak, speedToRate, stopSpeaking } from "../../lib/speech";
import { radius, spacing, useTheme } from "../../lib/theme";
import type { Correction } from "../../lib/types";
import { useVoiceInput } from "../../lib/voice";

type Msg = { role: "user" | "assistant"; text: string; corrections?: Correction[]; pending?: boolean };

const SEV_LABEL: Record<string, string> = {
  blocks_understanding: "Impede a compreensão", may_confuse: "Pode confundir", minor: "Pequeno ajuste",
};

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nav = useNavigation();
  const { caps } = useApp();
  const { c } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [goals, setGoals] = useState<{ id: string; pt: string; achieved: boolean }[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showText, setShowText] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [accent, setAccent] = useState<string | undefined>(undefined);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const readyAt = useRef(Date.now());
  const firstInputAt = useRef<number | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const voice = useVoiceInput(!!caps?.stt.available, session?.language ?? "en");

  useLayoutEffect(() => {
    if (session) nav.setOptions({ title: session.title });
  }, [nav, session]);

  const say = useCallback((t: string) => {
    if (!autoSpeak) {
      readyAt.current = Date.now();
      return;
    }
    speak(t, {
      language: session?.language ?? "en", accent, rate: speedToRate(speed),
      onDone: () => {
        readyAt.current = Date.now();
        if (handsFree) voice.start();
      },
    });
  }, [autoSpeak, accent, speed, handsFree, session?.language, voice]);

  useEffect(() => {
    (async () => {
      try {
        const s = await api(`/tutor/sessions/${id}`);
        setSession(s);
        setAccent(s.settings?.accent);
        setMsgs(s.turns.map((t: any) => ({ role: t.role, text: t.text, corrections: t.corrections })));
        if (s.settings?.challenge_minutes) setSecondsLeft(s.settings.challenge_minutes * 60);
        if (s.scenario_id) {
          const sc = await api(`/scenarios/${s.scenario_id}`);
          setGoals(sc.goals.map((g: any) => ({ id: g.id, pt: g.pt, achieved: (s.goals_achieved ?? []).includes(g.id) })));
          setAccent(sc.characters?.[0]?.accent);
        }
        const last = s.turns[s.turns.length - 1];
        if (last?.role === "assistant" && !s.ended_at) {
          speak(last.text, { language: s.language, accent: s.settings?.accent, onDone: () => (readyAt.current = Date.now()) });
        }
      } catch (e: any) {
        setError(e.message);
      }
    })();
    return () => { stopSpeaking(); };
  }, [id]);

  useEffect(() => {
    if (secondsLeft == null || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); }, [msgs]);

  const latency = () => Math.max(0, (firstInputAt.current ?? Date.now()) - readyAt.current);

  const applyReply = (r: any, userText: string) => {
    setMsgs((m) => [
      ...m.filter((x) => !x.pending),
      { role: "user", text: userText, corrections: r.visible_corrections },
      { role: "assistant", text: r.reply },
    ]);
    if (r.goals?.length) setGoals(r.goals);
    if (r.portuguese_detected && session?.mode !== "no_native") setNotice("Dica: tente se expressar em inglês com palavras simples, mesmo que não seja perfeito.");
    else if (r.degraded) setNotice("O provedor de IA está indisponível agora; continuando em modo offline.");
    else setNotice(null);
    firstInputAt.current = null;
    say(r.reply);
  };

  const sendText = async (override?: string, source: "text" | "device_stt" = "text", audioSeconds?: number) => {
    const t = (override ?? text).trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    setText("");
    stopSpeaking();
    setMsgs((m) => [...m, { role: "user", text: t, pending: true }]);
    try {
      const r = await api(`/tutor/sessions/${id}/messages`, { body: { text: t, latency_ms: latency(), source, audio_seconds: audioSeconds } });
      applyReply(r, t);
    } catch (e: any) {
      setMsgs((m) => m.filter((x) => !x.pending));
      setText(t);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    if (voice.recording) {
      const res = await voice.stop();
      if (!res) return;
      if (res.kind === "transcript") {
        if (!res.text) { setNotice("Não ouvi nada. Tente de novo, mais perto do microfone."); return; }
        await sendText(res.text, "device_stt", res.durationSec);
        return;
      }
      setBusy(true);
      setError(null);
      setMsgs((m) => [...m, { role: "user", text: "…", pending: true }]);
      try {
        res.form.append("latency_ms", String(latency()));
        const r = await api(`/tutor/sessions/${id}/audio`, { form: res.form });
        if (r.status === "unclear") {
          setMsgs((m) => m.filter((x) => !x.pending));
          setNotice(r.message_pt);
        } else applyReply(r, r.transcript);
      } catch (e: any) {
        setMsgs((m) => m.filter((x) => !x.pending));
        setError(e.message);
      } finally {
        setBusy(false);
      }
    } else {
      stopSpeaking();
      firstInputAt.current = Date.now();
      await voice.start();
    }
  };

  const end = async () => {
    setEnding(true);
    stopSpeaking();
    try {
      await api(`/tutor/sessions/${id}/end`, { method: "POST" });
      router.replace({ pathname: "/report/[id]", params: { id } });
    } catch (e: any) {
      setError(e.message);
      setEnding(false);
    }
  };

  if (!session) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>{error ? <View style={{ padding: 16 }}><ErrorText error={error} /></View> : <Loading />}</SafeAreaView>;

  const mm = secondsLeft != null ? `${Math.floor(Math.max(secondsLeft, 0) / 60)}:${String(Math.max(secondsLeft, 0) % 60).padStart(2, "0")}` : null;
  const micLabel = voice.recording ? `Parar gravação (${voice.elapsed.toFixed(0)} s)` : voice.mode === "none" ? "Voz indisponível" : "Falar";
  const achieved = goals.filter((g) => g.achieved).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 8, maxWidth: 680, width: "100%", alignSelf: "center" }}>
          <Row wrap gap={6}>
            <Pill icon={session.engine === "offline" ? "phone-portrait" : "sparkles"} label={session.engine === "offline" ? "Tutor no aparelho" : "IA"} />
            {mm ? <Pill icon="timer" label={secondsLeft! > 0 ? mm : "tempo concluído!"} color={secondsLeft! > 0 ? undefined : c.success} /> : null}
            {accent ? <Pill icon="globe" label={`Sotaque: ${ACCENT_LABELS[accent] ?? accent}`} /> : null}
            {goals.length ? <Pill icon="flag" label={`${achieved}/${goals.length} objetivos`} /> : null}
          </Row>
          {goals.length ? (
            <Row wrap gap={6}>
              {goals.map((g) => <Pill key={g.id} icon={g.achieved ? "checkmark-circle" : "ellipse-outline"} label={g.pt}
                color={g.achieved ? c.success : c.textMuted} bg={g.achieved ? c.successSoft : c.surface} />)}
            </Row>
          ) : null}
        </View>

        <ScrollView ref={scroll} contentContainerStyle={{ padding: spacing.lg, gap: 12, maxWidth: 680, width: "100%", alignSelf: "center" }}>
          {msgs.map((m, i) => (
            <Animated.View key={i} entering={(m.role === "user" ? FadeInRight : FadeInLeft).springify().damping(18)}
              style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
              <Row gap={8} style={{ alignItems: "flex-end", maxWidth: "92%", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                {m.role === "assistant" ? (
                  <Gradient name="tutor" style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="sparkles" size={15} color="#fff" />
                  </Gradient>
                ) : null}
                <Pressable
                  onPress={() => m.role === "assistant" && speak(m.text, { language: session.language, accent, rate: speedToRate(speed) })}
                  accessibilityRole={m.role === "assistant" ? "button" : undefined}
                  accessibilityLabel={m.role === "assistant" ? `Tutor: ${m.text}. Toque para ouvir de novo.` : `Você: ${m.text}`}
                  style={{ flexShrink: 1, opacity: m.pending ? 0.6 : 1 }}
                >
                  {m.role === "user" ? (
                    <Gradient name="brand" style={{ padding: 13, borderRadius: radius.lg, borderBottomRightRadius: 6 }}>
                      <Text color="#FFFFFF">{m.text}</Text>
                    </Gradient>
                  ) : (
                    <View style={{ padding: 13, borderRadius: radius.lg, borderBottomLeftRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                      {!showText ? <Row gap={6}><Icon name="volume-high" size={16} color={c.primary} /><Text muted>Toque para ouvir · transcrição oculta</Text></Row>
                        : <Text>{m.text}</Text>}
                    </View>
                  )}
                </Pressable>
              </Row>
              {m.corrections?.map((cr, j) => (
                <Animated.View key={j} entering={FadeInDown.delay(150).springify()} style={{ maxWidth: "88%" }}>
                  <Card tone={cr.severity === "minor" ? "accent" : "warning"} style={{ gap: 4, padding: 12 }}>
                    <Row gap={6}><Icon name="bulb" size={15} color={cr.severity === "minor" ? c.accent : c.warning} />
                      <Text variant="tiny" weight="800">{SEV_LABEL[cr.severity] ?? "Correção"}</Text></Row>
                    <Text variant="small" weight="700">{cr.corrected}</Text>
                    <Text variant="small" muted>{cr.explanation_pt}</Text>
                  </Card>
                </Animated.View>
              ))}
            </Animated.View>
          ))}
          {busy ? (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Gradient name="tutor" style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" }}>
                <Icon name="sparkles" size={15} color="#fff" />
              </Gradient>
              <View style={{ borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}><TypingDots /></View>
            </Animated.View>
          ) : null}
        </ScrollView>

        <View style={{ padding: spacing.md, gap: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <View style={{ maxWidth: 680, width: "100%", alignSelf: "center", gap: 10 }}>
            {notice ? <Banner tone="warning">{notice}</Banner> : null}
            {voice.error ? <ErrorText error={voice.error} /> : null}
            <ErrorText error={error} />
            {voice.recording ? (
              <Animated.View entering={FadeIn}>
                <Gradient name="speak" style={{ borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Icon name="radio-button-on" size={16} color="#fff" />
                  <Text weight="800" color="#fff">{voice.elapsed.toFixed(0)} s</Text>
                  <View style={{ flex: 1, alignItems: "center" }}><Waveform active /></View>
                  <Text variant="tiny" color="#fff">toque ■ para enviar</Text>
                </Gradient>
              </Animated.View>
            ) : null}
            <Row gap={10}>
              <View style={{ width: 66, height: 66, alignItems: "center", justifyContent: "center" }}>
                <PulseRings size={60} color={voice.recording ? "#FF2E7E" : c.primary} active={voice.recording} />
                <PressableScale onPress={toggleMic} disabled={busy || voice.mode === "none"} accessibilityLabel={micLabel} scaleTo={0.9}>
                  <Gradient name={voice.recording ? "speak" : voice.mode === "none" ? "documents" : "brand"}
                    style={{ width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={voice.recording ? "stop" : "mic"} size={28} color="#fff" />
                  </Gradient>
                </PressableScale>
              </View>
              <TextInput
                value={text}
                onChangeText={(t) => { if (firstInputAt.current == null) firstInputAt.current = Date.now(); setText(t); }}
                placeholder={voice.mode === "none" ? "Digite (ou use o ditado do teclado)…" : "Ou digite aqui…"}
                placeholderTextColor={c.textMuted}
                onSubmitEditing={() => sendText()}
                accessibilityLabel="Mensagem"
                style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14, color: c.text, backgroundColor: c.bg, fontSize: 16 }}
              />
              <PressableScale onPress={() => sendText()} disabled={!text.trim() || busy} accessibilityLabel="Enviar" scaleTo={0.9}>
                <Gradient name="brand" style={{ width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", opacity: !text.trim() || busy ? 0.45 : 1 }}>
                  <Icon name="arrow-up" size={24} color="#fff" />
                </Gradient>
              </PressableScale>
            </Row>
            <Row wrap gap={14} style={{ justifyContent: "space-between" }}>
              <Row gap={6}><Text variant="tiny" muted>Voz do tutor</Text><Switch value={autoSpeak} onValueChange={setAutoSpeak} /></Row>
              <Row gap={6}><Text variant="tiny" muted>Transcrição</Text><Switch value={showText} onValueChange={setShowText} /></Row>
              {voice.mode !== "none" ? <Row gap={6}><Text variant="tiny" muted>Mãos livres</Text><Switch value={handsFree} onValueChange={setHandsFree} /></Row> : null}
            </Row>
            <Row gap={10}>
              <Text variant="tiny" muted>Velocidade</Text>
              <View style={{ flex: 1 }}>
                <Segmented<"slow" | "normal" | "fast"> value={speed} onChange={setSpeed}
                  options={[{ value: "slow", label: "Devagar" }, { value: "normal", label: "Normal" }, { value: "fast", label: "Rápido" }]} />
              </View>
            </Row>
            {voice.mode === "browser" ? <Text variant="tiny" muted>Reconhecimento de voz do navegador (o áudio não vai para o servidor do app).</Text> : null}
            {voice.mode === "none" ? <Text variant="tiny" muted>Dica: no iPhone, toque no microfone do teclado para ditar em inglês.</Text> : null}
            <Button title="Encerrar e ver relatório" variant="secondary" icon="document-text" onPress={end} loading={ending} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
