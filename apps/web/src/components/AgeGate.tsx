'use client';
import { useState } from 'react';
import { checkDob, isRecentlyBlocked, useBrowserValue } from '@/lib/ageGate';
import { Button, Field, Input, Notice } from './ui';

/** Neutral age gate: a plain date entry with no hint of the threshold. Runs before any sign-in method (F1). */
export function AgeGate({ onPassed }: { onPassed: (dob: string) => void }) {
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string>();
  const [blockedNow, setBlocked] = useState(false);
  const blockedBefore = useBrowserValue(isRecentlyBlocked);

  if (blockedBefore === undefined) return null;
  if (blockedNow || blockedBefore) return <AgeBlocked />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const r = checkDob(dob);
        if (r.status === 'allowed') onPassed(dob);
        else if (r.status === 'blocked') setBlocked(true);
        else setError('Please enter a valid date of birth.');
      }}
    >
      <Field label="What is your date of birth?" htmlFor="dob" error={error}>
        <Input id="dob" name="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} autoComplete="bday" />
      </Field>
      <Button type="submit">Continue</Button>
    </form>
  );
}

export function AgeBlocked() {
  return (
    <Notice tone="info">
      <h2 className="text-xl font-bold mb-2">Sorry, you can&apos;t create a RunLime account</h2>
      <p>
        RunLime accounts are for adults aged 18 and over. Young runners are very welcome at races with a parent or guardian, who can
        add them to their group.
      </p>
    </Notice>
  );
}
