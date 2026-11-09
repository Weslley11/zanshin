import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ConsentToggles } from "../components/ConsentToggles";
import { Banner, Button, Card, ErrorText, Field, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { shareText } from "../lib/share";

export default function Privacy() {
  const { me, refreshMe, signOut } = useApp();
  const [consents, setConsents] = useState<Record<string, boolean>>(me?.consents ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => { if (me) setConsents(me.consents); }, [me]);

  const save = async (next: Record<string, boolean>) => {
    setConsents(next);
    setSaving(true);
    setError(null);
    try {
      await api("/me/consents", { method: "PUT", body: { consents: next } });
      await refreshMe();
      setMsg("Preferências salvas.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      const data = await api("/me/export");
      await shareText("fluent-ai-meus-dados.json", JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteAccount = async () => {
    try {
      await api("/me/delete", { body: { password } });
      await signOut();
      router.replace("/login");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Screen>
      <Text variant="h3">Consentimentos</Text>
      <ConsentToggles value={consents} onChange={save} />
      {saving ? <Text variant="small" muted>Salvando…</Text> : msg ? <Text variant="small" muted>{msg}</Text> : null}

      <Card style={{ gap: 6 }}>
        <Text weight="700">Como tratamos seus dados</Text>
        <Text variant="small">• Áudio: processado para transcrição e descartado, a menos que você ative “Guardar gravações” (retenção máx. de 30 dias; revogar apaga tudo).</Text>
        <Text variant="small">• Documentos: armazenamos só a versão com dados pessoais removidos; materiais marcados como confidenciais são recusados.</Text>
        <Text variant="small">• Conversas e progresso ficam na sua conta e podem ser exportados ou excluídos a qualquer momento.</Text>
        <Text variant="small">• Provedores de IA recebem apenas o necessário para cada resposta; os logs do servidor não guardam o conteúdo das mensagens.</Text>
      </Card>

      <Stack gap={10}>
        <Button title="Exportar meus dados (JSON)" variant="secondary" onPress={exportData} />
        {!confirmDelete ? (
          <Button title="Excluir minha conta" variant="ghost" onPress={() => setConfirmDelete(true)} />
        ) : (
          <Card tone="danger" style={{ gap: 10 }}>
            <Banner tone="danger" title="Exclusão definitiva">Todos os seus dados (conversas, progresso, plano, gravações e documentos) serão apagados. Não é possível desfazer.</Banner>
            <Field label="Confirme sua senha" value={password} onChangeText={setPassword} secure />
            <Button title="Excluir definitivamente" variant="danger" disabled={!password} onPress={deleteAccount} />
            <Button title="Cancelar" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </Card>
        )}
      </Stack>
      <ErrorText error={error} />
    </Screen>
  );
}
