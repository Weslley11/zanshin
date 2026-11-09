import { router } from "expo-router";
import { View } from "react-native";
import { Card, Row, Screen, Stack, Text } from "../../components/ui";
import { useApp } from "../../lib/app";

type Item = { icon: string; title: string; desc: string; go: () => void };

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <Stack gap={10}>
      <Text variant="label" muted>{title}</Text>
      {items.map((it) => (
        <Card key={it.title} onPress={it.go} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Text variant="h2">{it.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text weight="700">{it.title}</Text>
            <Text variant="small" muted>{it.desc}</Text>
          </View>
          <Text muted>›</Text>
        </Card>
      ))}
    </Stack>
  );
}

const tutor = (mode: string, extra: Record<string, string> = {}) => () =>
  router.push({ pathname: "/tutor/new", params: { mode, ...extra } });

export default function Practice() {
  const { language, profile } = useApp();
  const en = language === "en";
  const india = profile?.trip_destination === "IN";
  return (
    <Screen>
      <Text variant="h2">Praticar</Text>
      {en ? (
        <Section title={india ? "Sua viagem" : "Variedades do inglês"} items={[
          { icon: "🇮🇳", title: "Inglês da Índia", desc: "Sotaque, ritmo, expressões, números em lakh/crore e comunicação no trabalho.", go: () => router.push("/india") },
        ]} />
      ) : null}
      <Section title="Professor particular (IA)" items={[
        { icon: "💬", title: "Conversa natural", desc: "Sem interrupções; correções e vocabulário no relatório final.", go: tutor("natural") },
        { icon: "✏️", title: "Treino com correção imediata", desc: "Correção após cada mensagem, com explicação curta.", go: tutor("immediate") },
        { icon: "🚫🇧🇷", title: "No Portuguese Mode", desc: "Só no idioma estudado — explicações simplificadas quando precisar.", go: tutor("no_native") },
      ]} />
      <Stack gap={10}>
        <Text variant="label" muted>Conversation Challenge</Text>
        <Row wrap gap={10}>
          {[3, 5, 10, 15, 30].map((m) => (
            <Card key={m} style={{ minWidth: 92, alignItems: "center" }} onPress={tutor("challenge", { minutes: String(m) })}>
              <Text variant="h3">{m} min</Text>
            </Card>
          ))}
        </Row>
      </Stack>
      <Section title="Destravar a fala" items={[
        { icon: "⚡", title: "Quick Response", desc: "Responda antes do tempo acabar; a janela encurta conforme você acerta.", go: () => router.push("/drills/quick") },
        { icon: "💭", title: "Think in English", desc: "Descrever, explicar sem a palavra, falar sozinho — sem traduzir.", go: () => router.push("/drills/think") },
        { icon: "🧩", title: "Construção de frases", desc: "Do bloco simples à resposta completa (por quê, quando, contraste).", go: () => router.push("/drills/build") },
      ]} />
      <Section title="Simulações" items={[
        { icon: "🎭", title: "Viagem e trabalho", desc: "Aeroporto, hotel, restaurante, reuniões, problemas técnicos, networking.", go: () => router.push("/scenarios") },
      ]} />
      <Section title="Ouvir e pronunciar" items={[
        ...(en ? [{ icon: "🎧", title: "Listening com sotaques", desc: "EUA, Reino Unido, Austrália e Índia; ajuste a velocidade.", go: () => router.push("/listening") }] : []),
        { icon: "🔁", title: "Shadowing", desc: "Ouça, imite e receba feedback de ritmo, pausas e inteligibilidade.", go: () => router.push("/shadowing") },
      ]} />
      <Section title="Personalização" items={[
        { icon: "🩹", title: "Seus erros recorrentes", desc: "Revisão automática do que você mais erra.", go: () => router.push("/errors") },
        { icon: "📄", title: "Documentos técnicos", desc: "Gere vocabulário e exercícios a partir de material autorizado.", go: () => router.push("/documents") },
        { icon: "📊", title: "Avaliação de progresso", desc: "Listening, vocabulário, gramática, leitura e fala (CEFR).", go: () => router.push({ pathname: "/assessment", params: { kind: "checkpoint" } }) },
      ]} />
    </Screen>
  );
}
