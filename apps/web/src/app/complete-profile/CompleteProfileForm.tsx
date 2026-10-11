'use client';
import { completeSignupSchema } from '@runlime/shared/schemas';
import Link from 'next/link';
import { useState } from 'react';
import { AgeBlocked, AgeGate } from '@/components/AgeGate';
import { Button, Field, Input, Notice, Select } from '@/components/ui';
import { clearPassedDob, getPassedDob, useBrowserValue } from '@/lib/ageGate';
import { friendlyError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

export function CompleteProfileForm({ areas, termsVersion, privacyVersion, next }: {
  areas: { id: string; name: string }[];
  termsVersion: string;
  privacyVersion: string;
  next: string;
}) {
  const storedDob = useBrowserValue(getPassedDob);
  const [enteredDob, setDob] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (storedDob === undefined) return null;
  const dob = enteredDob ?? storedDob;
  if (blocked) return <AgeBlocked />;
  if (!dob) return <AgeGate onPassed={setDob} />;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (fd.get('accept') !== 'on') {
          setErrors({ accept: 'Please accept the Terms of Use and Privacy Policy to continue.' });
          return;
        }
        const parsed = completeSignupSchema.safeParse({
          dateOfBirth: dob,
          displayName: fd.get('displayName'),
          nickname: (fd.get('nickname') as string) || undefined,
          homeRegionId: fd.get('homeRegionId'),
          termsVersion,
          privacyVersion,
        });
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setErrors({});
        setBusy(true);
        const supabase = createClient();
        const { data, error } = await supabase.rpc('complete_signup', {
          p_date_of_birth: parsed.data.dateOfBirth,
          p_display_name: parsed.data.displayName,
          p_nickname: parsed.data.nickname ?? null,
          p_home_region_id: parsed.data.homeRegionId,
          p_terms_version: termsVersion,
          p_privacy_version: privacyVersion,
        });
        setBusy(false);
        if (error) return setFormError(friendlyError(error));
        if ((data as { status: string }).status === 'blocked') {
          clearPassedDob();
          await supabase.auth.signOut();
          setBlocked(true);
          return;
        }
        clearPassedDob();
        window.location.assign(next);
      }}
    >
      {formError && <Notice tone="danger">{formError}</Notice>}
      <Field label="Display name" htmlFor="displayName" error={errors.displayName} hint="Shown to people you choose to share with.">
        <Input id="displayName" name="displayName" required maxLength={50} autoComplete="name" aria-describedby="displayName-hint" />
      </Field>
      <Field label="Nickname (optional)" htmlFor="nickname" error={errors.nickname} hint="Used on community boards if you prefer not to show your name.">
        <Input id="nickname" name="nickname" maxLength={30} aria-describedby="nickname-hint" />
      </Field>
      <Field label="Home area" htmlFor="homeRegionId" error={errors.homeRegionId}>
        <Select id="homeRegionId" name="homeRegionId" required defaultValue="">
          <option value="" disabled>
            Choose your area
          </option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="mb-5">
        <label className="flex gap-3 items-start">
          <input type="checkbox" name="accept" className="mt-1 h-5 w-5" />
          <span>
            I accept the <Link href="/legal/terms">Terms of Use</Link> and <Link href="/legal/privacy">Privacy Policy</Link>.
          </span>
        </label>
        {errors.accept && (
          <p role="alert" className="text-danger text-sm mt-1">
            {errors.accept}
          </p>
        )}
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Create my account'}
      </Button>
    </form>
  );
}
