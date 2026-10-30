import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
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

/**
 * Where to scroll so a field is fully visible: its whole box (plus a margin) inside the visible part of the scroll
 * view, preferring to keep its top in view if it is taller than that. Returns null when nothing needs to move.
 */
export function revealOffset(field: { y: number; height: number }, view: { offset: number; height: number }, margin = 16): number | null {
  const top = field.y - margin;
  const bottom = field.y + field.height + margin;
  if (field.height + 2 * margin > view.height) return Math.max(0, top);
  if (bottom > view.offset + view.height) return bottom - view.height;
  if (top < view.offset) return Math.max(0, top);
  return null;
}

/**
 * How much of a screen the keyboard covers, in the same (window) coordinates on both platforms: the screen's bottom
 * edge measured with measureInWindow, minus the keyboard's top edge. React Native's KeyboardAvoidingView uses the
 * view's layout frame instead, which is relative to its parent; under the navigation header that frame starts at 0,
 * so on Android (edge-to-edge, where the window no longer resizes) it padded too little by the header height and
 * the bottom of the screen stayed under the keyboard (owner retest R2, 2026-10-31).
 */
export function keyboardOverlap(screen: { y: number; height: number }, keyboardTop: number): number {
  return Math.max(0, Math.round(screen.y + screen.height - keyboardTop));
}

type Reveal = (node: View | TextInput | null) => void;
export const RevealContext = createContext<Reveal | null>(null);

export function Screen({ children, scroll = true, refreshControl, testID }: { children: ReactNode; scroll?: boolean; refreshControl?: ReactElement<RefreshControlProps>; testID?: string }) {
  const { c, spacing } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const view = useRef({ offset: 0, height: 0 });
  const frameRef = useRef<View>(null);
  const [keyboard, setKeyboard] = useState(0);
  // Keep the focused field fully above the keyboard: on focus, once the keyboard has opened (the view shrinks), and
  // whenever a multi-line box grows (owner retest B2: the report box's lower lines hid behind the keyboard).
  const reveal = useCallback<Reveal>((node) => {
    setTimeout(() => {
      const content = contentRef.current;
      if (!node || !content || !scrollRef.current) return;
      node.measureLayout(
        content,
        (_x, y, _w, height) => {
          const to = revealOffset({ y, height }, view.current);
          if (to !== null) scrollRef.current?.scrollTo({ y: to, animated: true });
        },
        () => undefined,
      );
    }, 150);
  }, []);
  // Leave room for the keyboard: the screen keeps its full size and its content area stops at the keyboard's top, so
  // every field and the button under it can be scrolled into view while typing.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      frameRef.current?.measureInWindow((_x, y, _w, height) => {
        setKeyboard(keyboardOverlap({ y, height }, e.endCoordinates.screenY));
        if (scroll) reveal(TextInput.State.currentlyFocusedInput() as TextInput | null);
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scroll, reveal]);
  const body = (
    <View ref={contentRef} collapsable={false} style={{ padding: spacing.lg, gap: spacing.lg }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom', 'left', 'right']}>
      {/* Android draws edge-to-edge (required from Android 16), so the window no longer shrinks for the keyboard:
          the content stops at the keyboard's top on both platforms (keyboardOverlap). */}
      <View ref={frameRef} collapsable={false} testID="screen-frame" style={{ flex: 1, paddingBottom: keyboard }}>
        {scroll ? (
          <RevealContext.Provider value={reveal}>
            <ScrollView
              ref={scrollRef}
              testID={testID}
              keyboardShouldPersistTaps="handled"
              refreshControl={refreshControl}
              scrollEventThrottle={32}
              onScroll={(e) => (view.current.offset = e.nativeEvent.contentOffset.y)}
              onLayout={(e) => (view.current.height = e.nativeEvent.layout.height)}
            >
              {body}
            </ScrollView>
          </RevealContext.Provider>
        ) : (
          body
        )}
      </View>
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

/** Passes the input to a caller's ref as well as our own (callback or object ref). */
function assignRef<V>(ref: Ref<V> | undefined, value: V | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref && typeof ref === 'object') (ref as { current: V | null }).current = value;
}

/** Multi-line boxes stop growing at about a third of the screen and scroll inside, so they always fit above the keyboard. */
const MULTILINE_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.32);

export function TextField({ label, hint, error, inputRef, ...props }: TextInputProps & { label: string; hint?: string; error?: string; inputRef?: Ref<TextInput> }) {
  const { c, radius, minTouchTarget, fontSize } = useTheme();
  const reveal = useContext(RevealContext);
  const own = useRef<TextInput | null>(null);
  const setRef = useCallback(
    (node: TextInput | null) => {
      own.current = node;
      assignRef(inputRef, node);
    },
    [inputRef],
  );
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontWeight: '700' }}>{label}</T>
      {hint ? <T variant="caption">{hint}</T> : null}
      <TextInput
        ref={setRef}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={c.inkMuted}
        {...props}
        onFocus={(e) => {
          reveal?.(own.current);
          props.onFocus?.(e);
        }}
        onContentSizeChange={(e) => {
          if (props.multiline) reveal?.(own.current);
          props.onContentSizeChange?.(e);
        }}
        style={[
          { minHeight: minTouchTarget, borderWidth: 1, borderColor: error ? c.danger : c.border, borderRadius: radius.md, paddingHorizontal: 12, fontSize: fontSize.body, color: c.ink, backgroundColor: c.background },
          props.multiline ? { maxHeight: MULTILINE_MAX_HEIGHT } : null,
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
