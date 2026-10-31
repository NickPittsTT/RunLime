'use client';
import { PRECISION_LABEL, distanceM } from '@runlime/shared/location';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { setCheckinAreaAction } from '@/lib/events/checkin-actions';
import type { EventRow } from '@/lib/events/load';

/** Admin: GPS check-in for this race (Phase 4): pin status, optional finish pin, radius override, count. */
export function CheckinPanel({ event: e, count }: { event: EventRow; count: number }) {
  const [state, action, pending] = useActionState(setCheckinAreaAction, {});
  const away = e.geocoded_lat !== null && e.geocoded_lng !== null ? Math.round(distanceM(e.start_lat, e.start_lng, e.geocoded_lat, e.geocoded_lng)) : null;
  return (
    <section className="rounded-xl border border-line p-5 mb-6" aria-labelledby={`ci-${e.id}`}>
      <h2 id={`ci-${e.id}`} className="text-lg font-bold mb-2">
        GPS check-in
      </h2>
      <ul className="text-sm mb-3 space-y-1">
        <li>Checked in: <strong data-testid="checkin-count">{count}</strong></li>
        <li>On the start line: {e.pin_start_line_at ? 'confirmed' : 'not confirmed yet'} · Pin checked: {e.pin_checked_at ? 'yes' : 'not yet'}</li>
        {e.geocode_precision && <li>Venue search: {PRECISION_LABEL[e.geocode_precision]}{away !== null ? ` · the pin is ${away} m from the address found` : ''}</li>}
        <li>
          <Link href={`/admin/checkins?event=${e.id}`}>Failed attempts and help requests for this race</Link>
        </li>
      </ul>
      {away !== null && away > 1000 && <Notice tone="danger">The pin is more than 1 km from the address the venue search found. Check it before publishing.</Notice>}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <form action={action}>
        <input type="hidden" name="id" value={e.id} />
        <Field label="Check-in radius in metres (empty = the standard setting)" htmlFor={`ci-r-${e.id}`}>
          <Input id={`ci-r-${e.id}`} name="radius" type="number" min={50} max={5000} defaultValue={e.checkin_radius_m ?? ''} />
        </Field>
        <p className="text-sm font-semibold mb-1">Finish pin (optional; check-in also works near it)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Finish latitude" htmlFor={`ci-flat-${e.id}`}>
            <Input id={`ci-flat-${e.id}`} name="finishLat" type="number" step="any" defaultValue={e.finish_lat ?? ''} />
          </Field>
          <Field label="Finish longitude" htmlFor={`ci-flng-${e.id}`}>
            <Input id={`ci-flng-${e.id}`} name="finishLng" type="number" step="any" defaultValue={e.finish_lng ?? ''} />
          </Field>
        </div>
        <p className="text-sm text-ink-muted mb-3">Saving re-tests this race&apos;s failed check-ins; any that now pass are approved and marked &quot;approved after correction&quot;.</p>
        <Button type="submit" variant="secondary" disabled={pending}>
          Save check-in area
        </Button>
      </form>
    </section>
  );
}
