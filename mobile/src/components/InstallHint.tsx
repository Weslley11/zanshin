import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { dismissInstallHint, installHintDismissed, installState, onInstallAvailable, promptInstall, type InstallState } from "../lib/pwa";
import { useTheme } from "../lib/theme";
import { Button, Card, Icon, Row, Text } from "./ui";

/** Ensina a instalar o app na tela de início (PWA). Some quando já está instalado ou se a pessoa dispensar. */
export function InstallHint({ variant = "home" }: { variant?: "home" | "welcome" }) {
  const { c } = useTheme();
  const [state, setState] = useState<InstallState>(() => installState());
  const [hidden, setHidden] = useState(() => installHintDismissed());

  useEffect(() => onInstallAvailable(() => setState(installState())), []);

  if (hidden || state === "standalone" || state === "other") return null;
  const close = () => { dismissInstallHint(); setHidden(true); };

  return (
    <Card style={{ gap: 10, borderColor: c.primary, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Row gap={10} style={{ flex: 1 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="phone-portrait" size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="800">{variant === "welcome" ? "Dica: instale antes de começar" : "Instale na tela de início"}</Text>
            <Text variant="small" muted>
              {variant === "welcome"
                ? "Abre em tela cheia e funciona offline. No iPhone, o app instalado guarda o progresso separado do Safari — instalando agora, nada se perde."
                : "Abre em tela cheia, como um app, e funciona sem internet. Já tem progresso aqui? Exporte um backup em Perfil e importe no app instalado."}
            </Text>
          </View>
        </Row>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Dispensar" hitSlop={10}>
          <Icon name="close" size={20} color={c.textMuted} />
        </Pressable>
      </Row>
      {variant === "welcome" && state !== "promptable" ? (
        <Text variant="small" weight="700" color={c.primary}>
          {state === "ios-safari" ? "Compartilhar" : "Menu Compartilhar"} <Icon name="share-outline" size={14} color={c.primary} /> → Adicionar à Tela de Início
        </Text>
      ) : state === "promptable" ? (
        <Button title="Instalar app" icon="download" onPress={async () => { if (await promptInstall()) close(); }} />
      ) : (
        <View style={{ gap: 6 }}>
          <Row gap={8}><Text weight="800" color={c.primary}>1</Text><Text variant="small" style={{ flex: 1 }}>
            {state === "ios-safari" ? "Toque em Compartilhar" : "Abra o menu Compartilhar do navegador"} <Icon name="share-outline" size={15} color={c.primary} /> {state === "ios-safari" ? "(na barra do Safari)" : "(ou abra este endereço no Safari)"}
          </Text></Row>
          <Row gap={8}><Text weight="800" color={c.primary}>2</Text><Text variant="small" style={{ flex: 1 }}>Escolha “Adicionar à Tela de Início” <Icon name="add-circle-outline" size={15} color={c.primary} /></Text></Row>
          <Row gap={8}><Text weight="800" color={c.primary}>3</Text><Text variant="small" style={{ flex: 1 }}>Abra o Fluent AI pelo ícone novo na tela de início</Text></Row>
        </View>
      )}
    </Card>
  );
}
