import { View } from "react-native";
import { ACTIVITY_STYLE } from "../lib/activities";
import type { GradientName } from "../lib/theme";
import { useTheme } from "../lib/theme";
import type { Activity } from "../lib/types";
import { Enter, PressableScale } from "./motion";
import { Gradient, Icon, Text, type IconName } from "./ui";

export function ActivityRow({ a, onPress, index = 0 }: { a: Activity; onPress: () => void; index?: number }) {
  const { c } = useTheme();
  const st = ACTIVITY_STYLE[a.type] ?? { icon: "ellipse", gradient: "brand" };
  return (
    <Enter index={index}>
      <PressableScale onPress={onPress} accessibilityLabel={`${a.title_pt}, ${a.minutes} minutos${a.done ? ", concluída" : ""}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
        {a.done ? (
          <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.successSoft }}>
            <Icon name="checkmark" size={22} color={c.success} />
          </View>
        ) : (
          <Gradient name={st.gradient as GradientName} style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
            <Icon name={st.icon as IconName} size={20} color="#fff" />
          </Gradient>
        )}
        <View style={{ flex: 1 }}>
          <Text weight="600" muted={a.done} style={a.done ? { textDecorationLine: "line-through" } : undefined} numberOfLines={1}>{a.title_pt}</Text>
          <Text variant="tiny" muted>{a.minutes} min</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={c.textMuted} />
      </PressableScale>
    </Enter>
  );
}
