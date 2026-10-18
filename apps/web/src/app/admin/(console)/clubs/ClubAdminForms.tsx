'use client';
import { useActionState } from 'react';
import { Button, Notice } from '@/components/ui';
import { reviewClubRequest, setClubLeader } from './actions';

export function ClubRequestReview({ id, leader }: { id: string; leader: string | null }) {
  const [state, action, pending] = useActionState(reviewClubRequest, {});
  return (
    <form action={action} className="mt-3 flex flex-wrap gap-3 items-end">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <input type="hidden" name="id" value={id} />
      <label className="flex gap-2 items-center min-h-11">
        <input type="checkbox" name="makeLeader" defaultChecked={leader !== null} disabled={leader === null} className="w-5 h-5" />{' '}
        {leader ? `Make ${leader} its first leader (they're notified)` : 'No leader proposed'}
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Reason (needed to reject)</span>
        <input name="note" maxLength={500} className="block border border-line rounded-lg px-3 py-2 min-h-11" />
      </label>
      <Button type="submit" name="decision" value="approve" disabled={pending}>
        Approve
      </Button>
      <Button type="submit" name="decision" value="reject" variant="secondary" disabled={pending}>
        Reject
      </Button>
    </form>
  );
}

export function LeaderForm({ clubId, leaders }: { clubId: string; leaders: { id: string; display_name: string }[] }) {
  const [state, action, pending] = useActionState(setClubLeader, {});
  return (
    <div className="mt-4">
      <h3 className="font-semibold">Leaders</h3>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <ul className="my-2">
        {leaders.length === 0 && <li className="text-ink-muted">No leader yet: join requests wait until one is appointed.</li>}
        {leaders.map((l) => (
          <li key={l.id} className="flex gap-3 items-center">
            {l.display_name}
            <form action={action}>
              <input type="hidden" name="clubId" value={clubId} />
              <input type="hidden" name="userId" value={l.id} />
              <input type="hidden" name="leader" value="false" />
              <button type="submit" className="underline text-sm min-h-11" disabled={pending}>
                Remove leader role
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action} className="flex flex-wrap gap-3 items-end">
        <input type="hidden" name="clubId" value={clubId} />
        <label className="block">
          <span className="text-sm font-semibold">Appoint a leader (account email)</span>
          <input name="email" type="email" className="block border border-line rounded-lg px-3 py-2 min-h-11" />
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>
          Appoint
        </Button>
      </form>
    </div>
  );
}
