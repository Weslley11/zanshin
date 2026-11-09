import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorText, Loading, Screen, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";

/** Cria a sessão imediatamente (poucas etapas para começar a falar) e abre a conversa. */
export default function NewSession() {
  const p = useLocalSearchParams<{ mode?: string; scenario?: string; minutes?: string; planDay?: string; planActivity?: string }>();
  const { language, profile } = useApp();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const start = async () => {
    setError(null);
    try {
      const mode = p.mode ?? "natural";
      const s = await api("/tutor/sessions", {
        body: {
          language,
          mode,
          scenario_id: mode === "scenario" ? p.scenario : undefined,
          settings: {
            speed: "normal",
            accent: profile?.preferred_accents?.[0] ?? undefined,
            challenge_minutes: p.minutes ? Number(p.minutes) : undefined,
            plan_day: p.planDay ? Number(p.planDay) : undefined,
            plan_activity_id: p.planActivity || undefined,
          },
        },
      });
      router.replace({ pathname: "/tutor/[id]", params: { id: s.id } });
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      if (p.mode === "scenario" && !p.scenario) router.replace("/scenarios");
      else start();
    }
  });

  return (
    <Screen>
      {!error ? <Loading label="Preparando seu parceiro de conversa…" /> : (
        <>
          <Text variant="h3">Não foi possível iniciar</Text>
          <ErrorText error={error} />
          {/consent|consentir/i.test(error) ? <Button title="Abrir privacidade" onPress={() => router.push("/privacy")} /> : null}
          <Button title="Tentar novamente" onPress={start} />
        </>
      )}
    </Screen>
  );
}
