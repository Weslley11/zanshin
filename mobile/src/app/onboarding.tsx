import { router } from "expo-router";
import { useState } from "react";
import { Button, Card, Chip, ErrorText, Field, Row, Screen, Stack, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";

const LANGS = [
  { code: "en", label: "Inglês", note: "Programa completo (MVP)" },
  { code: "es", label: "Espanhol", note: "Trilha inicial" },
  { code: "it", label: "Italiano", note: "Trilha inicial" },
  { code: "zh", label: "Mandarim", note: "Trilha inicial" },
  { code: "ja", label: "Japonês", note: "Trilha inicial" },
];
const DOMAINS = [
  ["engineering", "Engenharia mecânica/elétrica"], ["software", "Software"], ["automation", "Automação industrial"],
  ["corporate", "Gestão de projetos"], ["travel", "Viagens"], ["networking", "Networking"],
];
const DIFFICULTIES = ["Entender quem fala rápido", "Responder sem traduzir", "Pronúncia", "Vocabulário técnico", "Gramática ao falar", "Timidez / confiança"];
const DESTINATIONS: [string | null, string][] = [["IN", "🇮🇳 Índia"], ["US", "EUA"], ["GB", "Reino Unido"], ["AU", "Austrália"], [null, "Outro / não sei"]];
const LEVELS = [["A2", "Básico"], ["B1", "Intermediário"], ["B2", "Intermediário superior"], ["C1", "Avançado"]];

function isoInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function Onboarding() {
  const { refreshMe, me, profile } = useApp();
  const [language, setLanguage] = useState(profile?.language ?? "en");
  const [minutes, setMinutes] = useState(profile?.daily_minutes ?? 45);
  const [trip, setTrip] = useState(profile?.trip_date ?? isoInDays(90));
  const [destination, setDestination] = useState<string | null>(profile?.trip_destination ?? null);
  const [domains, setDomains] = useState<string[]>(profile?.focus_domains ?? ["engineering", "travel"]);
  const [diffs, setDiffs] = useState<string[]>(profile?.difficulties ?? ["Entender quem fala rápido", "Responder sem traduzir"]);
  const [level, setLevel] = useState(profile?.cefr_estimate ?? "B1");
  const [goal, setGoal] = useState(profile?.goals?.[0] ?? "Viagem internacional a trabalho");
  const [loading, setLoading] = useState<"assess" | "plan" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (next: "assess" | "plan") => {
    setLoading(next);
    setError(null);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trip)) throw new Error("Data da viagem no formato AAAA-MM-DD.");
      await api(`/me/profiles/${language}`, {
        method: "PUT",
        body: { daily_minutes: minutes, goals: [goal], focus_domains: domains, difficulties: diffs, trip_date: trip,
                self_level: level, trip_destination: language === "en" ? destination : null,
                preferred_accents: destination ? [] : ["US", "UK"] },
      });
      await refreshMe();
      if (next === "assess" && language === "en") {
        router.replace({ pathname: "/assessment", params: { kind: "placement", thenPlan: "1" } });
      } else {
        await api("/plans", { body: { language } });
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen>
      <Text variant="h2">Olá{me?.display_name ? `, ${me.display_name}` : ""}! Vamos montar seu plano.</Text>
      <Text muted>Leva 1 minuto. Você pode ajustar tudo depois.</Text>

      <Stack gap={8}>
        <Text variant="label" muted>Idioma</Text>
        <Row wrap>{LANGS.map((l) => <Chip key={l.code} label={l.label} selected={language === l.code} onPress={() => setLanguage(l.code)} />)}</Row>
        <Text variant="small" muted>{LANGS.find((l) => l.code === language)?.note}</Text>
      </Stack>

      <Field label="Seu objetivo principal" value={goal} onChangeText={setGoal} autoCapitalize="sentences" />

      <Stack gap={8}>
        <Text variant="label" muted>Tempo por dia</Text>
        <Row wrap>{[20, 30, 45, 60, 90].map((m) => <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />)}</Row>
      </Stack>

      <Stack gap={8}>
        <Text variant="label" muted>Data da viagem</Text>
        <Row wrap>{[60, 75, 90, 120].map((d) => <Chip key={d} label={`em ${d} dias`} selected={trip === isoInDays(d)} onPress={() => setTrip(isoInDays(d))} />)}</Row>
        <Field value={trip} onChangeText={setTrip} placeholder="AAAA-MM-DD" />
      </Stack>

      {language === "en" ? (
        <Stack gap={8}>
          <Text variant="label" muted>Para onde você vai?</Text>
          <Row wrap>{DESTINATIONS.map(([k, l]) => <Chip key={l} label={l} selected={destination === k} onPress={() => setDestination(k)} />)}</Row>
          {destination === "IN" ? (
            <Text variant="small" muted>O plano vai priorizar entender o inglês indiano: sotaque, ritmo, expressões e números em lakh/crore.</Text>
          ) : null}
        </Stack>
      ) : null}

      <Stack gap={8}>
        <Text variant="label" muted>Áreas profissionais</Text>
        <Row wrap>{DOMAINS.map(([k, l]) => <Chip key={k} label={l} selected={domains.includes(k)} onPress={() => toggle(domains, setDomains, k)} />)}</Row>
      </Stack>

      <Stack gap={8}>
        <Text variant="label" muted>Maiores dificuldades</Text>
        <Row wrap>{DIFFICULTIES.map((d) => <Chip key={d} label={d} selected={diffs.includes(d)} onPress={() => toggle(diffs, setDiffs, d)} />)}</Row>
      </Stack>

      <Stack gap={8}>
        <Text variant="label" muted>Como você avalia seu nível hoje?</Text>
        <Row wrap>{LEVELS.map(([k, l]) => <Chip key={k} label={`${k} · ${l}`} selected={level === k} onPress={() => setLevel(k)} />)}</Row>
      </Stack>

      <Card tone="accent">
        <Text variant="small">
          Recomendamos a avaliação inicial (~20 min): ela mede listening, vocabulário, gramática em contexto, leitura e fala,
          e ajusta o plano às suas necessidades. É uma estimativa interna baseada no CEFR — não uma certificação.
        </Text>
      </Card>
      <ErrorText error={error} />
      <Button title={language === "en" ? "Fazer avaliação inicial" : "Gerar meu plano"} size="lg"
        onPress={() => save("assess")} loading={loading === "assess"} disabled={!!loading} />
      {language === "en" ? (
        <Button title="Pular e gerar o plano agora" variant="ghost" onPress={() => save("plan")} loading={loading === "plan"} disabled={!!loading} />
      ) : null}
    </Screen>
  );
}
