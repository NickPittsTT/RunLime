'use client';
import { useState } from 'react';
import { AgeGate } from '@/components/AgeGate';
import { Button, Field, Input, Notice } from '@/components/ui';
import { getPassedDob, useBrowserValue } from '@/lib/ageGate';
import { friendlyError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

type Step = 'dob' | 'email' | 'code';

export function SignInFlow({ next }: { next: string }) {
  const storedDob = useBrowserValue(getPassedDob);
  const [chosenStep, setStep] = useState<Step | null>(null);
  const [enteredDob, setDob] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (storedDob === undefined) return null;
  const dob = enteredDob ?? storedDob;
  const step: Step = chosenStep ?? (storedDob ? 'email' : 'dob');

  if (step === 'dob') {
    return (
      <AgeGate
        onPassed={(d) => {
          setDob(d);
          setStep('email');
        }}
      />
    );
  }

  if (step === 'email') {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          const supabase = createClient();
          const { error: err } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: true, data: { date_of_birth: dob } },
          });
          setBusy(false);
          if (err) setError(friendlyError(err));
          else setStep('code');
        }}
      >
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Email address" htmlFor="email" hint="We'll email you a 6-digit code. No password needed.">
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby="email-hint" />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Email me a code'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        const supabase = createClient();
        const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
        if (err) {
          setBusy(false);
          setError(friendlyError({ ...err, message: `otp ${err.message}` }));
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('id').maybeSingle();
        // Full navigation: the client router may hold prefetched signed-out redirects.
        window.location.assign(profile ? next : `/complete-profile?next=${encodeURIComponent(next)}`);
      }}
    >
      {error && <Notice tone="danger">{error}</Notice>}
      <p className="mb-4">
        We sent a code to <strong>{email}</strong>.
      </p>
      <Field label="6-digit code" htmlFor="code">
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Sign in'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setStep('email')}>
          Use a different email
        </Button>
      </div>
    </form>
  );
}
