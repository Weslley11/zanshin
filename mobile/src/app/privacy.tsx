import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ConsentToggles } from "../components/ConsentToggles";
import { Banner, Button, Card, ErrorText, Field, Screen, Stack, Text } from "../components/ui";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { api, LOCAL_MODE } from "../lib/api";
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

  const importBackup = async () => {
    setError(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
      if (r.canceled) return;
      const f = r.assets[0];
      const text = Platform.OS === "web" && f.file ? await f.file.text() : await (await fetch(f.uri)).text();
      const { importBackup: restore } = await import("../lib/local/localApi");
      await restore(text);
      await refreshMe();
      setMsg("Backup restaurado.");
    } catch (e: any) {
      setError(e.message ?? "Não foi possível importar o backup.");
    }
  };

  const deleteAccount = async () => {
    try {
      await api("/me/delete", { body: { password } });
      await signOut();
      router.replace("/");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Screen>
      {LOCAL_MODE ? (
        <Card tone="accent" style={{ gap: 6 }}>
          <Text weight="700">Modo local: seus dados ficam neste aparelho</Text>
          <Text variant="small">Nada é enviado a servidores do app. Faça backups de vez em quando — se você apagar os dados do navegador ou trocar de aparelho, use o backup para restaurar.</Text>
        </Card>
      ) : null}
      {!LOCAL_MODE ? <Text variant="h3">Consentimentos</Text> : null}
      {!LOCAL_MODE ? <ConsentToggles value={consents} onChange={save} /> : null}
      {saving ? <Text variant="small" muted>Salvando…</Text> : msg ? <Text variant="small" muted>{msg}</Text> : null}

      <Card style={{ gap: 6 }}>
        <Text weight="700">Como tratamos seus dados</Text>
        <Text variant="small">• Áudio: processado para transcrição e descartado, a menos que você ative “Guardar gravações” (retenção máx. de 30 dias; revogar apaga tudo).</Text>
        <Text variant="small">• Documentos: armazenamos só a versão com dados pessoais removidos; materiais marcados como confidenciais são recusados.</Text>
        <Text variant="small">• Conversas e progresso ficam na sua conta e podem ser exportados ou excluídos a qualquer momento.</Text>
        <Text variant="small">• Provedores de IA recebem apenas o necessário para cada resposta; os logs do servidor não guardam o conteúdo das mensagens.</Text>
      </Card>

      <Stack gap={10}>
        <Button title={LOCAL_MODE ? "Exportar backup (JSON)" : "Exportar meus dados (JSON)"} icon="download" variant="secondary" onPress={exportData} />
        {LOCAL_MODE ? <Button title="Importar backup" icon="cloud-upload" variant="secondary" onPress={importBackup} /> : null}
        {!confirmDelete ? (
          <Button title={LOCAL_MODE ? "Apagar todos os dados deste aparelho" : "Excluir minha conta"} variant="ghost" icon="trash" onPress={() => setConfirmDelete(true)} />
        ) : (
          <Card tone="danger" style={{ gap: 10 }}>
            <Banner tone="danger" title="Exclusão definitiva">Todos os seus dados (conversas, progresso, plano, gravações e documentos) serão apagados. Não é possível desfazer.</Banner>
            {!LOCAL_MODE ? <Field label="Confirme sua senha" value={password} onChangeText={setPassword} secure /> : null}
            <Button title="Excluir definitivamente" variant="danger" disabled={!LOCAL_MODE && !password} onPress={deleteAccount} />
            <Button title="Cancelar" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </Card>
        )}
      </Stack>
      <ErrorText error={error} />
    </Screen>
  );
}
