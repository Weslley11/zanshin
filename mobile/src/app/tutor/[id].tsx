import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button, Card, Chip, ErrorText, Loading, Row, Text } from "../../components/ui";
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
  const micLabel = voice.recording ? `Parar (${voice.elapsed.toFixed(0)} s)` : voice.mode === "none" ? "Voz indisponível" : "Falar";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 8, maxWidth: 680, width: "100%", alignSelf: "center" }}>
          <Row wrap gap={8}>
            <Chip label={session.engine === "offline" ? "Modo offline" : "IA"} />
            {mm ? <Chip label={secondsLeft! > 0 ? `⏱ ${mm}` : "⏱ tempo concluído!"} selected={secondsLeft! <= 0} /> : null}
            {accent ? <Chip label={`Sotaque: ${ACCENT_LABELS[accent] ?? accent}`} /> : null}
          </Row>
          {goals.length ? (
            <Row wrap gap={6}>
              {goals.map((g) => <Text key={g.id} variant="tiny" color={g.achieved ? c.success : c.textMuted}>{g.achieved ? "✓" : "○"} {g.pt}   </Text>)}
            </Row>
          ) : null}
        </View>

        <ScrollView ref={scroll} contentContainerStyle={{ padding: spacing.lg, gap: 10, maxWidth: 680, width: "100%", alignSelf: "center" }}>
          {msgs.map((m, i) => (
            <View key={i} style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
              <Pressable
                onPress={() => m.role === "assistant" && speak(m.text, { language: session.language, accent, rate: speedToRate(speed) })}
                accessibilityRole={m.role === "assistant" ? "button" : undefined}
                accessibilityLabel={m.role === "assistant" ? `Tutor: ${m.text}. Toque para ouvir de novo.` : `Você: ${m.text}`}
                style={{
                  maxWidth: "88%", padding: 12, borderRadius: radius.lg,
                  backgroundColor: m.role === "user" ? c.primary : c.surface, borderWidth: m.role === "user" ? 0 : 1, borderColor: c.border,
                  opacity: m.pending ? 0.6 : 1,
                }}
              >
                {m.role === "assistant" && !showText ? (
                  <Text color={c.textMuted}>🔊 Toque para ouvir · transcrição oculta</Text>
                ) : (
                  <Text color={m.role === "user" ? c.primaryText : c.text}>{m.text}</Text>
                )}
              </Pressable>
              {m.corrections?.map((cr, j) => (
                <Card key={j} tone={cr.severity === "minor" ? "accent" : "warning"} style={{ maxWidth: "88%", gap: 4, padding: 12 }}>
                  <Text variant="tiny" weight="700">{SEV_LABEL[cr.severity] ?? "Correção"}</Text>
                  <Text variant="small" weight="600">✓ {cr.corrected}</Text>
                  <Text variant="small" muted>{cr.explanation_pt}</Text>
                </Card>
              ))}
            </View>
          ))}
          {busy ? <Text muted variant="small">digitando…</Text> : null}
        </ScrollView>

        <View style={{ padding: spacing.md, gap: 8, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <View style={{ maxWidth: 680, width: "100%", alignSelf: "center", gap: 8 }}>
            {notice ? <Banner tone="warning">{notice}</Banner> : null}
            {voice.error ? <ErrorText error={voice.error} /> : null}
            <ErrorText error={error} />
            <Row gap={8}>
              <Pressable
                onPress={toggleMic}
                disabled={busy || voice.mode === "none"}
                accessibilityRole="button"
                accessibilityLabel={micLabel}
                style={{
                  width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
                  backgroundColor: voice.recording ? c.danger : voice.mode === "none" ? c.surfaceAlt : c.primary,
                }}
              >
                <Text variant="h2" color="#fff">{voice.recording ? "■" : "🎙"}</Text>
              </Pressable>
              <TextInput
                value={text}
                onChangeText={(t) => { if (firstInputAt.current == null) firstInputAt.current = Date.now(); setText(t); }}
                placeholder={voice.mode === "none" ? "Digite sua resposta em inglês…" : "Ou digite aqui…"}
                placeholderTextColor={c.textMuted}
                onSubmitEditing={() => sendText()}
                accessibilityLabel="Mensagem"
                style={{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, color: c.text, backgroundColor: c.bg, fontSize: 16 }}
              />
              <Button title="Enviar" onPress={() => sendText()} disabled={!text.trim() || busy} size="sm" />
            </Row>
            <Row wrap gap={14} style={{ justifyContent: "space-between" }}>
              <Row gap={6}>
                <Text variant="tiny" muted>Voz do tutor</Text>
                <Switch value={autoSpeak} onValueChange={setAutoSpeak} />
              </Row>
              <Row gap={6}>
                <Text variant="tiny" muted>Transcrição</Text>
                <Switch value={showText} onValueChange={setShowText} />
              </Row>
              {voice.mode !== "none" ? (
                <Row gap={6}>
                  <Text variant="tiny" muted>Mãos livres</Text>
                  <Switch value={handsFree} onValueChange={setHandsFree} />
                </Row>
              ) : null}
              <Row gap={4}>
                {(["slow", "normal", "fast"] as const).map((s) => (
                  <Pressable key={s} onPress={() => setSpeed(s)} accessibilityRole="button" accessibilityState={{ selected: speed === s }}>
                    <Text variant="tiny" weight={speed === s ? "700" : "400"} color={speed === s ? c.primary : c.textMuted}>
                      {s === "slow" ? "Devagar" : s === "normal" ? "Normal" : "Rápido"}{"  "}
                    </Text>
                  </Pressable>
                ))}
              </Row>
            </Row>
            {voice.mode === "browser" ? <Text variant="tiny" muted>Reconhecimento de voz do navegador (sem envio de áudio ao servidor).</Text> : null}
            <Button title="Encerrar e ver relatório" variant="secondary" onPress={end} loading={ending} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
