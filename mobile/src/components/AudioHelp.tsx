import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { speak } from "../lib/speech";
import { radius, useTheme } from "../lib/theme";
import { englishVoices, onAudioProblem } from "../lib/webSpeech";
import { Button, Icon, Row, Text } from "./ui";

export const AUDIO_TIPS = [
  "Tire o iPhone do modo silencioso (chave lateral ou botão de Ação) — o iOS corta o som de apps web no silencioso.",
  "Aumente o volume com os botões laterais enquanto o app fala.",
  "Se estiver com fone Bluetooth, confira se ele está conectado.",
  "Para o sotaque indiano: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Inglês → Índia (baixe uma voz).",
];

export function soundTest() {
  // frase que tem gravação (Missão 2): testa o caminho mais confiável primeiro
  speak("Sorry, could you say that again a bit more slowly?", { language: "en", accent: "US", rate: 0.95 });
}

/** Aparece quando a voz do aparelho não começa a falar (provável modo silencioso ou volume zero). */
export function AudioHelp() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => onAudioProblem(() => setShow(true)), []);
  if (Platform.OS !== "web" || !show || dismissed) return null;
  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp}
      style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, zIndex: 100 }}>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: 14, gap: 8, borderWidth: 1.5, borderColor: c.warning,
                     shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
        <Row gap={8}>
          <Icon name="volume-mute" size={22} color={c.warning} />
          <Text weight="800" style={{ flex: 1 }}>Sem som?</Text>
        </Row>
        {AUDIO_TIPS.slice(0, 2).map((t) => <Text key={t} variant="small">• {t}</Text>)}
        {englishVoices().length === 0 ? <Text variant="small">• Nenhuma voz em inglês foi encontrada neste aparelho: {AUDIO_TIPS[3]}</Text> : null}
        <Row gap={8}>
          <Button title="Testar som" icon="volume-high" size="sm" style={{ flex: 1 }} onPress={() => { setShow(false); soundTest(); }} />
          <Button title="Fechar" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setDismissed(true)} />
        </Row>
      </View>
    </Animated.View>
  );
}
