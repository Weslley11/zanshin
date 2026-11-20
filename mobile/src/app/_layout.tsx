// importa só os pesos usados (o índice do pacote inclui todos os 16 arquivos de fonte)
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AudioHelp } from "../components/AudioHelp";
import { AppProvider } from "../lib/app";
import { setFontsLoaded, useTheme } from "../lib/theme";

function RootStack() {
  const { c, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: "PlusJakartaSans_700Bold" },
          headerShadowVisible: false,
          headerBackTitle: "Voltar",
          contentStyle: { backgroundColor: c.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: "Criar conta" }} />
        <Stack.Screen name="onboarding" options={{ title: "Seu plano" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tutor/new" options={{ title: "Preparando conversa" }} />
        <Stack.Screen name="tutor/[id]" options={{ title: "Conversa" }} />
        <Stack.Screen name="report/[id]" options={{ title: "Relatório da sessão" }} />
        <Stack.Screen name="assessment" options={{ title: "Avaliação" }} />
        <Stack.Screen name="plan" options={{ title: "Programa de 90 dias" }} />
        <Stack.Screen name="listening/index" options={{ title: "Listening" }} />
        <Stack.Screen name="listening/[id]" options={{ title: "Listening" }} />
        <Stack.Screen name="scenarios" options={{ title: "Simulações" }} />
        <Stack.Screen name="drills/quick" options={{ title: "Quick Response" }} />
        <Stack.Screen name="drills/build" options={{ title: "Construção de frases" }} />
        <Stack.Screen name="drills/think" options={{ title: "Think in English" }} />
        <Stack.Screen name="shadowing" options={{ title: "Shadowing" }} />
        <Stack.Screen name="errors" options={{ title: "Seus erros" }} />
        <Stack.Screen name="documents" options={{ title: "Documentos técnicos" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacidade e dados" }} />
        <Stack.Screen name="india" options={{ title: "Inglês da Índia" }} />
        <Stack.Screen name="missao/index" options={{ title: "Missões" }} />
        <Stack.Screen name="mapas/index" options={{ title: "Mapas mentais" }} />
        <Stack.Screen name="mapas/[id]" options={{ title: "Mapa" }} />
        <Stack.Screen name="missao/[id]" options={{ title: "Missão" }} />
        <Stack.Screen name="frases" options={{ title: "Minhas frases" }} />
        <Stack.Screen name="turbo" options={{ title: "Turbo" }} />
        <Stack.Screen name="licao/[id]" options={{ headerShown: false, gestureEnabled: false, animation: "slide_from_bottom" }} />
        <Stack.Screen name="unlock" options={{ title: "Destravar a Fala" }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack>
      <AudioHelp />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  // não trava o app se a fonte demorar (ex.: rede lenta no primeiro acesso): segue com a fonte do sistema
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);
  setFontsLoaded(loaded && !error);
  if (!loaded && !error && !timedOut) return <View style={{ flex: 1, backgroundColor: "#07060F" }} />;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
