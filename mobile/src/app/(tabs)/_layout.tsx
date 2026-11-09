import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { Text, type ColorValue } from "react-native";
import { useApp } from "../../lib/app";
import { useTheme } from "../../lib/theme";

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ fontSize: 20, color }} accessibilityElementsHidden importantForAccessibility="no">{glyph}</Text>
);

export default function TabsLayout() {
  const { c } = useTheme();
  const { ready, signedIn } = useApp();
  if (ready && !signedIn) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: icon("⌂") }} />
      <Tabs.Screen name="practice" options={{ title: "Praticar", tabBarIcon: icon("◎") }} />
      <Tabs.Screen name="vocab" options={{ title: "Revisão", tabBarIcon: icon("▤") }} />
      <Tabs.Screen name="progress" options={{ title: "Progresso", tabBarIcon: icon("↗") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: icon("☺") }} />
    </Tabs>
  );
}
