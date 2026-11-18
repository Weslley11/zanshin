import { Switch, View } from "react-native";
import { useTheme } from "../lib/theme";
import { Card, Stack, Text } from "./ui";

const CONSENTS: { key: string; title: string; desc: string }[] = [
  { key: "ai_processing", title: "Processamento por IA", desc: "Suas mensagens ao tutor são enviadas ao provedor de IA configurado para gerar respostas e correções." },
  { key: "voice_processing", title: "Processamento de voz", desc: "Seu áudio é transcrito para conversar e avaliar pronúncia. Por padrão, o áudio é descartado após o processamento." },
  { key: "recording_storage", title: "Guardar gravações", desc: "Opcional: mantém suas gravações por até 30 dias para comparar sua evolução." },
  { key: "document_processing", title: "Documentos técnicos", desc: "Permite enviar documentos (autorizados) para gerar exercícios. Dados pessoais são removidos antes." },
];

export function ConsentToggles({ value, onChange }: { value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  const { c } = useTheme();
  return (
    <Stack gap={10}>
      {CONSENTS.map((k) => (
        <Card key={k.key} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="600">{k.title}</Text>
            <Text variant="small" muted>{k.desc}</Text>
          </View>
          <Switch
            accessibilityLabel={k.title}
            value={!!value[k.key]}
            onValueChange={(v) => onChange({ ...value, [k.key]: v })}
            trackColor={{ true: c.primary, false: c.surfaceAlt }}
          />
        </Card>
      ))}
    </Stack>
  );
}

