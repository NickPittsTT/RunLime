import { profileUpdateSchema } from '@runlime/shared/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AreaPicker } from '@/components/AreaPicker';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { useAreas } from '@/lib/regions';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

export default function EditProfileScreen() {
  const router = useRouter();
  const { c, radius, minTouchTarget } = useTheme();
  const { profile, refreshProfile } = useSession();
  const { areas } = useAreas();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [areaId, setAreaId] = useState(profile?.home_region_id ?? null);
  const [privacy, setPrivacy] = useState<'private' | 'public'>(profile?.account_privacy ?? 'private');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  return (
    <Screen>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={50} error={errors.displayName} />
      <TextField label="Nickname (optional)" value={nickname} onChangeText={setNickname} maxLength={30} error={errors.nickname} autoCapitalize="none" />
      {areas ? <AreaPicker areas={areas} value={areaId} onChange={setAreaId} /> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Account privacy" style={{ gap: 8 }}>
        <T style={{ fontWeight: '700' }}>Account privacy</T>
        {(
          [
            ['private', 'Private (recommended)', 'People must ask to follow you. Only approved followers see your race passport and the races you are attending.'],
            ['public', 'Public', 'Anyone can follow you and see your race passport and the races you are attending.'],
          ] as const
        ).map(([value, label, help]) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: privacy === value }}
            accessibilityHint={help}
            onPress={() => setPrivacy(value)}
            style={{ minHeight: minTouchTarget, padding: 12, borderRadius: radius.md, borderWidth: privacy === value ? 2 : 1, borderColor: privacy === value ? c.leaf : c.border }}
          >
            <T style={{ fontWeight: '700' }}>{label}</T>
            <T variant="caption">{help}</T>
          </Pressable>
        ))}
        <T variant="caption">Your runs, routes, times and history are always private unless you share a result.</T>
      </View>
      <Button
        label="Save"
        busy={busy}
        onPress={async () => {
          const parsed = profileUpdateSchema.safeParse({ displayName, nickname: nickname.trim() || null, homeRegionId: areaId ?? '' });
          if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          setErrors({});
          setBusy(true);
          const { error } = await supabase
            .from('profiles')
            .update({ display_name: parsed.data.displayName, nickname: parsed.data.nickname, home_region_id: parsed.data.homeRegionId, account_privacy: privacy })
            .eq('id', profile.id);
          setBusy(false);
          if (error) return setFormError(error.code === '23505' ? 'That nickname is taken. Try another.' : friendlyError(error));
          await refreshProfile();
          router.back();
        }}
      />
    </Screen>
  );
}
