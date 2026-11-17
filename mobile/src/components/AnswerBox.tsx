import { useState } from "react";
import { TextInput, View } from "react-native";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { radius, useTheme } from "../lib/theme";
import { useVoiceInput } from "../lib/voice";
import { PulseRings, PressableScale, Waveform } from "./motion";
import { Gradient, Icon, Row, Text } from "./ui";

/**
 * Resposta por voz (reconhecimento do navegador/servidor) ou teclado — no iPhone, o ditado do teclado também funciona.
 * Chama onSubmit com o texto final.
 */
export function AnswerBox({ onSubmit, placeholder = "Fale ou digite em inglês", busy, disabled }: {
  onSubmit: (text: string) => void; placeholder?: string; busy?: boolean; disabled?: boolean;
}) {
  const { language, caps } = useApp();
  const { c } = useTheme();
  const voice = useVoiceInput(!!caps?.stt.available, language);
  const [text, setText] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = (t: string) => {
    const v = t.trim();
    if (!v || disabled) return;
    setText("");
    onSubmit(v);
  };

  const mic = async () => {
    setErr(null);
    if (!voice.recording) {
      await voice.start();
      return;
    }
    const res = await voice.stop();
    if (!res) return;
    if (res.kind === "transcript") {
      if (res.text.trim()) send(res.text);
      else setErr("Não captei a sua voz. Tente de novo, mais perto do microfone, ou digite.");
      return;
    }
    setTranscribing(true);
    try {
      const t = await api<any>(`/speech/transcribe?language=${language}`, { form: res.form });
      send(t.text ?? "");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setTranscribing(false);
    }
  };

  const canMic = voice.mode !== "none";
  return (
    <View style={{ gap: 8 }}>
      {voice.recording ? (
        <Gradient name="speak" style={{ borderRadius: radius.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Waveform active color="#fff" bars={22} height={26} />
          <Text weight="700" color="#fff">{voice.elapsed.toFixed(0)} s — toque no microfone quando terminar</Text>
        </Gradient>
      ) : null}
      <Row gap={10}>
        {canMic ? (
          <PressableScale onPress={mic} disabled={disabled || busy || transcribing} accessibilityLabel={voice.recording ? "Parar gravação" : "Responder falando"} scaleTo={0.9}>
            <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}>
              {voice.recording ? <PulseRings size={54} color={c.danger} /> : null}
              <Gradient name={voice.recording ? "speak" : "brand"} style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" }}>
                <Icon name={voice.recording ? "stop" : "mic"} size={26} color="#fff" />
              </Gradient>
            </View>
          </PressableScale>
        ) : null}
        <TextInput
          value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={c.textMuted}
          onSubmitEditing={() => send(text)} returnKeyType="send" autoCapitalize="sentences" autoCorrect={false}
          editable={!disabled} accessibilityLabel="Sua resposta"
          style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14,
                   color: c.text, backgroundColor: c.surface, fontSize: 16 }}
        />
        <PressableScale onPress={() => send(text)} disabled={!text.trim() || disabled || busy} accessibilityLabel="Enviar resposta" scaleTo={0.9}>
          <Gradient name="brand" style={{ width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", opacity: !text.trim() || disabled ? 0.45 : 1 }}>
            <Icon name="arrow-up" size={24} color="#fff" />
          </Gradient>
        </PressableScale>
      </Row>
      {transcribing ? <Text variant="tiny" muted>Transcrevendo…</Text> : null}
      {err || voice.error ? <Text variant="tiny" color={c.danger}>{err ?? voice.error}</Text> : null}
      {!canMic ? <Text variant="tiny" muted>Dica: no iPhone, toque no microfone do teclado para ditar em inglês.</Text> : null}
    </View>
  );
}
