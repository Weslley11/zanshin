import { router } from "expo-router";
import { View } from "react-native";
import { Card, Icon, ModuleHero, Row, Screen, SectionHeader, Text, type IconName } from "../components/ui";
import { Enter } from "../components/motion";
import { Gradient } from "../components/ui";
import type { GradientName } from "../lib/theme";
import { useTheme } from "../lib/theme";

const DRILLS: { icon: IconName; title: string; desc: string; go: () => void; gradient: GradientName }[] = [
  { icon: "flash", title: "Quick Response", desc: "Responda antes do tempo acabar; a janela encurta a cada acerto.", go: () => router.push("/drills/quick"), gradient: "unlock" },
  { icon: "bulb", title: "Think in English", desc: "Descrever, explicar sem a palavra, falar sozinho — sem traduzir.", go: () => router.push("/drills/think"), gradient: "assessment" },
  { icon: "extension-puzzle", title: "Construção de frases", desc: "Do bloco simples à resposta completa (por quê, quando, contraste).", go: () => router.push("/drills/build"), gradient: "plan" },
  { icon: "ban", title: "No Portuguese Mode", desc: "Conversa só em inglês; ajuda em inglês simples quando precisar.", go: () => router.push({ pathname: "/tutor/new", params: { mode: "no_native" } }), gradient: "tutor" },
  { icon: "create", title: "Correção imediata", desc: "Treino focado: correção após cada mensagem.", go: () => router.push({ pathname: "/tutor/new", params: { mode: "immediate" } }), gradient: "errors" },
];

export default function Unlock() {
  const { c } = useTheme();
  return (
    <Screen>
      <ModuleHero title="Destravar a Fala" icon="flash" gradient="unlock"
        subtitle="Para quem entende lendo, mas trava para responder. Treinos curtos e intensos para falar sem tradução mental." />
      <SectionHeader title="Treinos" />
      {DRILLS.map((d, i) => (
        <Card key={d.title} index={i} onPress={d.go} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Gradient name={d.gradient} style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
            <Icon name={d.icon} size={24} color="#fff" />
          </Gradient>
          <View style={{ flex: 1 }}>
            <Text weight="800">{d.title}</Text>
            <Text variant="small" muted>{d.desc}</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={c.textMuted} />
        </Card>
      ))}
      <SectionHeader title="Conversation Challenge" />
      <Enter index={6}>
        <Row wrap gap={10}>
          {[3, 5, 10, 15, 30].map((m, i) => (
            <Card key={m} index={7 + i} style={{ minWidth: 96, alignItems: "center", flexGrow: 1 }}
              onPress={() => router.push({ pathname: "/tutor/new", params: { mode: "challenge", minutes: String(m) } })}>
              <Icon name="timer" size={22} color={c.primary} />
              <Text variant="h3">{m} min</Text>
            </Card>
          ))}
        </Row>
      </Enter>
    </Screen>
  );
}
