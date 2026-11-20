import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Enter, PressableScale, ProgressRing, PulseRings } from "../../components/motion";
import { Card, Collapsible, ErrorText, Gradient, Icon, Loading, ModuleHero, Pill, Row, Screen, SectionHeader, Segmented, Stack, Text } from "../../components/ui";
import type { IconName } from "../../components/ui";
import { api } from "../../lib/api";
import { radius, useTheme } from "../../lib/theme";

type Track = "india" | "us";
const TRACKS: Record<Track, { title: string; icon: IconName; gradient: "india" | "usa"; subtitle: string }> = {
  india: { title: "Missão Índia", icon: "flag", gradient: "india",
           subtitle: "Frases prontas para falar e entender indianos no trabalho e na viagem — 12 minutos por missão." },
  us: { title: "Missão Wisconsin", icon: "snow", gradient: "usa",
        subtitle: "Imigração, inverno, unidades americanas, reuniões e small talk do Meio-Oeste — 12 minutos por missão." },
};

/** Trilhas de missões curtas: Índia e Wisconsin (EUA). */
export default function MissionMap() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ track?: string }>();
  const [track, setTrack] = useState<Track>(params.track === "us" ? "us" : "india");
  const [ov, setOv] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const T = TRACKS[track];

  useFocusEffect(useCallback(() => {
    setError(null);
    api(`/india/missions?track=${track}`).then(setOv).catch((e) => setError(e.message));
  }, [track]));

  const picker = (
    <Segmented<Track> value={track} onChange={(v) => { setOv(null); setTrack(v); }}
      options={[{ value: "india", label: "Índia" }, { value: "us", label: "Wisconsin (EUA)" }]} />
  );
  if (!ov || ov.track !== track) return <Screen>{picker}<ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const next = ov.missions.find((m: any) => m.id === ov.next_mission_id);
  const allDone = ov.completed === ov.total;

  return (
    <Screen>
      {picker}
      <ModuleHero title={T.title} icon={T.icon} gradient={T.gradient}
        subtitle={T.subtitle}
        right={(
          <ProgressRing value={ov.completed / ov.total} size={84} stroke={9} colors={["#FFFFFF", "#FFE7A3"]} track="rgba(255,255,255,0.25)">
            <Text weight="800" color="#fff">{ov.completed}/{ov.total}</Text>
          </ProgressRing>
        )}>
        <Row gap={6} wrap>
          <Pill label={`${ov.phrases_learned} frases aprendidas`} icon="chatbox-ellipses" color="#fff" bg="rgba(255,255,255,0.22)" />
        </Row>
      </ModuleHero>

      {next ? (
        <Enter index={1}>
          <PressableScale onPress={() => router.push({ pathname: "/missao/[id]", params: { id: next.id } })} accessibilityLabel={`Começar missão ${next.order}`}>
            <Card style={{ gap: 8, borderColor: c.primary, borderWidth: 1.5 }}>
              <Text variant="label" color={c.primary}>{allDone ? "Revisar a missão mais difícil" : next.completed ? "Continuar" : "Próxima missão"}</Text>
              <Row gap={12}>
                <Gradient name={T.gradient} style={{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={next.icon as IconName} size={26} color="#fff" />
                </Gradient>
                <View style={{ flex: 1 }}>
                  <Text weight="800">Missão {next.order}: {next.title_pt}</Text>
                  <Text variant="small" muted numberOfLines={2}>{next.goal_pt}</Text>
                </View>
                <Icon name="play-circle" size={36} color={c.primary} />
              </Row>
            </Card>
          </PressableScale>
        </Enter>
      ) : null}

      <Collapsible title="Como funciona (e por que é rápido)">
        <Stack gap={6}>
          <Text variant="small">1. <Text variant="small" weight="700">Ouvir</Text>: frases inteiras (não palavras soltas), com voz {track === "us" ? "americana" : "indiana"}.</Text>
          <Text variant="small">2. <Text variant="small" weight="700">Falar</Text>: do português para o inglês, em voz alta — puxar da memória fixa muito mais que reler.</Text>
          <Text variant="small">3. <Text variant="small" weight="700">Entender</Text>: {track === "us"
            ? "frases como os americanos do Meio-Oeste dizem (ope, you betcha, circle back, five thou…)."
            : "frases do jeito que os indianos dizem (only, itself, revert, lakh…)."}</Text>
          <Text variant="small">4. <Text variant="small" weight="700">Conversar</Text>: aplicar numa mini-conversa real.</Text>
          <Text variant="small" muted>Depois, cada frase entra na revisão espaçada (FSRS): volta no dia certo para não esquecer. O ritmo ideal é 1 missão por dia + 5 min de revisão.</Text>
        </Stack>
      </Collapsible>

      <SectionHeader title="Trilha" />
      <View>
        {ov.missions.map((m: any, k: number) => {
          const isNext = m.id === ov.next_mission_id && !allDone;
          const last = k === ov.missions.length - 1;
          return (
            <Enter key={m.id} index={k + 2}>
              <Row gap={12} style={{ alignItems: "stretch" }}>
                <View style={{ width: 44, alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                    {isNext ? <PulseRings size={44} color={c.primary} rings={2} /> : null}
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
                                   backgroundColor: m.completed ? c.success : isNext ? c.primary : c.surfaceAlt }}>
                      {m.completed ? <Icon name="checkmark" size={22} color="#fff" /> : <Text weight="800" color={isNext ? "#fff" : c.textMuted}>{m.order}</Text>}
                    </View>
                  </View>
                  {!last ? <View style={{ flex: 1, width: 3, minHeight: 14, backgroundColor: m.completed ? c.success : c.border, borderRadius: 2 }} /> : null}
                </View>
                <PressableScale style={{ flex: 1, minWidth: 0, paddingBottom: 14 }} onPress={() => router.push({ pathname: "/missao/[id]", params: { id: m.id } })}
                  accessibilityLabel={`Missão ${m.order}: ${m.title_pt}`}>
                  <Card style={{ gap: 4, paddingVertical: 12 }}>
                    <Row style={{ justifyContent: "space-between" }} gap={8}>
                      <Text weight="800" style={{ flex: 1 }}>{m.title_pt}</Text>
                      <Icon name={m.icon as IconName} size={18} color={c.textMuted} />
                    </Row>
                    <Text variant="small" muted numberOfLines={2}>{m.subtitle_pt}</Text>
                    <Row gap={6} wrap>
                      <Pill label={`${m.chunk_count} frases · ~${m.minutes} min`} icon="time" />
                      {m.completed ? <Pill label={`melhor: ${Math.round(m.best_score * 100)}%`} icon="trophy" color={c.success} /> : null}
                    </Row>
                  </Card>
                </PressableScale>
              </Row>
            </Enter>
          );
        })}
      </View>

      <SectionHeader title="Mais treino" />
      <Card onPress={() => router.push("/frases")} style={{ gap: 4 }}>
        <Row gap={12}>
          <Gradient name="vocab" style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }}>
            <Icon name="clipboard" size={22} color="#fff" />
          </Gradient>
          <View style={{ flex: 1 }}>
            <Text weight="800">Minhas frases</Text>
            <Text variant="small" muted>Cole frases dos seus materiais (e-books, anotações, e-mails) e elas entram na revisão espaçada.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={c.textMuted} />
        </Row>
      </Card>
      <Card onPress={() => router.push("/mapas")} style={{ gap: 4 }}>
        <Row gap={12}>
          <Gradient name="maps" style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }}>
            <Icon name="git-network" size={22} color="#fff" />
          </Gradient>
          <View style={{ flex: 1 }}>
            <Text weight="800">Mapas mentais</Text>
            <Text variant="small" muted>Reconstrua de memória os temas da viagem (inclui Índia, Wisconsin e unidades americanas).</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={c.textMuted} />
        </Row>
      </Card>
      {track === "india" ? (<>
      <Card onPress={() => router.push("/drills/quick")} style={{ gap: 4 }}>
        <Row gap={12}>
          <Gradient name="unlock" style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }}>
            <Icon name="flash" size={22} color="#fff" />
          </Gradient>
          <View style={{ flex: 1 }}>
            <Text weight="800">Perguntas rápidas de indianos</Text>
            <Text variant="small" muted>Responda antes do tempo acabar (veg or non-veg?, prepone, lakh…).</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={c.textMuted} />
        </Row>
      </Card>
      <Card onPress={() => router.push("/india")} style={{ gap: 4 }}>
        <Row gap={12}>
          <Gradient name="listening" style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }}>
            <Icon name="earth" size={22} color="#fff" />
          </Gradient>
          <View style={{ flex: 1 }}>
            <Text weight="800">Guia do inglês da Índia</Text>
            <Text variant="small" muted>Sotaque, expressões, números e cultura de trabalho.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={c.textMuted} />
        </Row>
      </Card>
      </>) : (
        <Card tone="accent" style={{ gap: 6 }}>
          <Text weight="800">Antes de viajar aos EUA</Text>
          <Text variant="small">Brasileiros precisam de visto (B-1 para negócios); não há ESTA para o Brasil. O B-1 cobre reuniões, visitas e treinamentos, não trabalho remunerado nos EUA.</Text>
          <Text variant="small" muted>Confirme regras e prazos no site oficial travel.state.gov e com o RH da empresa — este app não substitui orientação consular.</Text>
        </Card>
      )}
    </Screen>
  );
}
