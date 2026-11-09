import { Redirect } from "expo-router";
import { View } from "react-native";
import { Loading } from "../components/ui";
import { useApp } from "../lib/app";
import { useTheme } from "../lib/theme";

export default function Index() {
  const { ready, signedIn, profile } = useApp();
  const { c } = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: "center" }}><Loading /></View>;
  if (!signedIn) return <Redirect href="/login" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
