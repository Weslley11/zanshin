import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Card, Chip, ErrorText, Loading, Row, Screen, Text } from "../../components/ui";
import { useApp } from "../../lib/app";
import { api } from "../../lib/api";
import { ACCENT_LABELS } from "../../lib/speech";

export default function ListeningList() {
  const params = useLocalSearchParams<{ planDay?: string; planActivity?: string; accent?: string }>();
  const { profile } = useApp();
  const [accent, setAccent] = useState<string | null>(params.accent ?? (profile?.trip_destination === "IN" ? "IN" : null));
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api("/listening?language=en").then(setItems).catch((e) => setError(e.message)); }, []);
  return (
    <Screen>
      <Text variant="h2">Listening</Text>
      <Text muted variant="small">Diálogos reais de viagem e trabalho com sotaques diferentes. Ouça primeiro sem ler; a transcrição aparece depois das respostas.</Text>
      <Row wrap>
        {[[null, "Todos"], ["IN", "🇮🇳 Falantes indianos"], ["US", "EUA"], ["UK", "Reino Unido"], ["AU", "Austrália"]].map(([k, l]) => (
          <Chip key={l} label={l as string} selected={accent === k} onPress={() => setAccent(k)} />
        ))}
      </Row>
      <ErrorText error={error} />
      {!items && !error ? <Loading /> : null}
      {items?.filter((x) => !accent || x.accents.includes(accent)).map((x) => (
        <Card key={x.id} onPress={() => router.push({ pathname: "/listening/[id]", params: { id: x.id, ...params } })} style={{ gap: 4 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Text weight="700">{x.title}</Text>
            <Text variant="tiny" muted>{x.level}</Text>
          </Row>
          <Text variant="small" muted>{x.accents.map((a: string) => ACCENT_LABELS[a] ?? a).join(" · ")} · fase {x.phase}</Text>
        </Card>
      ))}
    </Screen>
  );
}
