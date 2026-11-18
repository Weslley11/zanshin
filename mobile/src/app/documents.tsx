import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Banner, Button, Card, Collapsible, ErrorText, ModuleHero, Screen, Stack, Text } from "../components/ui";
import { api, LOCAL_MODE } from "../lib/api";
import { useApp } from "../lib/app";
import { useTheme } from "../lib/theme";

export default function Documents() {
  const { language, me } = useApp();
  const { c } = useTheme();
  const [authorized, setAuthorized] = useState(false);
  const [doc, setDoc] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api("/documents").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const pick = async () => {
    setError(null);
    const r = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "text/markdown", "text/csv", "application/pdf"], copyToCacheDirectory: true });
    if (r.canceled) return;
    const file = r.assets[0];
    const form = new FormData();
    if (Platform.OS === "web" && file.file) form.append("file", file.file, file.name);
    else form.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" } as any);
    form.append("authorized", String(authorized));
    form.append("language", language);
    setBusy(true);
    try {
      setDoc(await api("/documents", { form }));
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      setDoc(await api(`/documents/${doc.id}/generate`, { method: "POST" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const g = doc?.generated;
  return (
    <Screen>
      <ModuleHero title="Documentos técnicos" icon="document-text" gradient="documents"
        subtitle="Transforme procedimentos, especificações ou apresentações em vocabulário, exercícios e simulações." />
      {LOCAL_MODE ? <Banner tone="warning" icon="server" title="Requer servidor">Este módulo processa documentos com proteção de dados no backend. No modo local (grátis), ele fica indisponível; todos os outros módulos funcionam no aparelho.</Banner> : null}
      {!me?.consents.document_processing ? (
        <Banner tone="warning" title="Consentimento necessário">Ative “Documentos técnicos” em Perfil → Privacidade para usar este recurso.</Banner>
      ) : null}
      <Card style={{ gap: 6 }}>
        <Text weight="700">Proteção de dados</Text>
        <Text variant="small">• Documentos com marcações como “Confidential”, “Uso interno” ou com senhas/chaves são recusados.</Text>
        <Text variant="small">• E-mails, telefones, CPF/CNPJ, cartões, IPs e links internos são removidos antes de qualquer processamento.</Text>
        <Text variant="small">• Instruções escondidas no texto (prompt injection) são descartadas e o conteúdo é tratado só como material de estudo.</Text>
      </Card>
      <Pressable onPress={() => setAuthorized(!authorized)} accessibilityRole="checkbox" accessibilityState={{ checked: authorized }}
        style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: c.primary, backgroundColor: authorized ? c.primary : "transparent" }} />
        <Text variant="small" style={{ flex: 1 }}>Estou autorizado a usar este material e ele não contém informações confidenciais.</Text>
      </Pressable>
      <Button title="Escolher arquivo (.txt, .md, .csv, .pdf)" onPress={pick} disabled={!authorized} loading={busy && !doc} />
      <ErrorText error={error} />

      {doc ? (
        <Stack>
          <Card style={{ gap: 6 }}>
            <Text weight="700">{doc.filename}</Text>
            <Text variant="small" muted>
              Dados removidos: {Object.entries(doc.report?.redactions ?? {}).map(([k, v]) => `${k} (${v})`).join(", ") || "nenhum"}
              {doc.report?.removed_instruction_lines?.length ? ` · ${doc.report.removed_instruction_lines.length} linha(s) com instruções suspeitas descartada(s)` : ""}
            </Text>
            {doc.redacted_text ? (
              <Collapsible title="Ver texto que será usado (já redigido)">
                <Text variant="small" selectable>{doc.redacted_text.slice(0, 1500)}{doc.redacted_text.length > 1500 ? "…" : ""}</Text>
              </Collapsible>
            ) : null}
          </Card>
          {!g ? <Button title="Gerar material de estudo" onPress={generate} loading={busy} /> : (
            <Stack>
              <Banner tone="success" title={`${g.added_to_review ?? 0} termos adicionados à revisão`}>
                {g.engine === "offline" ? "Gerado sem IA generativa: glossário e lacunas a partir do próprio texto." : "Gerado com IA a partir do texto redigido."}
              </Banner>
              {(g.glossary ?? g.terms ?? []).slice(0, 12).map((t: any) => (
                <Card key={t.term} style={{ gap: 2 }}>
                  <Text weight="700">{t.term}</Text>
                  {t.meaning_pt ? <Text variant="small">{t.meaning_pt}</Text> : null}
                  {t.example ? <Text variant="small" muted>“{t.example}”</Text> : null}
                </Card>
              ))}
              {g.exercises?.length ? (
                <Collapsible title={`Exercícios (${g.exercises.length})`} initiallyOpen>
                  {g.exercises.map((e: any, i: number) => (
                    <Card key={i} style={{ gap: 4 }}>
                      <Text variant="small" muted>{e.instruction_pt}</Text>
                      <Text weight="600">{e.prompt}</Text>
                      <Text variant="tiny" muted>Resposta: {e.answer}</Text>
                    </Card>
                  ))}
                </Collapsible>
              ) : null}
              {g.dialogue?.length ? (
                <Collapsible title="Diálogo de trabalho">
                  {g.dialogue.map((l: any, i: number) => <Text key={i} variant="small"><Text variant="small" weight="700">{l.speaker}: </Text>{l.text}</Text>)}
                </Collapsible>
              ) : null}
              {g.roleplay ? (
                <Card tone="accent" style={{ gap: 6 }}>
                  <Text weight="700">Simulação sugerida</Text>
                  <Text variant="small">{g.roleplay.setting} — você: {g.roleplay.learner_role}; parceiro: {g.roleplay.partner_role}</Text>
                  <Button title="Praticar no modo correção imediata" size="sm" onPress={() => router.push({ pathname: "/tutor/new", params: { mode: "immediate" } })} />
                </Card>
              ) : null}
            </Stack>
          )}
        </Stack>
      ) : null}

      {list.length ? (
        <Stack gap={8}>
          <Text variant="h3">Seus documentos</Text>
          {list.map((d) => (
            <Card key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable style={{ flex: 1 }} onPress={async () => setDoc(await api(`/documents/${d.id}`))}>
                <Text weight="600">{d.filename}</Text>
                <Text variant="tiny" muted>{d.status === "generated" ? "material gerado" : "pronto"}</Text>
              </Pressable>
              <Button title="Excluir" size="sm" variant="ghost" onPress={async () => { await api(`/documents/${d.id}`, { method: "DELETE" }); if (doc?.id === d.id) setDoc(null); load(); }} />
            </Card>
          ))}
        </Stack>
      ) : null}
    </Screen>
  );
}
