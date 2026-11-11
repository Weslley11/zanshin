import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** Retorno tátil sutil no iPhone/Android; no navegador não faz nada. */
export function tap(kind: "light" | "success" | "warning" = "light") {
  if (Platform.OS === "web") return;
  try {
    if (kind === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(kind === "success" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
  } catch {
    /* sem suporte */
  }
}
