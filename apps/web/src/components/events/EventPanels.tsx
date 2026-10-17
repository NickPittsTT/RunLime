'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { changeStatusAction, duplicateEventAction, reviewEventAction } from '@/lib/events/actions';

/** Postpone / cancel / reinstate a live event (organiser or admin). */
export function StatusChangePanel({ id, status, timezone, back }: { id: string; status: string; timezone: string; back: string }) {
  const [state, action, pending] = useActionState(changeStatusAction, {});
  if (!['published', 'postponed', 'cancelled'].includes(status)) return null;
  // Allowed changes (database enforces the same): published -> postponed/cancelled; postponed -> cancelled/back on; cancelled -> back on.
  const options =
    status === 'published'
      ? [['postponed', 'Postpone'], ['cancelled', 'Cancel']]
      : status === 'postponed'
        ? [['cancelled', 'Cancel'], ['published', 'Back on (no longer postponed)']]
        : [['published', 'Back on (no longer cancelled)']];
  return (
    <form action={action} className="rounded-xl border border-line p-5 mb-6">
      <h2 className="text-lg font-bold mb-3">{status === 'published' ? 'Postpone or cancel' : 'Change status'}</h2>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="back" value={back} />
      <Field label="Change" htmlFor={`st-${id}`}>
        <Select id={`st-${id}`} name="status" defaultValue={options[0]![0]}>
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="New date and time (if postponing to a known date)" htmlFor={`st-new-${id}`}>
        <Input id={`st-new-${id}`} type="datetime-local" name="newStartsLocal" />
      </Field>
      <Field label="Reason runners will see" htmlFor={`st-reason-${id}`}>
        <Textarea id={`st-reason-${id}`} name="reason" rows={2} maxLength={500} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Update status
      </Button>
    </form>
  );
}

export function DuplicatePanel({ id, timezone, back }: { id: string; timezone: string; back: string }) {
  const [state, action, pending] = useActionState(duplicateEventAction, {});
  return (
    <form action={action} className="rounded-xl border border-line p-5 mb-6">
      <h2 className="text-lg font-bold mb-3">Duplicate (e.g. next year&apos;s race)</h2>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="back" value={back} />
      <Field label="Date and start time of the new race" htmlFor={`dup-${id}`}>
        <Input id={`dup-${id}`} type="datetime-local" name="newStartsLocal" required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Create a draft copy
      </Button>
    </form>
  );
}

/** Admin: publish / reject / unpublish. */
export function ReviewPanel({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(reviewEventAction, {});
  return (
    <div className="rounded-xl border border-line p-5 mb-6">
      <h2 className="text-lg font-bold mb-3">Review</h2>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      {/* Publish is for races that are not live yet. Postponed/cancelled races change back only through "Change status". */}
      {['draft', 'pending_approval', 'unpublished', 'rejected'].includes(status) && (
        <form action={action} className="mb-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="published" />
          <Button type="submit" disabled={pending}>
            Publish
          </Button>
        </form>
      )}
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Field label="Reason (required to reject or unpublish)" htmlFor={`rv-reason-${id}`}>
          <Textarea id={`rv-reason-${id}`} name="reason" rows={2} maxLength={500} />
        </Field>
        <div className="flex gap-3 flex-wrap">
          {status === 'pending_approval' && (
            <Button type="submit" name="decision" value="rejected" variant="danger" disabled={pending}>
              Reject
            </Button>
          )}
          {['published', 'postponed', 'cancelled'].includes(status) && (
            <Button type="submit" name="decision" value="unpublished" variant="danger" disabled={pending}>
              Unpublish
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
