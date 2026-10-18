import { REPORT_CATEGORIES, reportSchema, type ReportCategory, type ReportTarget } from '@runlime/shared/community';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const TITLES: Record<ReportTarget, string> = {
  general: 'Report a safety concern',
  profile_photo: 'Report a profile photo',
  profile: 'Report a profile',
  club: 'Report a club',
  event: 'Report a race listing',
};

/**
 * In-app reporting (Google Play UGC + Child Safety Standards). Opened from Help & legal / Profile ("safety concern")
 * and from Report buttons on profiles, photos and clubs. Reports go to the admin queue (48 h, child safety first).
 */
export default function ReportScreen() {
  const router = useRouter();
  const { c, radius, minTouchTarget } = useTheme();
  const params = useLocalSearchParams<{ kind?: ReportTarget; userId?: string; ref?: string; name?: string }>();
  const kind: ReportTarget = params.kind && params.kind in TITLES ? params.kind : 'general';
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <Screen>
        <Stack.Screen options={{ title: TITLES[kind] }} />
        <Notice tone="success">Thank you. Your report was sent.</Notice>
        <T>We review reports within 48 hours, child-safety reports first. The person you reported is not told who reported them.</T>
        <T>If someone is in immediate danger, call the police on 999.</T>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: TITLES[kind] }} />
      {params.name ? <T variant="muted">About: {params.name}</T> : null}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="What is wrong?" style={{ gap: 8 }}>
        <T style={{ fontWeight: '700' }}>What is wrong?</T>
        {REPORT_CATEGORIES.map((cat) => (
          <Pressable
            key={cat.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: category === cat.value }}
            onPress={() => setCategory(cat.value)}
            style={{ minHeight: minTouchTarget, justifyContent: 'center', padding: 12, borderRadius: radius.md, borderWidth: category === cat.value ? 2 : 1, borderColor: category === cat.value ? c.leaf : c.border }}
          >
            <T style={{ fontWeight: category === cat.value ? '700' : '400' }}>{cat.label}</T>
          </Pressable>
        ))}
        {errors.category ? <T style={{ color: c.danger }}>{errors.category}</T> : null}
      </View>
      <TextField
        label={kind === 'general' ? 'Tell us what happened' : 'Anything else we should know (optional)'}
        hint={kind === 'general' ? 'At least 10 characters. Include names, races or dates if you can.' : undefined}
        value={details}
        onChangeText={setDetails}
        error={errors.details}
        multiline
        maxLength={1000}
        style={{ minHeight: 110, textAlignVertical: 'top' }}
      />
      <Button
        label="Send report"
        busy={busy}
        onPress={async () => {
          const parsed = reportSchema.safeParse({ category: category ?? undefined, targetKind: kind, targetUserId: params.userId ?? null, targetRef: params.ref ?? null, details });
          if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          setErrors({});
          setFormError(undefined);
          setBusy(true);
          const { error } = await supabase.rpc('submit_report', {
            p_category: parsed.data.category,
            p_target_kind: parsed.data.targetKind,
            p_target_user: parsed.data.targetUserId,
            p_target_ref: parsed.data.targetRef,
            p_details: parsed.data.details,
          });
          setBusy(false);
          if (error) return setFormError(friendlyError(error));
          setSent(true);
        }}
      />
    </Screen>
  );
}
