import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Card, ErrorText, Loading, Row, Screen, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { ACCENT_LABELS } from "../../lib/speech";

export default function ListeningList() {
  const params = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api("/listening?language=en").then(setItems).catch((e) => setError(e.message)); }, []);
  return (
    <Screen>
      <Text variant="h2">Listening</Text>
      <Text muted variant="small">Diálogos reais de viagem e trabalho com sotaques diferentes. Ouça primeiro sem ler; a transcrição aparece depois das respostas.</Text>
      <ErrorText error={error} />
      {!items && !error ? <Loading /> : null}
      {items?.map((x) => (
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
