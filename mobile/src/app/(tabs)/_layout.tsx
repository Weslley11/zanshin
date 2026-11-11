import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { type ComponentProps } from "react";
import { View, type ColorValue } from "react-native";
import { useApp } from "../../lib/app";
import { useTheme } from "../../lib/theme";

type Name = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, focused }: { name: Name; color: ColorValue; focused: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 46, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                   backgroundColor: focused ? c.primarySoft : "transparent" }}>
      <Ionicons name={focused ? name : (`${name}-outline` as Name)} size={22} color={color as string} />
    </View>
  );
}

const icon = (name: Name) => ({ color, focused }: { color: ColorValue; focused: boolean }) => <TabIcon name={name} color={color} focused={focused} />;

export default function TabsLayout() {
  const { c } = useTheme();
  const { ready, signedIn } = useApp();
  if (ready && !signedIn) return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="practice" options={{ title: "Módulos", tabBarIcon: icon("grid") }} />
      <Tabs.Screen name="vocab" options={{ title: "Revisão", tabBarIcon: icon("albums") }} />
      <Tabs.Screen name="progress" options={{ title: "Progresso", tabBarIcon: icon("stats-chart") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: icon("person-circle") }} />
    </Tabs>
  );
}
