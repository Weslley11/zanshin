import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";
import { AnswerBox } from "../../components/AnswerBox";
import { MindMapView, type LeafStatus } from "../../components/MindMapView";
import { Celebration, Enter, PressableScale, ProgressRing } from "../../components/motion";
import { Banner, Button, Card, ErrorText, Icon, Loading, Pill, ProgressBar, Row, Screen, Stack, Text } from "../../components/ui";
import type { IconName } from "../../components/ui";
import { api } from "../../lib/api";
import { tap } from "../../lib/haptics";
import { BRANCH_COLORS, MAP_INTERVALS, matchRecalled, type Leaf, type MapMode, type MindMap } from "../../lib/mindMaps";
import { speak, stopSpeaking } from "../../lib/speech";
import { radius, useTheme } from "../../lib/theme";
import { answerRecall, recallDone, recallRating, startRecall, type Recall, type RecallState } from "../../lib/turbo";
import { prefetchRecorded } from "../../lib/webAudio";

type Step = "pick" | MapMode | "done";

const MODES: { mode: MapMode; icon: IconName; title: string; text: string; tag: string }[] = [
  { mode: "study", icon: "eye", title: "1. Explorar", text: "Veja o mapa, toque nas frases para ouvir e repita em voz alta.", tag: "primeiro contato" },
  { mode: "recall", icon: "bulb", title: "2. Lembrar", text: "As frases somem: veja o português e diga em inglês antes de conferir.", tag: "recuperação ativa" },
  { mode: "rebuild", icon: "git-network", title: "3. Reconstruir", text: "Só com o nome do ramo, diga tudo o que lembrar. Depois confira.", tag: "o que mais fixa" },
];

/** Intercala os ramos (prática intercalada): 1ª frase de cada ramo, depois a 2ª… */
function interleave(m: MindMap): string[] {
  const max = Math.max(...m.branches.map((b) => b.leaves.length));
  const out: string[] = [];
  for (let i = 0; i < max; i++) for (const b of m.branches) if (b.leaves[i]) out.push(b.leaves[i].id);
  return out;
}

export default function MapPlayer() {
  const { id, mode: startMode, planDay, planActivity } = useLocalSearchParams<{ id: string; mode?: string; planDay?: string; planActivity?: string }>();
  const navigation = useNavigation();
  const { c } = useTheme();
  const [map, setMap] = useState<MindMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [focus, setFocus] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<MapMode>("study");
  // Lembrar
  const [rec, setRec] = useState<RecallState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  // Reconstruir
  const [bi, setBi] = useState(0);
  const [said, setSaid] = useState("");
  const [checked, setChecked] = useState<Set<string> | null>(null);
  const [rebuilt, setRebuilt] = useState<Record<string, boolean>>({});
  // Resultado
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    api<MindMap>(`/maps/${id}`).then((m) => {
      setMap(m);
      navigation.setOptions({ title: m.title_pt });
      prefetchRecorded(m.branches.flatMap((b) => b.leaves.map((l) => l.en)));
    }).catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, [id]);

  // Vindo do plano como "Reconstruir de memória": vai direto para a reconstrução (revisão espaçada do mapa).
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (map && startMode === "rebuild" && !autoStarted) {
      setAutoStarted(true);
      begin("rebuild");
    }
  }, [map]);

  if (!map) return <Screen><ErrorText error={error} />{!error ? <Loading /> : null}</Screen>;
  const leaves = map.branches.flatMap((b) => b.leaves);
  const leafById: Record<string, Leaf> = Object.fromEntries(leaves.map((l) => [l.id, l]));
  const branchOf = (leafId: string) => map.branches.findIndex((b) => b.leaves.some((l) => l.id === leafId));
  const say = (t: string, rate = 0.95) => speak(t, { language: "en", accent: "US", rate });

  const status: Record<string, LeafStatus> = {};
  if (rec) for (const [k, v] of Object.entries(rec.attempts)) {
    const r = recallRating(v);
    status[k] = r === 3 ? "ok" : r === 2 ? "almost" : "miss";
  }
  for (const [k, v] of Object.entries(rebuilt)) status[k] = v ? "ok" : "miss";

  const begin = (mode: MapMode) => {
    tap();
    startedAt.current = Date.now();
    setLastMode(mode);
    setResult(null);
    setFocus(null);
    if (mode === "recall") {
      setRec(startRecall(interleave(map)));
      setRevealed(false);
      setTyped(null);
    }
    if (mode === "rebuild") {
      setRec(null);
      setBi(0);
      setSaid("");
      setChecked(null);
      setRebuilt({});
      setFocus(map.branches[0].id);
    }
    setStep(mode);
  };

  const save = async (mode: MapMode, results: { leaf_id: string; rating: number }[]) => {
    setStep("done");
    setSaving(true);
    try {
      setResult(await api(`/maps/${map.id}/complete`, { body: { mode, results, duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
        ...(planDay && planActivity ? { plan_day: Number(planDay), plan_activity_id: planActivity } : {}) } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------- escolher modo -------------------------------
  if (step === "pick") {
    return (
      <Screen>
        <MindMapView map={map} />
        <Text variant="small" muted center>{map.branches.length} ramos · {leaves.length} frases</Text>
        <Stack gap={10}>
          {MODES.map((m, k) => (
            <Enter key={m.mode} index={k}>
              <Card onPress={() => begin(m.mode)} accessibilityLabel={m.title} style={{ gap: 4 }}>
                <Row gap={12}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.primarySoft }}>
                    <Icon name={m.icon} size={22} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row gap={8} wrap><Text weight="800">{m.title}</Text><Pill label={m.tag} /></Row>
                    <Text variant="small" muted>{m.text}</Text>
                  </View>
                  <Icon name="chevron-forward" size={20} color={c.textMuted} />
                </Row>
              </Card>
            </Enter>
          ))}
        </Stack>
        <Banner icon="bulb">Faça na ordem na primeira vez. Nos dias seguintes, vá direto para Reconstruir — é a revisão que mais fixa.</Banner>
      </Screen>
    );
  }

  // ------------------------------- Explorar -------------------------------
  if (step === "study") {
    const shown = focus ? map.branches.filter((b) => b.id === focus) : map.branches;
    return (
      <Screen>
        <MindMapView map={map} focus={focus} onBranch={(b) => { tap(); setFocus(focus === b ? null : b); }} />
        <Text variant="small" muted center>Toque num ramo para focar nele. Toque numa frase para ouvir.</Text>
        {shown.map((b) => {
          const k = map.branches.indexOf(b);
          const color = BRANCH_COLORS[k % BRANCH_COLORS.length];
          return (
            <Card key={b.id} style={{ gap: 8, borderLeftWidth: 5, borderLeftColor: color }}>
              <Row gap={8}><Icon name={b.icon as IconName} size={18} color={color} /><Text weight="800">{b.en}</Text><Text variant="small" muted>· {b.pt}</Text></Row>
              {b.leaves.map((l) => (
                <PressableScale key={l.id} onPress={() => say(l.en, 0.9)} accessibilityLabel={`Ouvir: ${l.en}`}>
                  <Row gap={10} style={{ paddingVertical: 6 }}>
                    <Icon name="volume-high" size={18} color={color} />
                    <View style={{ flex: 1 }}>
                      <Text weight="700">{l.en}</Text>
                      <Text variant="small" muted>{l.pt}</Text>
                    </View>
                  </Row>
                </PressableScale>
              ))}
            </Card>
          );
        })}
        <Button title="Já repeti — agora tentar lembrar" size="lg" icon="bulb" onPress={() => begin("recall")} />
        <Button title="Voltar aos modos" variant="ghost" icon="arrow-back" onPress={() => setStep("pick")} />
      </Screen>
    );
  }

  // ------------------------------- Lembrar -------------------------------
  if (step === "recall" && rec) {
    if (recallDone(rec)) {
      const results = leaves.map((l) => ({ leaf_id: l.id, rating: recallRating(rec.attempts[l.id]) }));
      return (
        <Screen>
          <MindMapView map={map} status={status} />
          <Banner tone="success" icon="checkmark-circle" title="Rodada concluída">Agora salve para as frases entrarem na revisão espaçada — ou vá direto para a reconstrução.</Banner>
          <Button title="Salvar e ver resultado" size="lg" icon="save" onPress={() => save("recall", results)} />
        </Screen>
      );
    }
    const leaf = leafById[rec.queue[rec.pos]];
    const k = branchOf(leaf.id);
    const b = map.branches[k];
    const color = BRANCH_COLORS[k % BRANCH_COLORS.length];
    const doneCount = Object.keys(rec.attempts).length;
    const reveal = () => { setRevealed(true); say(leaf.en); };
    const answer = (r: Recall) => {
      tap(r === "ok" ? "success" : "warning");
      setRec(answerRecall(rec, r));
      setRevealed(false);
      setTyped(null);
    };
    const suggested: Recall | null = typed == null ? null : matchRecalled(typed, [leaf]).size ? "ok" : "miss";
    return (
      <Screen scrollKey={`r-${rec.pos}`}>
        <ProgressBar value={rec.pos / rec.queue.length} gradient="maps" />
        <Text variant="label" muted>Lembrar · {doneCount}/{leaves.length} frases vistas</Text>
        <Animated.View key={`${leaf.id}-${rec.pos}`} entering={FadeInRight.springify().damping(18)}>
          <Card style={{ gap: 10, borderWidth: 2, borderColor: color }}>
            <Row gap={8}>
              <Icon name={b.icon as IconName} size={16} color={color} />
              <Text variant="small" weight="800" color={color}>{map.center_en} → {b.en}</Text>
            </Row>
            <Text variant="h3">{leaf.pt}</Text>
            {revealed ? (
              <Stack gap={6}>
                <Text variant="h2" color={color}>{leaf.en}</Text>
                {typed ? <Text variant="small" muted>Você: “{typed}”</Text> : null}
                <Button title="Ouvir de novo" icon="volume-high" size="sm" variant="secondary" onPress={() => say(leaf.en, 0.85)} />
              </Stack>
            ) : <Text variant="small" muted>Diga em inglês, em voz alta (ou use o microfone/teclado abaixo).</Text>}
          </Card>
        </Animated.View>
        {!revealed ? (
          <>
            <AnswerBox placeholder="Fale ou digite a frase em inglês" onSubmit={(t) => { setTyped(t); reveal(); }} />
            <Button title="Mostrar resposta" variant="secondary" icon="eye" onPress={reveal} />
          </>
        ) : (
          <Stack gap={8}>
            <Text variant="small" muted center>Seja honesto: isso decide quando a frase volta.</Text>
            <Row gap={8}>
              {([["miss", "Não lembrei", "close-circle", c.danger], ["almost", "Quase", "remove-circle", "#D99A00"], ["ok", "Lembrei", "checkmark-circle", c.success]] as const).map(([r, label, icon, col]) => (
                <PressableScale key={r} onPress={() => answer(r)} accessibilityLabel={label} style={{ flex: 1 }}>
                  <View style={{ alignItems: "center", gap: 4, paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderBottomWidth: 4,
                                 borderColor: suggested === r ? col : c.border, backgroundColor: c.card }}>
                    <Icon name={icon} size={26} color={col} />
                    <Text variant="small" weight="800">{label}</Text>
                  </View>
                </PressableScale>
              ))}
            </Row>
          </Stack>
        )}
      </Screen>
    );
  }

  // ------------------------------- Reconstruir -------------------------------
  if (step === "rebuild") {
    const b = map.branches[bi];
    const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
    const check = () => { tap(); setChecked(matchRecalled(said, b.leaves)); };
    const toggle = (lid: string) => {
      if (!checked) return;
      tap();
      const n = new Set(checked);
      if (n.has(lid)) n.delete(lid); else n.add(lid);
      setChecked(n);
    };
    const nextBranch = () => {
      const upd = { ...rebuilt, ...Object.fromEntries(b.leaves.map((l) => [l.id, !!checked?.has(l.id)])) };
      setRebuilt(upd);
      setSaid("");
      setChecked(null);
      if (bi + 1 < map.branches.length) {
        setBi(bi + 1);
        setFocus(map.branches[bi + 1].id);
      } else {
        setFocus(null);
        save("rebuild", leaves.map((l) => ({ leaf_id: l.id, rating: upd[l.id] ? 3 : 1 })));
      }
    };
    return (
      <Screen scrollKey={`b-${bi}-${checked ? 1 : 0}`}>
        <ProgressBar value={(bi + (checked ? 0.5 : 0)) / map.branches.length} gradient="maps" />
        <MindMapView map={map} focus={b.id} status={status} />
        <Card style={{ gap: 8, borderWidth: 2, borderColor: color }}>
          <Text variant="label" muted>Ramo {bi + 1} de {map.branches.length}</Text>
          <Row gap={8}><Icon name={b.icon as IconName} size={20} color={color} /><Text variant="h3">{b.en}</Text></Row>
          <Text variant="small" muted>{b.pt} · {b.leaves.length} frases escondidas</Text>
          {!checked ? <Text variant="small">Diga (ou escreva) todas as frases deste ramo que você lembrar, uma depois da outra. Vale aproximado.</Text> : null}
        </Card>
        {!checked ? (
          <>
            {said ? <Card tone="accent"><Text variant="small">Você disse: “{said}”</Text></Card> : null}
            <AnswerBox placeholder="Fale ou digite o que lembrar" onSubmit={(t) => setSaid((s) => (s ? `${s}. ${t}` : t))} />
            <Button title={said ? "Conferir" : "Não lembro nenhuma — mostrar"} size="lg" icon="checkmark-done" onPress={check} />
          </>
        ) : (
          <Stack gap={8}>
            <Text variant="small" muted>Confira. Se o app errou na correção, toque na frase para marcar/desmarcar.</Text>
            {b.leaves.map((l) => {
              const ok = checked.has(l.id);
              return (
                <PressableScale key={l.id} onPress={() => toggle(l.id)} accessibilityLabel={`${ok ? "Lembrei" : "Não lembrei"}: ${l.en}`}>
                  <Card style={{ gap: 4, borderWidth: 2, borderColor: ok ? c.success : c.danger }}>
                    <Row gap={10}>
                      <Icon name={ok ? "checkmark-circle" : "close-circle"} size={22} color={ok ? c.success : c.danger} />
                      <View style={{ flex: 1 }}>
                        <Text weight="700">{l.en}</Text>
                        <Text variant="small" muted>{l.pt}</Text>
                      </View>
                      <PressableScale onPress={() => say(l.en, 0.9)} accessibilityLabel={`Ouvir: ${l.en}`}>
                        <Icon name="volume-high" size={22} color={color} />
                      </PressableScale>
                    </Row>
                  </Card>
                </PressableScale>
              );
            })}
            <Button title={bi + 1 < map.branches.length ? "Próximo ramo" : "Concluir mapa"} size="lg" icon="arrow-forward" onPress={nextBranch} />
          </Stack>
        )}
      </Screen>
    );
  }

  // ------------------------------- Resultado -------------------------------
  const score = result?.score ?? 0;
  const mm = result?.overview?.maps?.find((x: any) => x.id === map.id);
  const nextGap = mm ? MAP_INTERVALS[Math.min(mm.sessions, MAP_INTERVALS.length) - 1] : 1;
  return (
    <Screen scrollKey="done" overlay={<Celebration show={!saving && !!result && score >= 0.7} />}>
      {saving ? <Loading /> : null}
      <ErrorText error={error} />
      {result ? (
        <>
          <Enter>
            <Card style={{ alignItems: "center", gap: 8 }}>
              <Text variant="label" muted>{lastMode === "rebuild" ? "Reconstrução" : "Lembrar"} concluído</Text>
              <ProgressRing value={score} size={116}>
                <Text variant="h1">{Math.round(score * 100)}%</Text>
              </ProgressRing>
              <Text variant="small" muted center>frases lembradas de primeira</Text>
            </Card>
          </Enter>
          <MindMapView map={map} status={status} />
          <Banner tone="success" icon="albums" title="Na sua revisão espaçada">
            {`${result.reviewed} frases agendadas (${result.added} novas). As que você não lembrou voltam antes.`}
          </Banner>
          <Banner icon="calendar" title={`Reconstrua este mapa de novo em ${nextGap} dia${nextGap > 1 ? "s" : ""}`}>
            Espaçar (1, 3, 7, 14, 30 dias) fixa mais do que repetir hoje. O app avisa na lista de mapas.
          </Banner>
          <Stack gap={10}>
            {lastMode === "recall" ? <Button title="Agora reconstruir de memória" size="lg" icon="git-network" onPress={() => begin("rebuild")} /> : null}
            {lastMode === "rebuild" && score < 0.7 ? <Button title="Treinar as que faltaram (Lembrar)" size="lg" icon="bulb" onPress={() => begin("recall")} /> : null}
            <Button title="Todos os mapas" variant="secondary" icon="git-network" onPress={() => router.replace("/mapas")} />
          </Stack>
        </>
      ) : null}
    </Screen>
  );
}
