import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Card, Chip, ErrorText, Loading, ModuleHero, Row, Screen, Text } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../lib/app";
import { ACCENT_LABELS } from "../lib/speech";

const CATS: [string | null, string][] = [[null, "Todos"], ["country:IN", "🇮🇳 Índia"], ["airport", "Aeroporto"], ["hotel", "Hotel"], ["restaurant", "Restaurante"],
  ["transport", "Transporte"], ["work", "Trabalho"], ["networking", "Networking"]];

export default function Scenarios() {
  const { country } = useLocalSearchParams<{ country?: string }>();
  const { profile } = useApp();
  const [items, setItems] = useState<any[] | null>(null);
  const [cat, setCat] = useState<string | null>(country || profile?.trip_destination === "IN" ? "country:IN" : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api("/scenarios").then(setItems).catch((e) => setError(e.message)); }, []);
  return (
    <Screen>
      <ModuleHero title="Simulações" icon="airplane" gradient="scenarios"
        subtitle="Personagens com sotaques, velocidades e estilos diferentes — e sempre uma situação inesperada." />
      <Row wrap>{CATS.map(([k, l]) => <Chip key={l} label={l} selected={cat === k} onPress={() => setCat(k)} />)}</Row>
      <ErrorText error={error} />
      {!items && !error ? <Loading /> : null}
      {items?.filter((s) => !cat || (cat.startsWith("country:") ? s.country === cat.slice(8) : s.category === cat)).map((s, i) => (
        <Card key={s.id} index={i} style={{ gap: 4 }} onPress={() => router.push({ pathname: "/tutor/new", params: { mode: "scenario", scenario: s.id } })}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text weight="700">{s.title_pt}</Text>
            <Text variant="tiny" muted>{s.level} · ~{s.minutes} min</Text>
          </Row>
          <Text variant="small" muted>
            {s.characters.map((c: any) => `${c.name} (${ACCENT_LABELS[c.accent] ?? c.accent}, ${c.speed === "fast" ? "rápido" : "normal"})`).join(" · ")}
          </Text>
          <Text variant="small">Objetivos: {s.goals.map((g: any) => g.pt).join("; ")}</Text>
        </Card>
      ))}
    </Screen>
  );
}
