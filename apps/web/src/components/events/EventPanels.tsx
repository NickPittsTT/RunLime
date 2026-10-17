'use client';
import { useActionState, useState, type FormEvent } from 'react';
import { Button, Field, Input, Notice, Select } from '@/components/ui';
import { ReasonField, reasonTooShort } from './ReasonField';
import { changeStatusAction, duplicateEventAction, reviewEventAction } from '@/lib/events/actions';

/** Postpone / cancel / reinstate a live event (organiser or admin). */
export function StatusChangePanel({ id, status, timezone, back }: { id: string; status: string; timezone: string; back: string }) {
  const [state, action, pending] = useActionState(changeStatusAction, {});
  const [reasonError, setReasonError] = useState<string>();
  const [dateError, setDateError] = useState<string>();
  const [next, setNext] = useState<string>(status === 'published' ? 'postponed' : status === 'postponed' ? 'postponed' : 'published');
  if (!['published', 'postponed', 'cancelled'].includes(status)) return null;
  // Postponing and cancelling need a reason runners will see; "back on" does not.
  const check = (e: FormEvent<HTMLFormElement>) => {
    const form = new FormData(e.currentTarget);
    const err = form.get('status') === 'published' ? undefined : reasonTooShort(e.currentTarget);
    const dErr = dateRequired && !form.get('newStartsLocal') ? 'Choose the new date and time.' : undefined;
    setReasonError(err);
    setDateError(dErr);
    if (err || dErr) e.preventDefault();
  };
  // Allowed changes (database enforces the same): published -> postponed/cancelled; postponed -> new date/cancelled/back on;
  // cancelled -> back on. "Back on" restores the original date.
  const options =
    status === 'published'
      ? [['postponed', 'Postpone'], ['cancelled', 'Cancel']]
      : status === 'postponed'
        ? [['postponed', 'Set or change the new date'], ['cancelled', 'Cancel'], ['published', 'Back on, on the original date']]
        : [['published', 'Back on, on the original date']];
  const dateRequired = status === 'postponed' && next === 'postponed';
  return (
    <form action={action} onSubmit={check} noValidate className="rounded-xl border border-line p-5 mb-6">
      <h2 className="text-lg font-bold mb-3">{status === 'published' ? 'Postpone or cancel' : 'Change status'}</h2>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="back" value={back} />
      <Field label="Change" htmlFor={`st-${id}`}>
        <Select id={`st-${id}`} name="status" value={next} onChange={(e) => setNext(e.target.value)}>
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      {next === 'postponed' && (
        <Field
          label={dateRequired ? 'New date and time' : 'New date and time (leave blank if not known yet)'}
          hint="Runners see “Postponed to” this date, with the original date struck through."
          htmlFor={`st-new-${id}`}
          error={dateError}
        >
          <Input id={`st-new-${id}`} type="datetime-local" name="newStartsLocal" required={dateRequired} />
        </Field>
      )}
      <ReasonField id={`st-reason-${id}`} label="Reason runners will see" error={reasonError} />
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
  const [reasonError, setReasonError] = useState<string>();
  // Reject and Unpublish need a reason.
  const check = (e: FormEvent<HTMLFormElement>) => {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const err = submitter && ['rejected', 'unpublished'].includes(submitter.value) ? reasonTooShort(e.currentTarget) : undefined;
    setReasonError(err);
    if (err) e.preventDefault();
  };
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
      <form action={action} onSubmit={check} noValidate>
        <input type="hidden" name="id" value={id} />
        <ReasonField id={`rv-reason-${id}`} label="Reason (required to reject or unpublish)" error={reasonError} />
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
