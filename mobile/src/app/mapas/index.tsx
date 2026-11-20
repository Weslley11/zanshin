import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Enter, PressableScale, ProgressRing } from "../../components/motion";
import { Card, Collapsible, ErrorText, Gradient, Icon, Loading, ModuleHero, Pill, Row, Screen, SectionHeader, Stack, Text } from "../../components/ui";
import type { IconName } from "../../components/ui";
import { api } from "../../lib/api";
import { dueInDays, MAP_EVIDENCE, TRACK_LABEL } from "../../lib/mindMaps";
import { useTheme } from "../../lib/theme";

/** Mapas mentais: lista com progresso e quando reconstruir cada um de novo (espaçamento). */
export default function MindMaps() {
  const { c } = useTheme();
  const [ov, setOv] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    api("/maps").then(setOv).catch((e) => setError(e.message));
  }, []));

  if (!ov) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const next = ov.maps.find((m: any) => m.id === ov.next_map_id);
  const due = ov.maps.filter((m: any) => dueInDays(m.sessions, m.last_at) === 0);
  const open = (id: string) => router.push({ pathname: "/mapas/[id]", params: { id } });

  return (
    <Screen>
      <ModuleHero title="Mapas mentais" icon="git-network" gradient="maps"
        subtitle="Um tema no centro, 4 ramos, 3 frases em cada. Você não só olha: reconstrói de memória — é isso que fixa."
        right={(
          <ProgressRing value={ov.practiced / ov.total} size={84} stroke={9} colors={["#FFFFFF", "#C7F9FF"]} track="rgba(255,255,255,0.25)">
            <Text weight="800" color="#fff">{ov.practiced}/{ov.total}</Text>
          </ProgressRing>
        )}>
        <Row gap={6} wrap>
          <Pill label={`${ov.mastered} dominados`} icon="trophy" color="#fff" bg="rgba(255,255,255,0.22)" />
          {due.length ? <Pill label={`${due.length} para revisar hoje`} icon="alarm" color="#fff" bg="rgba(255,255,255,0.22)" /> : null}
        </Row>
      </ModuleHero>

      {(due[0] ?? next) ? (
        <Enter index={1}>
          <PressableScale onPress={() => open((due[0] ?? next).id)} accessibilityLabel="Abrir mapa sugerido">
            <Card style={{ gap: 6, borderColor: c.primary, borderWidth: 1.5 }}>
              <Text variant="label" color={c.primary}>{due[0] ? "Hora de reconstruir (revisão espaçada)" : "Sugestão para agora"}</Text>
              <Row gap={12}>
                <Gradient name="maps" style={{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={(due[0] ?? next).icon as IconName} size={26} color="#fff" />
                </Gradient>
                <View style={{ flex: 1 }}>
                  <Text weight="800">{(due[0] ?? next).title_pt}</Text>
                  <Text variant="small" muted>{(due[0] ?? next).leaf_count} frases · ~6 min</Text>
                </View>
                <Icon name="play-circle" size={36} color={c.primary} />
              </Row>
            </Card>
          </PressableScale>
        </Enter>
      ) : null}

      <Collapsible title="Por que mapas mentais assim (o que a pesquisa diz)">
        <Stack gap={8}>
          {MAP_EVIDENCE.map((e) => (
            <Text key={e.title_pt} variant="small"><Text variant="small" weight="800">{e.title_pt}: </Text>{e.text_pt}</Text>
          ))}
          <Text variant="small" muted>Nenhum método é infalível. O que mais funciona é a combinação: puxar da memória + espaçar as revisões + usar de verdade (falar).</Text>
        </Stack>
      </Collapsible>

      <SectionHeader title="Seus mapas" />
      {ov.maps.map((m: any, k: number) => {
        const d = dueInDays(m.sessions, m.last_at);
        return (
          <Enter key={m.id} index={k + 2}>
            <Card onPress={() => open(m.id)} accessibilityLabel={`Mapa: ${m.title_pt}`} style={{ gap: 6 }}>
              <Row gap={12}>
                <Gradient name="maps" style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={m.icon as IconName} size={22} color="#fff" />
                </Gradient>
                <View style={{ flex: 1 }}>
                  <Text weight="800">{m.title_pt}</Text>
                  <Text variant="small" muted>{m.center_en} · {m.leaf_count} frases</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={c.textMuted} />
              </Row>
              <Row gap={6} wrap>
                <Pill label={TRACK_LABEL[m.track] ?? m.track} icon={m.track === "us" ? "snow" : m.track === "india" ? "flag" : "briefcase"} />
                {m.sessions ? <Pill label={`melhor: ${Math.round(m.best_score * 100)}%`} icon="trophy" color={c.success} /> : <Pill label="novo" icon="sparkles" />}
                {d === 0 ? <Pill label="revisar hoje" icon="alarm" color={c.primary} /> : d != null ? <Pill label={`revisar em ${d} d`} icon="calendar" /> : null}
              </Row>
            </Card>
          </Enter>
        );
      })}
    </Screen>
  );
}
