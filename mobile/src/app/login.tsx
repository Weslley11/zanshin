import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, ErrorText, Field, Screen, Stack, Text } from "../components/ui";
import { useApp } from "../lib/app";
import { useTheme } from "../lib/theme";

export default function Login() {
  const { signIn } = useApp();
  const { c } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ marginTop: 48, gap: 8 }}>
        <Text variant="h1">Fluent AI</Text>
        <Text muted>Fale mais. Traduza menos. Seu professor particular de idiomas, 24 horas por dia.</Text>
      </View>
      <Stack>
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="voce@empresa.com" />
        <Field label="Senha" value={password} onChangeText={setPassword} secure onSubmitEditing={submit} />
        <ErrorText error={error} />
        <Button title="Entrar" onPress={submit} loading={loading} disabled={!email || !password} size="lg" />
        <Link href="/register" style={{ color: c.accent, fontWeight: "600", textAlign: "center", padding: 8 }}>
          Criar uma conta
        </Link>
      </Stack>
    </Screen>
  );
}
