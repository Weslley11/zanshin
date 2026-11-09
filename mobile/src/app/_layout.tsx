import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../lib/app";
import { useTheme } from "../lib/theme";

function RootStack() {
  const { c, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShadowVisible: false,
          headerBackTitle: "Voltar",
          contentStyle: { backgroundColor: c.bg },
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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
