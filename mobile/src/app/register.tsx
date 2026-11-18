import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ConsentToggles } from "../components/ConsentToggles";
import { Button, ErrorText, Field, Screen, Stack, Text } from "../components/ui";
import { useApp } from "../lib/app";
import { useTheme } from "../lib/theme";

export default function Register() {
  const { signUp } = useApp();
  const { c } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [consents, setConsents] = useState<Record<string, boolean>>({ ai_processing: true, voice_processing: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signUp({ email: email.trim(), password, display_name: name.trim(), accept_terms: accept, consents });
      router.replace("/onboarding");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Stack>
        <Field label="Como quer ser chamado?" value={name} onChangeText={setName} autoCapitalize="sentences" />
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Senha (mín. 10 caracteres, letras e números)" value={password} onChangeText={setPassword} secure />
      </Stack>
      <Text variant="h3">Privacidade</Text>
      <Text variant="small" muted>Você controla o que é processado. Pode mudar isso a qualquer momento em Perfil → Privacidade.</Text>
      <ConsentToggles value={consents} onChange={setConsents} />
      <Pressable onPress={() => setAccept(!accept)} accessibilityRole="checkbox" accessibilityState={{ checked: accept }}
        style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.primary, backgroundColor: accept ? c.primary : "transparent" }} />
        <Text variant="small" style={{ flex: 1 }}>Li e aceito os termos de uso e a política de privacidade.</Text>
      </Pressable>
      <ErrorText error={error} />
      <Button title="Criar conta" onPress={submit} loading={loading} disabled={!email || !password || !accept} size="lg" />
    </Screen>
  );
}
