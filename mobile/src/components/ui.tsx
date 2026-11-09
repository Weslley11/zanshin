import { useState, type ReactNode } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { font, radius, spacing, useTheme } from "../lib/theme";

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const { c } = useTheme();
  const inner = <View style={[styles.inner, padded && { padding: spacing.lg }]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

type TextVariant = "h1" | "h2" | "h3" | "body" | "small" | "tiny" | "label";

export function Text({
  children, variant = "body", muted, color, style, weight, center, selectable,
}: {
  children: ReactNode; variant?: TextVariant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>;
  weight?: TextStyle["fontWeight"]; center?: boolean; selectable?: boolean;
}) {
  const { c } = useTheme();
  const size = variant === "label" ? font.tiny : font[variant];
  const defaultWeight: TextStyle["fontWeight"] = variant.startsWith("h") ? "700" : variant === "label" ? "600" : "400";
  return (
    <RNText
      selectable={selectable}
      style={[{
        fontSize: size, lineHeight: Math.round(size * 1.4), color: color ?? (muted ? c.textMuted : c.text),
        fontWeight: weight ?? defaultWeight, textAlign: center ? "center" : undefined,
        letterSpacing: variant === "label" ? 0.6 : undefined, textTransform: variant === "label" ? "uppercase" : undefined,
      }, style]}
    >
      {children}
    </RNText>
  );
}

export function Card({ children, style, onPress, tone }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: "default" | "primary" | "accent" | "success" | "warning" | "danger";
}) {
  const { c } = useTheme();
  const bg = tone === "primary" ? c.primarySoft : tone === "accent" ? c.accentSoft : tone === "success" ? c.successSoft
    : tone === "warning" ? c.warningSoft : tone === "danger" ? c.dangerSoft : c.surface;
  const body = <View style={[styles.card, { backgroundColor: bg, borderColor: c.border }, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function Button({
  title, onPress, variant = "primary", loading, disabled, icon, size = "md", style, accessibilityLabel,
}: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean;
  disabled?: boolean; icon?: string; size?: "md" | "lg" | "sm"; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const bg = variant === "primary" ? c.primary : variant === "danger" ? c.danger : variant === "secondary" ? c.surfaceAlt : "transparent";
  const fg = variant === "primary" ? c.primaryText : variant === "danger" ? "#fff" : variant === "secondary" ? c.text : c.primary;
  const pad = size === "lg" ? 18 : size === "sm" ? 8 : 13;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, {
        backgroundColor: bg, paddingVertical: pad, opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        borderWidth: variant === "ghost" ? 1 : 0, borderColor: c.border,
      }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <RNText style={{ color: fg, fontSize: size === "lg" ? 18 : size === "sm" ? 14 : 16, fontWeight: "700" }}>
          {icon ? `${icon}  ` : ""}{title}
        </RNText>
      )}
    </Pressable>
  );
}

export function Field({
  label, value, onChangeText, placeholder, secure, multiline, keyboardType, autoCapitalize = "none", onSubmitEditing, autoFocus,
}: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; secure?: boolean; multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric"; autoCapitalize?: "none" | "sentences"; onSubmitEditing?: () => void;
  autoFocus?: boolean;
}) {
  const { c } = useTheme();
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
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border, minHeight: multiline ? 90 : 48 }]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? c.primary : c.surfaceAlt, borderColor: selected ? c.primary : c.border }]}
    >
      <RNText style={{ color: selected ? c.primaryText : c.text, fontSize: 14, fontWeight: "600" }}>{label}</RNText>
    </Pressable>
  );
}

export function Row({ children, gap = spacing.sm, wrap, style }: { children: ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>{children}</View>;
}

export function Stack({ children, gap = spacing.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ height, borderRadius: height, backgroundColor: c.surfaceAlt, overflow: "hidden" }}
    >
      <View style={{ width: `${pct * 100}%`, height, backgroundColor: color ?? c.primary, borderRadius: height }} />
    </View>
  );
}

export function Banner({ tone = "accent", title, children }: { tone?: "accent" | "warning" | "danger" | "success"; title?: string; children: ReactNode }) {
  return (
    <Card tone={tone} style={{ gap: 4 }}>
      {title ? <Text variant="small" weight="700">{title}</Text> : null}
      <Text variant="small">{children}</Text>
    </Card>
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

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
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
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text weight="700" color={c.accent}>{open ? "▾" : "▸"} {title}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: spacing.sm }} />;
}

const styles = StyleSheet.create({
  inner: { width: "100%", maxWidth: 640, alignSelf: "center", gap: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth },
  button: { borderRadius: radius.md, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", minHeight: 44 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, minHeight: 36, justifyContent: "center" },
  segmented: { flexDirection: "row", borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radius.sm },
});
