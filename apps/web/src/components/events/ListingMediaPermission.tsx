'use client';
import { useActionState } from 'react';
import { Button, Notice } from '@/components/ui';
import { setMediaPermissionAction } from '@/lib/events/actions';

/** The tick an admin must record before a RunLime listing can show the organiser's flyer, logo or sponsors. */
export function ListingMediaPermission({ id, grantedAt }: { id: string; grantedAt: string | null }) {
  const [state, action, pending] = useActionState(setMediaPermissionAction, {});
  return (
    <form action={action} className="mb-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="id" value={id} />
      <label className="flex items-start gap-2 mb-3">
        <input type="checkbox" name="granted" defaultChecked={Boolean(grantedAt)} className="mt-1" />
        <span>I have the organiser&apos;s permission to use this image (and any logos or sponsor names I add).</span>
      </label>
      {grantedAt && (
        <p className="text-sm text-ink-muted mb-3">
          Recorded {new Date(grantedAt).toLocaleString('en-TT', { timeZone: 'America/Port_of_Spain' })}. Who ticked it is in the audit log.
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        Save permission
      </Button>
    </form>
  );
}
