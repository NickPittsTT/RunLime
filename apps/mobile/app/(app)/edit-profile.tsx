import { RUNNER_LEVELS, RUNNER_LEVEL_NOTE, type RunnerLevel } from '@runlime/shared/community';
import { profileUpdateSchema } from '@runlime/shared/schemas';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AreaPicker } from '@/components/AreaPicker';
import { Avatar } from '@/components/Avatar';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { chooseAndUploadPhoto, removePhoto } from '@/lib/profilePhoto';
import { useAreas } from '@/lib/regions';
import { supabase } from '@/lib/supabase';
import { useFieldErrors } from '@/lib/form';
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
  const [level, setLevel] = useState<RunnerLevel | null>(profile?.runner_level ?? null);
  const [clubTurnout, setClubTurnout] = useState(profile?.show_attendance_to_clubs ?? false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ tone: 'danger' | 'success'; text: string }>();
  const { errors, setErrors, edit } = useFieldErrors();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  return (
    <Screen>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar name={displayName || profile.display_name} path={profile.avatar_path} size={80} />
        <View style={{ flex: 1, gap: 8 }}>
          <Button
            label={profile.avatar_path ? 'Change photo' : 'Add a photo'}
            variant="secondary"
            busy={photoBusy}
            onPress={async () => {
              setPhotoBusy(true);
              setPhotoMessage(undefined);
              const r = await chooseAndUploadPhoto().catch(() => ({ ok: false as const, message: 'We could not save your photo. Please try again.' }));
              if (r.ok) {
                await refreshProfile();
                setPhotoMessage({ tone: 'success', text: 'Photo saved.' });
              } else if (r.message) setPhotoMessage({ tone: 'danger', text: r.message });
              setPhotoBusy(false);
            }}
          />
          {/* Android's photo picker: no gallery permission (Google Play photo and video permissions policy). */}
          <T variant="caption">RunLime only sees the photo you choose.</T>
          {profile.avatar_path ? (
            <Button
              label="Remove photo"
              variant="secondary"
              disabled={photoBusy}
              onPress={async () => {
                setPhotoBusy(true);
                const ok = await removePhoto();
                if (ok) await refreshProfile();
                setPhotoMessage(ok ? { tone: 'success', text: 'Photo removed.' } : { tone: 'danger', text: 'We could not remove your photo. Please try again.' });
                setPhotoBusy(false);
              }}
            />
          ) : null}
        </View>
      </View>
      <T variant="caption">
        Your photo appears with your display name. Location and other hidden details are removed from it. Photos must follow our rules (no nudity, hate,
        or other people without their permission); anyone can report a photo.
      </T>
      {photoMessage ? <Notice tone={photoMessage.tone}>{photoMessage.text}</Notice> : null}
      <TextField label="Display name" value={displayName} onChangeText={edit('displayName', setDisplayName)} maxLength={50} error={errors.displayName} />
      <TextField label="Nickname (optional)" value={nickname} onChangeText={edit('nickname', setNickname)} maxLength={30} error={errors.nickname} autoCapitalize="none" />
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
      <View accessibilityRole="radiogroup" accessibilityLabel="Runner level (optional)" style={{ gap: 8 }}>
        <T style={{ fontWeight: '700' }}>Runner level (optional)</T>
        {([{ value: null, label: 'Not set', help: 'Leave it blank if you prefer.' }, ...RUNNER_LEVELS] as const).map((l) => (
          <Pressable
            key={l.value ?? 'none'}
            accessibilityRole="radio"
            accessibilityState={{ checked: level === l.value }}
            accessibilityHint={l.help}
            onPress={() => setLevel(l.value)}
            style={{ minHeight: minTouchTarget, padding: 12, borderRadius: radius.md, borderWidth: level === l.value ? 2 : 1, borderColor: level === l.value ? c.leaf : c.border }}
          >
            <T style={{ fontWeight: '700' }}>{l.label}</T>
            <T variant="caption">{l.help}</T>
          </Pressable>
        ))}
        <T variant="caption">{RUNNER_LEVEL_NOTE}</T>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: clubTurnout }}
        accessibilityHint="Counts you in your clubs' race turnout. Only numbers are shown, never your name."
        onPress={() => setClubTurnout(!clubTurnout)}
        style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: c.leaf, backgroundColor: clubTurnout ? c.leaf : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {clubTurnout ? <T style={{ color: '#FFFFFF', fontWeight: '900' }}>✓</T> : null}
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '700' }}>Count me in my clubs&apos; race turnout</T>
          <T variant="caption">Race pages show &quot;Club: 12 going&quot; when at least a few members are going. Only the number is shown, never your name.</T>
        </View>
      </Pressable>
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
            .update({ display_name: parsed.data.displayName, nickname: parsed.data.nickname, home_region_id: parsed.data.homeRegionId, account_privacy: privacy, runner_level: level, show_attendance_to_clubs: clubTurnout })
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
