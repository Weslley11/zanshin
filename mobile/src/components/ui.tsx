import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { gradients, font, radius, spacing, useTheme, type GradientName } from "../lib/theme";
import { Enter, PressableScale, useTween } from "./motion";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { c } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? c.text} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function Screen({ children, scroll = true, padded = true, overlay }: { children: ReactNode; scroll?: boolean; padded?: boolean; overlay?: ReactNode }) {
  const { c } = useTheme();
  const inner = <View style={[styles.inner, padded && { padding: spacing.lg }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {inner}
        </ScrollView>
      ) : inner}
      {overlay}
    </SafeAreaView>
  );
}

type TextVariant = "display" | "h1" | "h2" | "h3" | "body" | "small" | "tiny" | "label";

export function Text({ children, variant = "body", muted, color, style, weight, center, selectable, numberOfLines }: {
  children: ReactNode; variant?: TextVariant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>;
  weight?: TextStyle["fontWeight"]; center?: boolean; selectable?: boolean; numberOfLines?: number;
}) {
  const { c } = useTheme();
  const size = variant === "label" ? font.tiny : font[variant];
  const defaultWeight: TextStyle["fontWeight"] = variant === "display" ? "800" : variant.startsWith("h") ? "700" : variant === "label" ? "700" : "400";
  return (
    <RNText selectable={selectable} numberOfLines={numberOfLines}
      style={[{
        fontSize: size, lineHeight: Math.round(size * (variant === "display" ? 1.15 : 1.38)), color: color ?? (muted ? c.textMuted : c.text),
        fontWeight: weight ?? defaultWeight, textAlign: center ? "center" : undefined,
        letterSpacing: variant === "label" ? 0.9 : variant === "display" || variant === "h1" ? -0.6 : undefined,
        textTransform: variant === "label" ? "uppercase" : undefined,
      }, style]}>
      {children}
    </RNText>
  );
}

export function Gradient({ name = "brand", colors, style, children }: { name?: GradientName; colors?: readonly string[]; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const cs = (colors ?? gradients[name]) as unknown as [string, string, ...string[]];
  return <LinearGradient colors={cs} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>{children}</LinearGradient>;
}

export function Card({ children, style, onPress, tone, index, accessibilityLabel }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: "default" | "primary" | "accent" | "success" | "warning" | "danger";
  index?: number; accessibilityLabel?: string;
}) {
  const { c, dark } = useTheme();
  const bg = tone === "primary" ? c.primarySoft : tone === "accent" ? c.accentSoft : tone === "success" ? c.successSoft
    : tone === "warning" ? c.warningSoft : tone === "danger" ? c.dangerSoft : c.surface;
  const cardStyle = [styles.card, { backgroundColor: bg, borderColor: c.border, shadowColor: dark ? "#000" : "#2B1F7A" }, style];
  const body = onPress
    ? <PressableScale onPress={onPress} style={cardStyle} accessibilityLabel={accessibilityLabel}>{children}</PressableScale>
    : <View style={cardStyle}>{children}</View>;
  return index != null ? <Enter index={index}>{body}</Enter> : body;
}

export function Button({ title, onPress, variant = "primary", loading, disabled, icon, size = "md", style, accessibilityLabel, gradient }: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean;
  disabled?: boolean; icon?: IconName | string; size?: "md" | "lg" | "sm"; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
  gradient?: GradientName;
}) {
  const { c } = useTheme();
  const fg = variant === "primary" || variant === "danger" ? "#FFFFFF" : variant === "secondary" ? c.text : c.primary;
  const pad = size === "lg" ? 17 : size === "sm" ? 8 : 13;
  const isIcon = typeof icon === "string" && /^[a-z-]+$/.test(icon);
  const content = loading ? <ActivityIndicator color={fg} /> : (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon ? (isIcon ? <Icon name={icon as IconName} size={size === "sm" ? 16 : 19} color={fg} /> : <RNText style={{ color: fg }}>{icon}</RNText>) : null}
      <RNText style={{ color: fg, fontSize: size === "lg" ? 17 : size === "sm" ? 14 : 16, fontWeight: "700" }}>{title}</RNText>
    </View>
  );
  const base = [styles.button, { paddingVertical: pad }];
  const inner = variant === "primary"
    ? <Gradient name={gradient ?? "brand"} style={[...base, styles.btnShadow]}>{content}</Gradient>
    : <View style={[...base, { backgroundColor: variant === "danger" ? c.danger : variant === "secondary" ? c.surfaceAlt : "transparent",
                             borderWidth: variant === "ghost" ? 1 : 0, borderColor: c.border }]}>{content}</View>;
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} accessibilityLabel={accessibilityLabel ?? title} style={style}>
      {inner}
    </PressableScale>
  );
}

export function Field({ label, value, onChangeText, placeholder, secure, multiline, keyboardType, autoCapitalize = "none", onSubmitEditing, autoFocus }: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; secure?: boolean; multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric"; autoCapitalize?: "none" | "sentences"; onSubmitEditing?: () => void; autoFocus?: boolean;
}) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="small" weight="600">{label}</Text> : null}
      <TextInput
        accessibilityLabel={label ?? placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        secureTextEntry={secure}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: focus ? c.primary : c.border, minHeight: multiline ? 96 : 50 }]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" scaleTo={0.94}
      style={[styles.chip, { backgroundColor: selected ? c.primary : c.surface, borderColor: selected ? c.primary : c.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon ? <Icon name={icon} size={15} color={selected ? "#fff" : c.textMuted} /> : null}
        <RNText style={{ color: selected ? "#FFFFFF" : c.text, fontSize: 14, fontWeight: "600" }}>{label}</RNText>
      </View>
    </PressableScale>
  );
}

export function Pill({ label, icon, color, bg }: { label: string; icon?: IconName; color?: string; bg?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
                   backgroundColor: bg ?? c.surfaceAlt, alignSelf: "flex-start" }}>
      {icon ? <Icon name={icon} size={13} color={color ?? c.textMuted} /> : null}
      <RNText style={{ color: color ?? c.textMuted, fontSize: 12, fontWeight: "700" }}>{label}</RNText>
    </View>
  );
}

export function Row({ children, gap = spacing.sm, wrap, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>{children}</View>;
}

export function Stack({ children, gap = spacing.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function ProgressBar({ value, color, height = 8, gradient }: { value: number; color?: string; height?: number; gradient?: GradientName }) {
  const { c } = useTheme();
  const pct = useTween(Math.max(0, Math.min(1, value)), 800);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height, borderRadius: height, backgroundColor: c.surfaceAlt, overflow: "hidden" }}>
      {gradient || !color
        ? <Gradient name={gradient ?? "brand"} style={{ width: `${pct * 100}%`, height, borderRadius: height }} />
        : <View style={{ width: `${pct * 100}%`, height, backgroundColor: color, borderRadius: height }} />}
    </View>
  );
}

export function Banner({ tone = "accent", title, children, icon }: { tone?: "accent" | "warning" | "danger" | "success"; title?: string; children: ReactNode; icon?: IconName }) {
  const { c } = useTheme();
  const col = tone === "warning" ? c.warning : tone === "danger" ? c.danger : tone === "success" ? c.success : c.accent;
  const def: IconName = tone === "warning" ? "information-circle" : tone === "danger" ? "alert-circle" : tone === "success" ? "checkmark-circle" : "sparkles";
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card tone={tone} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Icon name={icon ?? def} size={20} color={col} />
        <View style={{ flex: 1, gap: 2 }}>
          {title ? <Text variant="small" weight="700">{title}</Text> : null}
          <Text variant="small">{children}</Text>
        </View>
      </Card>
    </Animated.View>
  );
}

export function ErrorText({ error }: { error: string | null | undefined }) {
  const { c } = useTheme();
  if (!error) return null;
  return <Text variant="small" color={c.danger} selectable>{error}</Text>;
}

export function Loading({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ padding: spacing.xxl, alignItems: "center", gap: spacing.md }}>
      <ActivityIndicator color={c.primary} />
      {label ? <Text muted variant="small">{label}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: sel }}
            style={[styles.segment, sel && { backgroundColor: c.surface }]}>
            <RNText style={{ color: sel ? c.text : c.textMuted, fontWeight: sel ? "700" : "500", fontSize: 14 }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Collapsible({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const { c } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name={open ? "chevron-down" : "chevron-forward"} size={18} color={c.primary} />
        <Text weight="700" color={c.primary}>{title}</Text>
      </Pressable>
      {open ? <Animated.View entering={FadeIn.duration(250)}>{children}</Animated.View> : null}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: spacing.sm }} />;
}

/** Cabeçalho de módulo com gradiente, ícone e subtítulo. */
export function ModuleHero({ title, subtitle, icon, gradient, children, right }: {
  title: string; subtitle?: string; icon: IconName; gradient: GradientName; children?: ReactNode; right?: ReactNode;
}) {
  return (
    <Enter>
      <Gradient name={gradient} style={styles.hero}>
        <View style={styles.heroBlob} />
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={styles.heroIcon}><Icon name={icon} size={26} color="#fff" /></View>
          {right}
        </Row>
        <Text variant="h1" color="#FFFFFF">{title}</Text>
        {subtitle ? <Text variant="small" color="rgba(255,255,255,0.88)">{subtitle}</Text> : null}
        {children}
      </Gradient>
    </Enter>
  );
}

/** Bloco de módulo na grade (gradiente, ícone, progresso). */
export function ModuleTile({ title, subtitle, icon, gradient, progress, onPress, index = 0, badge, wide }: {
  title: string; subtitle?: string; icon: IconName; gradient: GradientName; progress?: number | null; onPress?: () => void;
  index?: number; badge?: string; wide?: boolean;
}) {
  return (
    <Enter index={index} style={wide ? { width: "100%" } : { flexBasis: "47%", flexGrow: 1 }}>
      <PressableScale onPress={onPress} accessibilityLabel={`${title}${subtitle ? `: ${subtitle}` : ""}`}>
        <Gradient name={gradient} style={[styles.tile, wide && { minHeight: 120 }]}>
          <View style={styles.tileBlob} />
          <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={styles.tileIcon}><Icon name={icon} size={22} color="#fff" /></View>
            {badge ? <View style={styles.badge}><RNText style={styles.badgeText}>{badge}</RNText></View> : null}
          </Row>
          <View style={{ gap: 2 }}>
            <Text variant="h3" color="#FFFFFF" numberOfLines={2} style={{ fontSize: wide ? 20 : 17, lineHeight: wide ? 25 : 21 }}>{title}</Text>
            {subtitle ? <Text variant="tiny" color="rgba(255,255,255,0.9)" numberOfLines={2}>{subtitle}</Text> : null}
          </View>
          {progress != null ? (
            <View style={styles.tileTrack}><View style={[styles.tileFill, { width: `${Math.round(Math.max(0.03, Math.min(1, progress)) * 100)}%` }]} /></View>
          ) : null}
        </Gradient>
      </PressableScale>
    </Enter>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
      <Text variant="h3">{title}</Text>
      {action ? <Pressable onPress={onAction} accessibilityRole="button"><Text variant="small" weight="700" color={c.primary}>{action}</Text></Pressable> : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  inner: { width: "100%", maxWidth: 680, alignSelf: "center", gap: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  button: { borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", minHeight: 46 },
  btnShadow: { shadowColor: "#6C5CE7", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  input: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 16 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, minHeight: 38, justifyContent: "center" },
  segmented: { flexDirection: "row", borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.sm },
  hero: { borderRadius: radius.xl, padding: 22, gap: 8, overflow: "hidden" },
  heroBlob: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, top: -80, backgroundColor: "rgba(255,255,255,0.14)" },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  tile: { borderRadius: radius.lg, padding: 16, minHeight: 150, justifyContent: "space-between", gap: 10, overflow: "hidden" },
  tileBlob: { position: "absolute", width: 130, height: 130, borderRadius: 65, right: -40, bottom: -50, backgroundColor: "rgba(255,255,255,0.15)" },
  tileIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" },
  tileTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  tileFill: { height: 5, borderRadius: 3, backgroundColor: "#FFFFFF" },
  badge: { backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
