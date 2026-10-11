import { completeSignupSchema } from '@runlime/shared/schemas';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AgeBlocked } from '@/components/AgeBlocked';
import { AreaPicker } from '@/components/AreaPicker';
import { DateOfBirthInput } from '@/components/DateOfBirthInput';
import { Button, Notice, Screen, T, TextField } from '@/components/ui';
import { recordBlocked, runAgeGate } from '@/lib/ageGate';
import { friendlyError } from '@/lib/errors';
import { openWebPage } from '@/lib/legalLinks';
import { useAreas } from '@/lib/regions';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/state/session';

/** M6 + M7. If the app restarted after Google/Apple sign-in, the age gate is asked again before anything is saved. */
export default function CompleteProfileScreen() {
  const { c, minTouchTarget } = useTheme();
  const { passedDob, setPassedDob, refreshProfile, signOut } = useSession();
  const { areas, error: areasError } = useAreas();
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [versions, setVersions] = useState<{ terms: string; privacy: string } | null>(null);

  useEffect(() => {
    void supabase
      .from('legal_documents')
      .select('slug, version')
      .in('slug', ['terms', 'privacy'])
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        const v = (slug: string) => data?.find((d) => d.slug === slug)?.version ?? 'unpublished';
        setVersions({ terms: v('terms'), privacy: v('privacy') });
      });
  }, []);

  if (blocked) {
    return (
      <Screen>
        <AgeBlocked />
      </Screen>
    );
  }

  if (!passedDob) {
    return (
      <Screen>
        <DateOfBirthInput
          onSubmit={async (d, m, y) => {
            const r = await runAgeGate(d, m, y);
            if (r.status === 'allowed') setPassedDob(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
            else if (r.status === 'blocked') {
              // Delete the just-created auth account server-side, then sign out. Nothing else is stored.
              await supabase.rpc('complete_signup', {
                p_date_of_birth: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
                p_display_name: '-',
                p_nickname: null,
                p_home_region_id: null,
                p_terms_version: '-',
                p_privacy_version: '-',
              });
              await signOut();
              setBlocked(true);
            } else setFormError('Please enter a valid date of birth.');
          }}
        />
        {formError ? <Notice tone="danger">{formError}</Notice> : null}
      </Screen>
    );
  }

  async function submit() {
    if (!accepted) return setErrors({ accept: 'Please accept the Terms of Use and Privacy Policy to continue.' });
    const parsed = completeSignupSchema.safeParse({
      dateOfBirth: passedDob,
      displayName,
      nickname: nickname.trim() || undefined,
      homeRegionId: areaId ?? '',
      termsVersion: versions?.terms ?? '',
      privacyVersion: versions?.privacy ?? '',
    });
    if (!parsed.success) {
      return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.path[0] === 'homeRegionId' ? 'Choose your home area' : i.message])));
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.rpc('complete_signup', {
      p_date_of_birth: parsed.data.dateOfBirth,
      p_display_name: parsed.data.displayName,
      p_nickname: parsed.data.nickname ?? null,
      p_home_region_id: parsed.data.homeRegionId,
      p_terms_version: parsed.data.termsVersion,
      p_privacy_version: parsed.data.privacyVersion,
    });
    setBusy(false);
    if (error) return setFormError(friendlyError(error));
    if ((data as { status: string }).status === 'blocked') {
      await recordBlocked();
      await signOut();
      return setBlocked(true);
    }
    setPassedDob(null);
    await refreshProfile();
  }

  return (
    <Screen>
      <T variant="muted">A few details and you&apos;re in.</T>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      {areasError ? <Notice tone="danger">Could not load areas. Check your connection.</Notice> : null}
      <TextField label="Display name" hint="Shown to people you choose to share with." value={displayName} onChangeText={setDisplayName} maxLength={50} error={errors.displayName} autoComplete="name" />
      <TextField label="Nickname (optional)" hint="Used on community boards if you prefer not to show your name." value={nickname} onChangeText={setNickname} maxLength={30} error={errors.nickname} autoCapitalize="none" />
      {areas ? <AreaPicker areas={areas} value={areaId} onChange={setAreaId} error={errors.homeRegionId} /> : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel="I accept the Terms of Use and Privacy Policy"
        onPress={() => setAccepted((v) => !v)}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: minTouchTarget }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: c.leaf, backgroundColor: accepted ? c.leaf : 'transparent' }} />
        <T style={{ flex: 1 }}>I accept the Terms of Use and Privacy Policy</T>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <T style={{ color: c.leaf, textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => void openWebPage('/legal/terms')}>
          Read the Terms
        </T>
        <T style={{ color: c.leaf, textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => void openWebPage('/legal/privacy')}>
          Read the Privacy Policy
        </T>
      </View>
      {errors.accept ? <T style={{ color: c.danger }}>{errors.accept}</T> : null}
      <Button label="Create my account" busy={busy} onPress={() => void submit()} />
      <Button label="Cancel and sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
