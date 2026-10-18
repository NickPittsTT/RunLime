'use client';
import { useActionState, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { sendEventMessageAction } from '@/lib/events/actions';

/** Organiser update to people going (or maybe). Race updates only; limited per race per week (setting). */
export function MessagePanel({ eventId, back, sentThisWeek, limit, history }: { eventId: string; back: string; sentThisWeek: number; limit: number; history: { id: string; body: string; recipients: number; created_at: string }[] }) {
  const [state, action, pending] = useActionState(sendEventMessageAction, {});
  const [text, setText] = useState('');
  const left = Math.max(0, limit - sentThisWeek);
  return (
    <section className="rounded-xl border border-line p-5 mb-6" aria-labelledby={`msg-${eventId}`}>
      <h2 id={`msg-${eventId}`} className="text-lg font-bold mb-1">
        Message people going
      </h2>
      <p className="text-sm text-ink-muted mb-3">
        Race updates only (times, parking, race-pack collection). No advertising. Goes to the RunLime inbox of everyone who said Going or Maybe. {left} of {limit} left in the last 7 days.
      </p>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <form action={action} onSubmit={() => setTimeout(() => setText(''), 0)}>
        <input type="hidden" name="id" value={eventId} />
        <input type="hidden" name="back" value={back} />
        <label htmlFor={`msg-body-${eventId}`} className="block font-semibold mb-1">
          Message
        </label>
        <textarea
          id={`msg-body-${eventId}`}
          name="body"
          rows={3}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Minimum 5 characters"
          className="block w-full border border-line rounded-lg px-3 py-2"
        />
        <p className="text-sm text-ink-muted m-0 mb-3">{text.trim().length} / 500 characters</p>
        <Button type="submit" variant="secondary" disabled={pending || left === 0 || text.trim().length < 5}>
          Send update
        </Button>
      </form>
      {history.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer">Sent ({history.length})</summary>
          <ul className="mt-2 space-y-2">
            {history.map((m) => (
              <li key={m.id}>
                <span className="text-ink-muted">
                  {new Intl.DateTimeFormat('en-TT', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Port_of_Spain' }).format(new Date(m.created_at))} · to {m.recipients}
                </span>
                <br />
                {m.body}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
