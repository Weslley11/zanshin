import { router } from "expo-router";
import { View } from "react-native";
import { Banner, ModuleTile, Screen, SectionHeader, Text } from "../../components/ui";
import { Enter } from "../../components/motion";
import { LOCAL_MODE } from "../../lib/api";
import { useApp } from "../../lib/app";
import { MODULES } from "../../lib/modules";

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Falar", ids: ["tutor", "unlock", "scenarios"] },
  { title: "Ouvir e pronunciar", ids: ["listening", "shadowing", "india"] },
  { title: "Memorizar e medir", ids: ["vocab", "errors", "plan", "assessment", "documents"] },
];

export default function ModulesHub() {
  const { language, profile } = useApp();
  const visible = MODULES.filter((m) => language === "en" || !m.enOnly);
  let index = 0;
  return (
    <Screen>
      <Enter>
        <Text variant="display">Módulos</Text>
        <Text muted>Escolha o que treinar agora. Cada módulo foca em uma habilidade — o seu plano já mistura todos.</Text>
      </Enter>
      {profile?.trip_destination === "IN" && language === "en" ? (
        <ModuleTile wide index={index++} title="Sua viagem: Índia" subtitle="Entenda o inglês indiano antes de embarcar" icon="earth" gradient="india"
          onPress={() => router.push("/india")} />
      ) : null}
      {GROUPS.map((g) => {
        const mods = g.ids.map((id) => visible.find((m) => m.id === id)).filter(Boolean) as typeof MODULES;
        if (!mods.length) return null;
        return (
          <View key={g.title} style={{ gap: 12 }}>
            <SectionHeader title={g.title} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {mods.map((m) => (
                <ModuleTile key={m.id} index={index++} title={m.title} subtitle={m.subtitle} icon={m.icon} gradient={m.gradient}
                  badge={m.serverOnly && LOCAL_MODE ? "SERVIDOR" : undefined} onPress={() => router.push(m.href as any)} />
              ))}
            </View>
          </View>
        );
      })}
      {LOCAL_MODE ? <Banner icon="phone-portrait" title="Modo local">Documentos técnicos e voz no servidor exigem conectar um servidor; todo o resto funciona offline no aparelho.</Banner> : null}
    </Screen>
  );
}
