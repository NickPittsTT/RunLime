'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { approveCheckinAction, declineCheckinHelpAction } from '@/lib/events/checkin-actions';

export function CheckinDecision({ requestId, userId, eventId }: { requestId: string; userId: string; eventId: string }) {
  const [approved, approve, approving] = useActionState(approveCheckinAction, {});
  const [declined, decline, declining] = useActionState(declineCheckinHelpAction, {});
  const done = approved.ok ?? declined.ok;
  if (done) return <Notice tone="success">{done}</Notice>;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <form action={approve}>
        <input type="hidden" name="user" value={userId} />
        <input type="hidden" name="event" value={eventId} />
        <Field label="Reason for approving" htmlFor={`ap-${requestId}`}>
          <Input id={`ap-${requestId}`} name="reason" minLength={5} required placeholder="e.g. Confirmed by the race director" />
        </Field>
        {approved.error && <Notice tone="danger">{approved.error}</Notice>}
        <Button type="submit" disabled={approving}>
          Approve check-in
        </Button>
      </form>
      <form action={decline}>
        <input type="hidden" name="request" value={requestId} />
        <Field label="Reason for declining (the runner sees it)" htmlFor={`dc-${requestId}`}>
          <Input id={`dc-${requestId}`} name="reason" minLength={5} required />
        </Field>
        {declined.error && <Notice tone="danger">{declined.error}</Notice>}
        <Button type="submit" variant="danger" disabled={declining}>
          Decline
        </Button>
      </form>
    </div>
  );
}
