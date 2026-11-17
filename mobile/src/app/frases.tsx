import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Banner, Button, Card, ErrorText, Field, ModuleHero, Row, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { parsePhrases } from "../lib/missions";
import { useTheme } from "../lib/theme";

const EXAMPLE = `Could you send me the invoice? = Você pode me mandar a fatura?
I'll be ten minutes late. = Vou me atrasar dez minutos.
Where is the restroom? = Onde fica o banheiro?`;

/** Importa frases do usuário (uma por linha) para a revisão espaçada. */
export default function ImportPhrases() {
  const { language } = useApp();
  const { c } = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parsePhrases(text), [text]);

  const save = async () => {
    setBusy(true);
    setError(null);
    let added = 0;
    let skipped = 0;
    try {
      for (const p of parsed.phrases) {
        try {
          await api("/vocab/items", { body: { language, term: p.term, meaning_pt: p.meaning_pt, kind: "phrase" } });
          added += 1;
        } catch (e: any) {
          if (e.status === 409) skipped += 1;
          else throw e;
        }
      }
      setDone({ added, skipped });
      setText("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ModuleHero title="Minhas frases" icon="clipboard" gradient="vocab"
        subtitle="Cole frases de qualquer material seu — e-books, anotações, e-mails do trabalho. Elas viram cartões na revisão espaçada." />
      <Card style={{ gap: 6 }}>
        <Text weight="700">Uma frase por linha: inglês = tradução</Text>
        <Text variant="small" muted>Também aceita |, —, - ou tabulação (copiar de planilha). Se a tradução vier primeiro, o app inverte.</Text>
        <Text variant="small" style={{ fontFamily: "monospace" }} color={c.textMuted}>{EXAMPLE}</Text>
      </Card>
      <Field multiline value={text} onChangeText={(t) => { setText(t); setDone(null); }} placeholder="Cole aqui suas frases" autoCapitalize="sentences" />
      {text.trim() ? (
        <Stack gap={6}>
          <Text variant="small" weight="700">{parsed.phrases.length} frase(s) prontas para adicionar</Text>
          {parsed.phrases.slice(0, 5).map((p) => (
            <Row key={p.term} gap={8}><Text variant="small" weight="600" style={{ flex: 1 }}>{p.term}</Text><Text variant="small" muted style={{ flex: 1 }}>{p.meaning_pt}</Text></Row>
          ))}
          {parsed.phrases.length > 5 ? <Text variant="tiny" muted>… e mais {parsed.phrases.length - 5}</Text> : null}
          {parsed.invalid.length ? <Text variant="tiny" color={c.warning}>{parsed.invalid.length} linha(s) sem tradução foram ignoradas (ex.: “{parsed.invalid[0].slice(0, 50)}”).</Text> : null}
        </Stack>
      ) : null}
      <Button title={`Adicionar ${parsed.phrases.length || ""} à revisão`.replace("  ", " ")} icon="add-circle" size="lg"
        disabled={!parsed.phrases.length} loading={busy} onPress={save} />
      <ErrorText error={error} />
      {done ? (
        <Stack gap={10}>
          <Banner tone="success" title="Pronto!">{`${done.added} frase(s) adicionadas${done.skipped ? ` · ${done.skipped} já existiam` : ""}. Elas aparecem na Revisão a partir de hoje (até o seu limite diário de cartões novos).`}</Banner>
          <Button title="Ir para a Revisão" variant="secondary" icon="albums" onPress={() => router.push("/(tabs)/vocab")} />
        </Stack>
      ) : null}
      <Text variant="tiny" muted>Use materiais seus, para estudo pessoal. Nada é enviado para fora do aparelho no modo local.</Text>
    </Screen>
  );
}
