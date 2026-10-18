import type { ReactElement, ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

export function Screen({ children, scroll = true, refreshControl, testID }: { children: ReactNode; scroll?: boolean; refreshControl?: ReactElement<RefreshControlProps>; testID?: string }) {
  const { c, spacing } = useTheme();
  const body = <View style={{ padding: spacing.lg, gap: spacing.lg }}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView testID={testID} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function T({ variant = 'body', style, ...props }: TextProps & { variant?: 'body' | 'title' | 'headline' | 'muted' | 'caption' }) {
  const { c, fontSize } = useTheme();
  const v = {
    body: { fontSize: fontSize.body, color: c.ink },
    muted: { fontSize: fontSize.body, color: c.inkMuted },
    caption: { fontSize: fontSize.caption, color: c.inkMuted },
    title: { fontSize: fontSize.title, color: c.ink, fontWeight: '700' as const },
    headline: { fontSize: fontSize.headline, color: c.ink, fontWeight: '800' as const },
  }[variant];
  return <Text accessibilityRole={variant === 'headline' || variant === 'title' ? 'header' : undefined} {...props} style={[v, style]} />;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}) {
  const { c, radius, minTouchTarget, fontSize } = useTheme();
  const bg = variant === 'primary' ? c.leaf : variant === 'danger' ? c.danger : c.background;
  const fg = variant === 'secondary' ? c.ink : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: minTouchTarget,
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: fontSize.body, fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  );
}

export function TextField({ label, hint, error, inputRef, ...props }: TextInputProps & { label: string; hint?: string; error?: string; inputRef?: Ref<TextInput> }) {
  const { c, radius, minTouchTarget, fontSize } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontWeight: '700' }}>{label}</T>
      {hint ? <T variant="caption">{hint}</T> : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={c.inkMuted}
        {...props}
        style={[
          { minHeight: minTouchTarget, borderWidth: 1, borderColor: error ? c.danger : c.border, borderRadius: radius.md, paddingHorizontal: 12, fontSize: fontSize.body, color: c.ink, backgroundColor: c.background },
          props.style,
        ]}
      />
      {error ? (
        <T accessibilityLiveRegion="polite" style={{ color: c.danger }}>
          {error}
        </T>
      ) : null}
    </View>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'success'; children: ReactNode }) {
  const { c, radius } = useTheme();
  const border = tone === 'danger' ? c.danger : tone === 'success' ? c.success : c.border;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ borderWidth: 1, borderColor: border, backgroundColor: c.surface, borderRadius: radius.md, padding: 14 }}>
      {typeof children === 'string' ? <T>{children}</T> : children}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderColor: c.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <T style={{ fontWeight: '700' }}>{label}</T>
      <T variant="muted">{value}</T>
    </View>
  );
}

export function LinkRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { c, minTouchTarget } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, { borderColor: c.border, minHeight: minTouchTarget }]}>
      <T style={{ color: danger ? c.danger : c.leaf, fontWeight: '700' }}>{label}</T>
      <T variant="muted" importantForAccessibility="no">
        ›
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
});

export function Chip({ label, selected, onPress, accessibilityHint }: { label: string; selected: boolean; onPress: () => void; accessibilityHint?: string }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.leaf : c.border,
        backgroundColor: selected ? c.surface : c.background,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: selected ? c.leaf : c.ink, fontWeight: selected ? '800' : '500' }}>{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  );
}

/** Two-or-more option switch (e.g. List | Map). */
export function Segmented<V extends string>({ options, value, onChange, label, stretch }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string; stretch?: boolean }) {
  const { c, radius } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.leaf, borderRadius: radius.pill, overflow: 'hidden', alignSelf: stretch ? 'stretch' : 'flex-start' }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={{ minHeight: 44, minWidth: 72, paddingHorizontal: stretch ? 6 : 16, flex: stretch ? 1 : undefined, justifyContent: 'center', alignItems: 'center', backgroundColor: selected ? c.leaf : c.background }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: selected ? '#FFFFFF' : c.leaf, fontWeight: '800' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small text button (e.g. "Select all", "Clear"). */
export function TextButton({ label, onPress, accessibilityHint }: { label: string; onPress: () => void; accessibilityHint?: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
      <Text style={{ color: c.leaf, fontWeight: '800', textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}
