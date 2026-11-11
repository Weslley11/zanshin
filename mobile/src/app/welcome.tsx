import { router } from "expo-router";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import globeAnim from "../assets/lottie/globe.json";
import successAnim from "../assets/lottie/success.json";
import talkAnim from "../assets/lottie/talk.json";
import { InstallHint } from "../components/InstallHint";
import Lottie from "../components/Lottie";
import { Float } from "../components/motion";
import { Button, ErrorText, Field, Gradient, Row, Text } from "../components/ui";
import { LOCAL_MODE } from "../lib/api";
import { useApp } from "../lib/app";
import { useTheme } from "../lib/theme";

const SLIDES = [
  { anim: talkAnim, title: "Fale mais.\nTraduza menos.", text: "Um parceiro de conversa que não interrompe a cada erro — e mostra tudo no relatório final." },
  { anim: globeAnim, title: "Pronto para a viagem", text: "Simulações de aeroporto, hotel e reuniões, sotaques reais (inclusive da Índia) e um plano de 90 dias." },
  { anim: successAnim, title: "Memória que fica", text: "Revisão espaçada no momento certo, exercícios rápidos de 5 minutos e progresso medido a cada 15 dias." },
];

export default function Welcome() {
  const { signUp } = useApp();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = i === SLIDES.length;

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      await signUp({ display_name: name.trim(), accept_terms: true, email: "local@device", password: "local-mode-0000",
                     consents: { ai_processing: true, voice_processing: true } });
      router.replace("/onboarding");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <Gradient name="brand" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 360, opacity: 0.12 }} />
      <View style={{ flex: 1, padding: 24, maxWidth: 560, width: "100%", alignSelf: "center", justifyContent: "space-between" }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={8}>
            <Gradient name="brand" style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
              <Text weight="900" color="#fff">F</Text>
            </Gradient>
            <Text variant="h3">Fluent AI</Text>
          </Row>
          {!last ? <Button title="Pular" variant="ghost" size="sm" onPress={() => setI(SLIDES.length)} /> : null}
        </Row>

        {!last ? (
          <Animated.View key={i} entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(160)} style={{ alignItems: "center", gap: 18 }}>
            <Float amplitude={8}>
              <Lottie source={SLIDES[i].anim} style={{ width: Math.min(width - 48, 300), height: 250 }} />
            </Float>
            <Text variant="display" center>{SLIDES[i].title}</Text>
            <Text muted center style={{ maxWidth: 420 }}>{SLIDES[i].text}</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} style={{ gap: 16 }}>
            <Text variant="display">Vamos começar</Text>
            <Text muted>
              {LOCAL_MODE
                ? "Sem cadastro, sem senha e sem custo: seu progresso fica salvo neste aparelho e funciona offline."
                : "Crie seu perfil para salvar o progresso."}
            </Text>
            <Field label="Como quer ser chamado?" value={name} onChangeText={setName} autoCapitalize="sentences" onSubmitEditing={start} />
            <ErrorText error={error} />
            <InstallHint variant="welcome" />
          </Animated.View>
        )}

        <View style={{ gap: 16 }}>
          <Row gap={8} style={{ justifyContent: "center" }}>
            {[...SLIDES, null].map((_, k) => (
              <View key={k} style={{ height: 8, width: k === i ? 26 : 8, borderRadius: 4, backgroundColor: k === i ? c.primary : c.border }} />
            ))}
          </Row>
          {!last ? <Button title="Continuar" size="lg" icon="arrow-forward" onPress={() => setI(i + 1)} />
            : <Button title="Montar meu plano" size="lg" icon="rocket" onPress={start} loading={loading} />}
          {!LOCAL_MODE && last ? <Button title="Já tenho conta" variant="ghost" onPress={() => router.push("/login")} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
