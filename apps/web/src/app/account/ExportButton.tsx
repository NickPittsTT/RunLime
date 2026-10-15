'use client';
import { useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { useBrowserValue } from '@/lib/ageGate';
import { createClient } from '@/lib/supabase/client';

const isBrowser = () => true;

/** Downloads all personal data as JSON (Edge Function export-user-data). */
export function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Disabled until hydrated: a tap on the server-rendered button would otherwise do nothing (CI runs 82 and 95).
  const hydrated = useBrowserValue(isBrowser) === true;
  return (
    <div>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button
        variant="secondary"
        disabled={busy || !hydrated}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          const supabase = createClient();
          const { data: session } = await supabase.auth.getSession();
          const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-user-data`, {
            method: 'POST',
            headers: { authorization: `Bearer ${session.session?.access_token ?? ''}` },
          });
          setBusy(false);
          if (!res.ok) return setError('We could not prepare your download. Please try again.');
          const url = URL.createObjectURL(await res.blob());
          const a = document.createElement('a');
          a.href = url;
          a.download = 'runlime-my-data.json';
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        {busy ? 'Preparing…' : 'Download my data'}
      </Button>
    </div>
  );
}
