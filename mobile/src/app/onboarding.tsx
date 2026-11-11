import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import globeAnim from "../assets/lottie/globe.json";
import Lottie from "../components/Lottie";
import { PressableScale } from "../components/motion";
import { Button, Card, Chip, ErrorText, Field, Gradient, Icon, ProgressBar, Row, Screen, Stack, Text, type IconName } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { useTheme, type GradientName } from "../lib/theme";

const LANGS: { code: string; label: string; native: string; note: string; gradient: GradientName }[] = [
  { code: "en", label: "Inglês", native: "English", note: "Programa completo", gradient: "brand" },
  { code: "es", label: "Espanhol", native: "Español", note: "Trilha inicial", gradient: "unlock" },
  { code: "it", label: "Italiano", native: "Italiano", note: "Trilha inicial", gradient: "vocab" },
  { code: "zh", label: "Mandarim", native: "中文", note: "Trilha inicial", gradient: "errors" },
  { code: "ja", label: "Japonês", native: "日本語", note: "Trilha inicial", gradient: "shadowing" },
];
const DOMAINS: [string, string, IconName][] = [
  ["engineering", "Engenharia", "construct"], ["software", "Software", "code-slash"], ["automation", "Automação", "hardware-chip"],
  ["corporate", "Gestão de projetos", "briefcase"], ["travel", "Viagens", "airplane"], ["networking", "Networking", "people"],
];
const DIFFICULTIES = ["Entender quem fala rápido", "Responder sem traduzir", "Pronúncia", "Vocabulário técnico", "Gramática ao falar", "Timidez / confiança"];
const DESTINATIONS: [string | null, string][] = [["IN", "🇮🇳 Índia"], ["US", "🇺🇸 EUA"], ["GB", "🇬🇧 Reino Unido"], ["AU", "🇦🇺 Austrália"], [null, "Outro / não sei"]];
const LEVELS: [string, string, string][] = [["A2", "Básico", "Entendo frases simples e lentas"], ["B1", "Intermediário", "Leio bem, mas travo para falar"],
  ["B2", "Intermediário superior", "Converso, mas com esforço"], ["C1", "Avançado", "Me comunico bem, quero refinar"]];

function isoInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Onboarding() {
  const { refreshMe, me, profile } = useApp();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(profile?.language ?? "en");
  const [minutes, setMinutes] = useState(profile?.daily_minutes ?? 45);
  const [trip, setTrip] = useState(profile?.trip_date ?? isoInDays(90));
  const [destination, setDestination] = useState<string | null>(profile?.trip_destination ?? null);
  const [domains, setDomains] = useState<string[]>(profile?.focus_domains ?? ["engineering", "travel"]);
  const [diffs, setDiffs] = useState<string[]>(profile?.difficulties ?? ["Entender quem fala rápido", "Responder sem traduzir"]);
  const [level, setLevel] = useState(profile?.cefr_estimate ?? "B1");
  const [loading, setLoading] = useState<"assess" | "plan" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const en = language === "en";
  const STEPS = en ? 5 : 4;

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (next: "assess" | "plan") => {
    setLoading(next);
    setError(null);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trip)) throw new Error("Data da viagem no formato AAAA-MM-DD.");
      await api(`/me/profiles/${language}`, {
        method: "PUT",
        body: { daily_minutes: minutes, goals: ["Viagem internacional a trabalho"], focus_domains: domains, difficulties: diffs, trip_date: trip,
                self_level: level, trip_destination: en ? destination : null, preferred_accents: destination ? [] : ["US", "UK"] },
      });
      await refreshMe();
      if (next === "assess" && en) router.replace({ pathname: "/assessment", params: { kind: "placement", thenPlan: "1" } });
      else {
        await api("/plans", { body: { language } });
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const steps = [
    // 0 — idioma
    <Stack key="lang" gap={12}>
      <Text variant="h1">Qual idioma você quer falar?</Text>
      {LANGS.map((l) => (
        <PressableScale key={l.code} onPress={() => setLanguage(l.code)} accessibilityRole="radio">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, borderWidth: 2,
                         borderColor: language === l.code ? c.primary : c.border, backgroundColor: c.surface }}>
            <Gradient name={l.gradient} style={{ width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" }}>
              <Text weight="800" color="#fff">{l.native.slice(0, 2)}</Text>
            </Gradient>
            <View style={{ flex: 1 }}>
              <Text weight="800">{l.label}</Text>
              <Text variant="small" muted>{l.native} · {l.note}</Text>
            </View>
            {language === l.code ? <Icon name="checkmark-circle" size={24} color={c.primary} /> : null}
          </View>
        </PressableScale>
      ))}
    </Stack>,
    // 1 — viagem
    <Stack key="trip" gap={14}>
      <Text variant="h1">Sua viagem</Text>
      {en ? (
        <>
          <Text muted>Para onde você vai? O plano prioriza o sotaque e as situações do destino.</Text>
          <Row wrap>{DESTINATIONS.map(([k, l]) => <Chip key={l} label={l} selected={destination === k} onPress={() => setDestination(k)} />)}</Row>
          {destination === "IN" ? (
            <Card tone="warning" style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 10 }}>
              <Lottie source={globeAnim} style={{ width: 54, height: 54 }} />
              <Text variant="small" style={{ flex: 1 }}>Vamos priorizar entender o inglês indiano: sotaque, ritmo, expressões e números em lakh/crore.</Text>
            </Card>
          ) : null}
        </>
      ) : null}
      <Text variant="label" muted>Quando é a viagem?</Text>
      <Row wrap>{[60, 75, 90, 120].map((d) => <Chip key={d} icon="calendar" label={`em ${d} dias`} selected={trip === isoInDays(d)} onPress={() => setTrip(isoInDays(d))} />)}</Row>
      <Field value={trip} onChangeText={setTrip} placeholder="AAAA-MM-DD" />
    </Stack>,
    // 2 — tempo
    <Stack key="time" gap={14}>
      <Text variant="h1">Quanto tempo por dia?</Text>
      <Text muted>Consistência vale mais que maratona. Você pode mudar depois.</Text>
      <Row wrap gap={10}>
        {[20, 30, 45, 60, 90].map((m) => (
          <PressableScale key={m} onPress={() => setMinutes(m)} accessibilityRole="radio" style={{ flexGrow: 1, minWidth: 92 }}>
            <View style={{ alignItems: "center", padding: 16, borderRadius: 18, borderWidth: 2, borderColor: minutes === m ? c.primary : c.border, backgroundColor: c.surface }}>
              <Text variant="h2" color={minutes === m ? c.primary : c.text}>{m}</Text>
              <Text variant="tiny" muted>min/dia</Text>
            </View>
          </PressableScale>
        ))}
      </Row>
      <Text variant="small" muted>≈ {Math.round((minutes * 90) / 60)} horas em 90 dias de prática.</Text>
    </Stack>,
    // 3 — áreas e dificuldades
    <Stack key="focus" gap={14}>
      <Text variant="h1">Seu contexto</Text>
      <Text variant="label" muted>Áreas profissionais</Text>
      <Row wrap>{DOMAINS.map(([k, l, ic]) => <Chip key={k} icon={ic} label={l} selected={domains.includes(k)} onPress={() => toggle(domains, setDomains, k)} />)}</Row>
      <Text variant="label" muted>Maiores dificuldades</Text>
      <Row wrap>{DIFFICULTIES.map((d) => <Chip key={d} label={d} selected={diffs.includes(d)} onPress={() => toggle(diffs, setDiffs, d)} />)}</Row>
    </Stack>,
    // 4 — nível
    <Stack key="level" gap={12}>
      <Text variant="h1">Como está seu nível hoje?</Text>
      {LEVELS.map(([k, l, d]) => (
        <PressableScale key={k} onPress={() => setLevel(k)} accessibilityRole="radio">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 2,
                         borderColor: level === k ? c.primary : c.border, backgroundColor: c.surface }}>
            <Text variant="h3" color={c.primary} style={{ width: 36 }}>{k}</Text>
            <View style={{ flex: 1 }}>
              <Text weight="700">{l}</Text>
              <Text variant="small" muted>{d}</Text>
            </View>
            {level === k ? <Icon name="checkmark-circle" size={24} color={c.primary} /> : null}
          </View>
        </PressableScale>
      ))}
    </Stack>,
  ];
  const order = en ? [0, 1, 2, 3, 4] : [0, 1, 2, 4];
  const current = steps[order[Math.min(step, order.length - 1)]];
  const isLast = step >= STEPS - 1;

  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <Text variant="small" muted>{me?.display_name ? `Olá, ${me.display_name}! ` : ""}Passo {step + 1} de {STEPS}</Text>
        {step > 0 ? <Button title="Voltar" variant="ghost" size="sm" icon="arrow-back" onPress={() => setStep(step - 1)} /> : null}
      </Row>
      <ProgressBar value={(step + 1) / STEPS} />
      <Animated.View key={step} entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(150)}>
        {current}
      </Animated.View>
      <ErrorText error={error} />
      {!isLast ? <Button title="Continuar" size="lg" icon="arrow-forward" onPress={() => setStep(step + 1)} /> : (
        <Stack gap={10}>
          {en ? (
            <Card tone="accent">
              <Text variant="small">Recomendado: avaliação inicial (~20 min) de listening, vocabulário, gramática, leitura e fala. É uma estimativa interna (CEFR), não uma certificação.</Text>
            </Card>
          ) : null}
          <Button title={en ? "Fazer avaliação inicial" : "Gerar meu plano"} size="lg" icon={en ? "ribbon" : "rocket"}
            onPress={() => save("assess")} loading={loading === "assess"} disabled={!!loading} />
          {en ? <Button title="Pular e gerar o plano agora" variant="ghost" onPress={() => save("plan")} loading={loading === "plan"} disabled={!!loading} /> : null}
        </Stack>
      )}
    </Screen>
  );
}
