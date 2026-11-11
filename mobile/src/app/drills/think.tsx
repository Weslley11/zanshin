import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card, ErrorText, Loading, ModuleHero, ProgressBar, Screen, Stack, Text } from "../../components/ui";
import { api } from "../../lib/api";
import { useApp } from "../../lib/app";
import { useTheme } from "../../lib/theme";

const TYPE_PT: Record<string, string> = {
  describe_scene: "Descrever", circumlocution: "Explicar sem a palavra", self_talk: "Falar consigo mesmo",
  chain: "Resposta em cadeia", rephrase: "Reformular",
};

/** Think in English: produção oral cronometrada, sem tradução. Fale em voz alta; o objetivo é não parar. */
export default function ThinkInEnglish() {
  const { planDay, planActivity } = useLocalSearchParams<{ planDay?: string; planActivity?: string }>();
  const { language, profile } = useApp();
  const { c } = useTheme();
  const [items, setItems] = useState<any[] | null>(null);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useRef(Date.now());

  useEffect(() => {
    api("/drills/think-in-english").then((all: any[]) => {
      const lvl = profile?.cefr_estimate ?? "B1";
      const order = ["A2", "B1", "B2", "C1"];
      setItems(all.filter((x) => Math.abs(order.indexOf(x.level) - order.indexOf(lvl)) <= 1));
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (left == null || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const it = items?.[i];
  const finish = async () => {
    await api("/activities", { body: {
      language, activity_type: "think_in_english", duration_seconds: Math.round((Date.now() - start.current) / 1000),
      plan_day: planDay ? Number(planDay) : undefined, plan_activity_id: planActivity,
    } }).catch(() => {});
    router.back();
  };

  if (!items) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  if (!it) {
    return (
      <Screen>
        <Banner tone="success" title="Bom treino!">Quanto mais você fala sem traduzir, mais rápido o inglês “vem” na hora da conversa.</Banner>
        <Button title="Concluir" onPress={finish} />
        <Button title="Conversar com o tutor agora" variant="secondary" onPress={() => router.replace({ pathname: "/tutor/new", params: { mode: "no_native" } })} />
      </Screen>
    );
  }
  return (
    <Screen>
      <ModuleHero title="Think in English" icon="bulb" gradient="assessment" subtitle="Fale em voz alta, sem parar e sem traduzir." />
      <Text variant="label" muted>{TYPE_PT[it.type] ?? it.type} · {i + 1}/{items.length}</Text>
      <Card style={{ gap: 10 }}>
        <Text variant="h3">{it.prompt}</Text>
        {left != null ? (
          <Stack gap={6}>
            <Text variant="h1" color={left > 0 ? c.primary : c.success}>{left > 0 ? `${left} s` : "Tempo!"}</Text>
            <ProgressBar value={left / it.seconds} />
          </Stack>
        ) : null}
      </Card>
      <Card tone="accent">
        <Text variant="small">
          Regras: fale em voz alta, sem parar e sem traduzir. Se faltar uma palavra, explique de outro jeito (“It's a kind of…”, “the thing you use to…”).
          Erros são parte do treino.
        </Text>
      </Card>
      {left == null ? <Button title={`Começar (${it.seconds} s)`} size="lg" onPress={() => setLeft(it.seconds)} /> : (
        <Button title="Próximo" size="lg" onPress={() => { setLeft(null); setI(i + 1); }} />
      )}
    </Screen>
  );
}
