import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Banner, Button, Card, ErrorText, Loading, ProgressBar, Row, Screen, Stack, Text } from "../../components/ui";
import { ACTIVITY_ICONS, activityHref, formatMinutes } from "../../lib/activities";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { useTheme } from "../../lib/theme";
import type { PlanDay } from "../../lib/types";

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
  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 8 }}>
        <Text muted>Olá{me?.display_name ? `, ${me.display_name}` : ""} 👋</Text>
        <Text variant="h2">{plan ? `Dia ${plan.day} de ${plan.total_days}` : "Pronto para praticar?"}</Text>
        {today ? <Text muted variant="small">Fase {today.phase} · {today.focus}</Text> : null}
      </View>

      <Pressable onPress={startTalking} accessibilityRole="button" accessibilityLabel="Começar a falar agora"
        style={({ pressed }) => ({ backgroundColor: c.primary, borderRadius: 22, padding: 22, opacity: pressed ? 0.9 : 1, gap: 6 })}>
        <Text variant="h2" color={c.primaryText}>🎙️ Começar a falar agora</Text>
        <Text variant="small" color={c.primaryText}>
          Conversa com o tutor{caps?.stt.available ? " por voz" : ""} · sem interrupções para pequenos erros · relatório no final
        </Text>
      </Pressable>

      {profile?.trip_destination === "IN" ? (
        <Card tone="accent" onPress={() => router.push("/india")} style={{ gap: 4 }}>
          <Text weight="700">🇮🇳 Preparação para a Índia</Text>
          <Text variant="small">Entenda o inglês indiano: sotaque e ritmo, expressões (do the needful, revert, prepone) e valores em lakh/crore.</Text>
        </Card>
      ) : null}

      {caps && !caps.llm.generative ? (
        <Banner tone="warning" title="Modo offline (sem IA generativa)">
          O tutor segue roteiros e corrige erros comuns por regras. Para conversas abertas e relatórios completos, configure um provedor de IA no servidor.
        </Banner>
      ) : null}
      <ErrorText error={error} />
      {!dash && !error ? <Loading /> : null}

      {effort ? (
        <Row gap={12}>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text variant="label" muted>Hoje</Text>
            <Text variant="h3">{formatMinutes(effort.today_minutes)} / {effort.daily_goal_minutes} min</Text>
            <ProgressBar value={effort.today_minutes / effort.daily_goal_minutes} />
          </Card>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text variant="label" muted>Sequência</Text>
            <Text variant="h3">{effort.streak_days} {effort.streak_days === 1 ? "dia" : "dias"}</Text>
            <Text variant="tiny" muted>{dash.pending.cards_due} revisões pendentes</Text>
          </Card>
        </Row>
      ) : null}

      {today ? (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="h3">Plano de hoje</Text>
            <Text variant="small" muted>{today.activities.filter((a) => a.done).length}/{today.activities.length}</Text>
          </Row>
          {today.activities.map((a) => (
            <Pressable key={a.id} onPress={() => router.push(activityHref(a, today.day) as any)} accessibilityRole="button"
              accessibilityLabel={`${a.title_pt}, ${a.minutes} minutos${a.done ? ", concluída" : ""}`}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
              <Text variant="h3">{a.done ? "✅" : ACTIVITY_ICONS[a.type] ?? "•"}</Text>
              <View style={{ flex: 1 }}>
                <Text weight="600" muted={a.done} style={a.done ? { textDecorationLine: "line-through" } : undefined}>{a.title_pt}</Text>
                <Text variant="tiny" muted>{a.minutes} min</Text>
              </View>
              <Text muted>›</Text>
            </Pressable>
          ))}
          <Button title="Ver o programa completo" variant="ghost" size="sm" onPress={() => router.push("/plan")} />
        </Card>
      ) : dash && !plan ? (
        <Card tone="accent" style={{ gap: 10 }}>
          <Text weight="700">Você ainda não tem um plano ativo.</Text>
          <Button title="Gerar meu programa intensivo" onPress={async () => {
            try { await api("/plans", { body: { language } }); router.replace("/(tabs)"); } catch (e: any) { setError(e.message); }
          }} />
        </Card>
      ) : null}

      <Text variant="label" muted>Prática rápida</Text>
      <Row gap={12}>
        <Card style={{ flex: 1 }} onPress={() => router.push("/drills/quick")}>
          <Text variant="h3">⚡ 5 min</Text>
          <Text variant="small" muted>Quick Response</Text>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push("/(tabs)/vocab")}>
          <Text variant="h3">🗂️ {dash?.pending.cards_due ?? "–"}</Text>
          <Text variant="small" muted>Revisões de hoje</Text>
        </Card>
      </Row>
      {plan?.next_assessment_day && plan.next_assessment_day !== plan.day ? (
        <Text variant="small" muted center>Próxima avaliação de progresso: dia {plan.next_assessment_day}</Text>
      ) : null}
      {dash?.level_estimate ? (
        <Stack gap={2}>
          <Text variant="small" muted center>Nível estimado: {dash.level_estimate} (estimativa interna, não certificação)</Text>
        </Stack>
      ) : null}
    </Screen>
  );
}
