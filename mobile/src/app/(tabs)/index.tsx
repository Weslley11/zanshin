import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import flameAnim from "../../assets/lottie/flame.json";
import globeAnim from "../../assets/lottie/globe.json";
import { ActivityRow } from "../../components/ActivityRow";
import { InstallHint } from "../../components/InstallHint";
import Lottie from "../../components/Lottie";
import { AnimatedNumber, Enter, Float, PressableScale, ProgressRing, PulseRings } from "../../components/motion";
import { Banner, Card, ErrorText, Gradient, Icon, Loading, ModuleTile, Pill, Row, Screen, SectionHeader, Stack, Text } from "../../components/ui";
import { activityHref } from "../../lib/activities";
import { api, LOCAL_MODE } from "../../lib/api";
import { useApp } from "../../lib/app";
import { MODULES } from "../../lib/modules";
import { gradients, useTheme } from "../../lib/theme";
import type { PlanDay } from "../../lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Home() {
  const { me, caps, language, profile } = useApp();
  const { c } = useTheme();
  const [dash, setDash] = useState<any>(null);
  const [today, setToday] = useState<PlanDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api(`/dashboard?language=${language}`);
        if (!alive) return;
        setDash(d);
        if (d.plan) setToday(await api(`/plans/current/days/${d.plan.day}?language=${language}`));
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, [language]));

  const startTalking = () => {
    const conv = today?.activities.find((a) => a.type === "conversation" && !a.done);
    if (conv && today) router.push(activityHref(conv, today.day) as any);
    else router.push({ pathname: "/tutor/new", params: { mode: "natural" } });
  };

  const effort = dash?.effort;
  const plan = dash?.plan;
  const india = profile?.trip_destination === "IN";
  const done = today?.activities.filter((a) => a.done).length ?? 0;
  const next = today?.activities.find((a) => !a.done);
  const modules = MODULES.filter((m) => (language === "en" || !m.enOnly) && m.id !== "documents").slice(0, 6);

  return (
    <Screen>
      <Enter>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text muted>{greeting()},</Text>
            <Text variant="h1" numberOfLines={1}>{me?.display_name || "você"}</Text>
          </View>
          <Row gap={4} style={{ backgroundColor: c.surface, borderRadius: 999, paddingRight: 14, paddingLeft: 4, paddingVertical: 2, borderWidth: 1, borderColor: c.border }}>
            <Lottie source={flameAnim} style={{ width: 34, height: 34 }} />
            <Text weight="800">{effort?.streak_days ?? 0}</Text>
            <Text variant="tiny" muted>{effort?.streak_days === 1 ? "dia" : "dias"}</Text>
          </Row>
        </Row>
      </Enter>

      <Enter index={1}>
        <PressableScale onPress={startTalking} accessibilityLabel="Começar a falar agora">
          <Gradient name="speak" style={{ borderRadius: 28, padding: 22, overflow: "hidden", minHeight: 170 }}>
            <View style={{ position: "absolute", width: 240, height: 240, borderRadius: 120, right: -60, top: -70, backgroundColor: "rgba(255,255,255,0.12)" }} />
            <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 6, paddingRight: 8 }}>
                <Pill label={plan ? `Dia ${plan.day} de ${plan.total_days}` : "Comece agora"} icon="sparkles" color="#fff" bg="rgba(255,255,255,0.22)" />
                <Text variant="h1" color="#FFFFFF">Começar a falar agora</Text>
                <Text variant="small" color="rgba(255,255,255,0.92)">
                  Conversa com o tutor · sem interrupções · relatório no final
                </Text>
              </View>
              <View style={{ width: 76, height: 76, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
                <PulseRings size={64} color="#FFFFFF" />
                <Float amplitude={4}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="mic" size={30} color={gradients.speak[1]} />
                  </View>
                </Float>
              </View>
            </Row>
          </Gradient>
        </PressableScale>
      </Enter>

      <InstallHint />
      <ErrorText error={error} />
      {!dash && !error ? <Loading /> : null}

      {effort ? (
        <Card index={2} style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <ProgressRing value={effort.today_minutes / effort.daily_goal_minutes} size={92} stroke={10} colors={gradients.brand}>
            <AnimatedNumber value={effort.today_minutes} render={(s) => <Text variant="h2">{s}</Text>} />
            <Text variant="tiny" muted>/ {effort.daily_goal_minutes} min</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label" muted>Hoje</Text>
            <Text variant="h3">{today ? `${done} de ${today.activities.length} atividades` : "Sem plano ativo"}</Text>
            {today ? <Text variant="small" muted numberOfLines={2}>Fase {today.phase} · {today.focus}</Text> : null}
            <Row gap={6} wrap style={{ marginTop: 4 }}>
              <Pill icon="albums" label={`${dash.pending.cards_due} revisões`} />
              {dash.level_estimate ? <Pill icon="ribbon" label={`Nível ${dash.level_estimate}`} /> : null}
            </Row>
          </View>
        </Card>
      ) : null}

      {india ? (
        <Card index={3} onPress={() => router.push("/india")} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
          <Lottie source={globeAnim} style={{ width: 64, height: 64 }} />
          <View style={{ flex: 1 }}>
            <Text weight="800">Preparação para a Índia</Text>
            <Text variant="small" muted>Sotaque, expressões e valores em lakh/crore.</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={c.textMuted} />
        </Card>
      ) : null}

      {today ? (
        <Card index={4} style={{ gap: 4 }}>
          <SectionHeader title="Plano de hoje" action="Jornada" onAction={() => router.push("/plan")} />
          {today.activities.map((a, i) => <ActivityRow key={a.id} a={a} index={i} onPress={() => router.push(activityHref(a, today.day) as any)} />)}
          {!next ? <Text variant="small" color={c.success} weight="700">Dia concluído! 🎉</Text> : null}
        </Card>
      ) : dash && !plan ? (
        <Card index={4} tone="primary" style={{ gap: 10 }} onPress={async () => {
          try { await api("/plans", { body: { language } }); router.replace("/(tabs)"); } catch (e: any) { setError(e.message); }
        }}>
          <Text weight="800">Gerar meu programa intensivo</Text>
          <Text variant="small" muted>Um plano diário com fases, metas e avaliações a cada 15 dias.</Text>
        </Card>
      ) : null}

      <SectionHeader title="Módulos" action="Ver todos" onAction={() => router.push("/(tabs)/practice")} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {modules.map((m, i) => (
          <ModuleTile key={m.id} index={i} title={m.title} subtitle={m.subtitle} icon={m.icon} gradient={m.gradient}
            progress={m.id === "vocab" && dash ? dash.vocabulary.learned / Math.max(dash.vocabulary.total, 1)
              : m.id === "plan" && plan ? plan.percent_activities_done / 100 : null}
            onPress={() => router.push(m.href as any)} />
        ))}
      </View>

      {caps && !caps.llm.generative ? (
        <Banner tone="accent" icon={LOCAL_MODE ? "phone-portrait" : "information-circle"} title={LOCAL_MODE ? "Modo local · grátis e offline" : "Modo offline (sem IA generativa)"}>
          {LOCAL_MODE
            ? "Tudo roda no seu aparelho e seus dados ficam com você. O tutor usa roteiros e corrige erros comuns por regras (sem IA generativa)."
            : "O tutor segue roteiros e corrige erros comuns por regras. Para conversas abertas, configure um provedor de IA no servidor."}
        </Banner>
      ) : null}
      <Stack gap={2}>
        {dash?.level_estimate ? <Text variant="tiny" muted center>Nível {dash.level_estimate}: estimativa interna (CEFR), não certificação.</Text> : null}
      </Stack>
    </Screen>
  );
}
