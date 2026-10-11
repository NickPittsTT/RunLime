'use client';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

type State =
  | { kind: 'loading' }
  | { kind: 'enrol'; factorId: string; qr: string; secret: string }
  | { kind: 'challenge'; factorId: string };

/** A0: admins must enrol an authenticator (TOTP) and verify it on every sign-in. */
export function MfaFlow({ next }: { next: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) return setError('Could not load your authenticator settings.');
      const verified = factors.totp.find((f) => f.status === 'verified');
      if (verified) return setState({ kind: 'challenge', factorId: verified.id });
      // Remove abandoned unverified factors before enrolling a fresh one.
      for (const f of factors.all.filter((x) => x.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: enrolErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `RunLime admin ${new Date().toISOString().slice(0, 10)}` });
      if (enrolErr) return setError('Could not start authenticator set-up.');
      setState({ kind: 'enrol', factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'loading') return;
    setBusy(true);
    setError(undefined);
    const supabase = createClient();
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
    setBusy(false);
    if (vErr) return setError('That code did not work. Check the time on your phone and try again.');
    window.location.assign(next);
  }

  if (state.kind === 'loading') return error ? <Notice tone="danger">{error}</Notice> : <p>Loading…</p>;

  return (
    <form onSubmit={verify} className="max-w-md">
      {error && <Notice tone="danger">{error}</Notice>}
      {state.kind === 'enrol' && (
        <>
          <p className="mb-4">
            Admin accounts need two-factor authentication. Scan this code with an authenticator app (for example Google Authenticator,
            Microsoft Authenticator or 1Password), then enter the 6-digit code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt="Authenticator set-up QR code" width={200} height={200} className="mb-3 border border-line rounded" />
          <p className="mb-6 text-sm">
            Can&apos;t scan? Enter this key manually: <code data-testid="totp-secret" className="break-all font-mono">{state.secret}</code>
          </p>
        </>
      )}
      {state.kind === 'challenge' && <p className="mb-4">Enter the 6-digit code from your authenticator app.</p>}
      <Field label="Authenticator code" htmlFor="mfa-code">
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? 'Checking…' : 'Verify'}
      </Button>
    </form>
  );
}
