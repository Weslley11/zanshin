import { router, useFocusEffect } from "expo-router";
import { useCallback, useContext, useState } from "react";
import { Platform, Switch } from "react-native";
import { Button, Card, Chip, Divider, ErrorText, Row, Screen, Segmented, Stack, Text } from "../../components/ui";
import { AUDIO_TIPS, soundTest } from "../../components/AudioHelp";
import { ThemePicker } from "../../components/ThemePicker";
import { speak } from "../../lib/speech";
import { englishVoices } from "../../lib/webSpeech";
import { api, LOCAL_MODE } from "../../lib/api";
import { useApp } from "../../lib/app";
import { ThemeModeContext, useTheme, type ThemeMode } from "../../lib/theme";

const LANGS: [string, string][] = [["en", "Inglês"], ["es", "Espanhol"], ["it", "Italiano"], ["zh", "Mandarim"], ["ja", "Japonês"]];

export default function Profile() {
  const { me, caps, profile, refreshMe, signOut, serverVoicePref, setServerVoicePref } = useApp();
  const { mode, setMode } = useContext(ThemeModeContext);
  const { c } = useTheme();
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { api("/me/usage").then(setUsage).catch(() => {}); }, []));

  const switchLanguage = async (code: string) => {
    try {
      await api("/me", { method: "PATCH", body: { active_language: code } });
      await refreshMe();
      if (!me?.profiles.find((p) => p.language === code)) router.push("/onboarding");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Screen>
      <Text variant="h2">{me?.display_name || "Perfil"}</Text>
      {!LOCAL_MODE ? <Text muted variant="small">{me?.email}</Text> : <Text muted variant="small">Dados salvos neste aparelho</Text>}

      <Card style={{ gap: 10 }}>
        <Text variant="label" muted>Idioma ativo</Text>
        <Row wrap>{LANGS.map(([k, l]) => <Chip key={k} label={l} selected={me?.active_language === k} onPress={() => switchLanguage(k)} />)}</Row>
        {profile ? (
          <Text variant="small" muted>
            Meta diária: {profile.daily_minutes} min{profile.trip_date ? ` · viagem: ${new Date(profile.trip_date + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}
          </Text>
        ) : null}
        <Button title="Ajustar metas e plano" variant="secondary" size="sm" onPress={() => router.push("/onboarding")} />
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="label" muted>Som e voz</Text>
        <Button title="Testar som" icon="volume-high" variant="secondary" onPress={soundTest} />
        <Button title="Testar sotaque indiano" icon="earth" variant="ghost" size="sm"
          onPress={() => speak("Kindly revert by end of day. We will do the needful.", { language: "en", accent: "IN", rate: 0.95 })} />
        <Text variant="small" muted>Não ouviu nada?</Text>
        {AUDIO_TIPS.map((t) => <Text key={t} variant="small">• {t}</Text>)}
        {Platform.OS === "web" ? (
          <Text variant="tiny" muted>
            Vozes em inglês neste aparelho: {englishVoices().length ? `${englishVoices().length} (${englishVoices().some((v) => v.lang.replace("_", "-").toLowerCase() === "en-in") ? "inclui Índia" : "sem voz da Índia"})` : "nenhuma encontrada ainda"}
          </Text>
        ) : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text variant="label" muted>Tema e animações</Text>
        <ThemePicker />
      </Card>

      <Card style={{ gap: 8 }}>
        <Text variant="label" muted>{LOCAL_MODE ? "Modo local (grátis, offline)" : "O que está ativo neste servidor"}</Text>
        <Text variant="small">Tutor: {caps?.llm.generative ? `IA generativa (${caps.llm.provider})` : "modo offline (roteiros e regras)"}</Text>
        <Text variant="small">Voz → texto: {caps?.stt.available ? `servidor (${caps.stt.provider})` : "reconhecimento do navegador/teclado"}</Text>
        <Text variant="small">Texto → voz: {caps?.tts.server_available ? `vozes neurais (${caps.tts.provider})` : "voz do dispositivo"}</Text>
        <Text variant="small">Pronúncia: {caps?.pronunciation_assessment.available ? "notas por fonema (Azure)" : "inteligibilidade por transcrição"}</Text>
        {caps?.tts.server_available ? (
          <Row style={{ justifyContent: "space-between" }}>
            <Text variant="small">Usar vozes do servidor (sotaques)</Text>
            <Switch value={serverVoicePref} onValueChange={setServerVoicePref} trackColor={{ true: c.primary, false: c.surfaceAlt }} />
          </Row>
        ) : null}
        {usage ? (
          <>
            <Divider />
            <Text variant="small" muted>
              Uso de IA hoje: {Math.round(usage.llm_tokens.used).toLocaleString("pt-BR")} / {usage.llm_tokens.limit.toLocaleString("pt-BR")} tokens ·
              voz: {Math.round(usage.stt_seconds.used / 60)} / {Math.round(usage.stt_seconds.limit / 60)} min
            </Text>
          </>
        ) : null}
      </Card>

      <Stack gap={10}>
        <Button title={LOCAL_MODE ? "Backup, privacidade e dados" : "Privacidade e dados"} icon="shield-checkmark" variant="secondary" onPress={() => router.push("/privacy")} />
        <Button title="Seu progresso" icon="stats-chart" variant="secondary" onPress={() => router.push("/progress")} />
        <Button title="Jornada de 90 dias" icon="map" variant="secondary" onPress={() => router.push("/plan")} />
        <ErrorText error={error} />
        {!LOCAL_MODE ? <Button title="Sair" variant="ghost" icon="log-out" onPress={async () => { await signOut(); router.replace("/"); }} /> : null}
      </Stack>
    </Screen>
  );
}
