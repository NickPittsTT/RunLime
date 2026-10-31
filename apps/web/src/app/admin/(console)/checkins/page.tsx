import Link from 'next/link';
import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { CheckinDecision } from './CheckinDecision';

interface QueueRow {
  kind: 'help' | 'attempt';
  id: string;
  event_id: string;
  event_name: string;
  user_id: string;
  display_name: string;
  created_at: string;
  reason: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  note: string | null;
  status: string;
}

const REASON: Record<string, string> = { too_far: 'Too far from the pin', too_early: 'Before check-in opened', too_late: 'After check-in closed', not_live: 'Race not live' };
const when = (iso: string) => new Intl.DateTimeFormat('en-TT', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Port_of_Spain' }).format(new Date(iso));

/** "I'm here but can't check in" requests (all races), and a race's failed attempts (Phase 4). */
export default async function Checkins({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const { supabase } = await requireAdmin('/admin/checkins');
  const { data } = await supabase.rpc('admin_checkin_queue', { p_event: event ?? null });
  const rows = (data ?? []) as QueueRow[];
  const help = rows.filter((r) => r.kind === 'help');
  const attempts = rows.filter((r) => r.kind === 'attempt');
  return (
    <>
      <PageTitle lead="Runners who say they're at a race but couldn't check in. Approve only with a reason (for example, confirmed by the organiser). Locations are rounded to about 100 m and deleted after 30 days.">
        GPS check-ins
      </PageTitle>
      {event && (
        <p className="mb-4">
          <Link href={`/admin/events/${event}`}>Back to the race</Link> · <Link href="/admin/checkins">All help requests</Link>
        </p>
      )}
      <h2 className="text-xl font-bold mb-3">Help requests ({help.length})</h2>
      {help.length === 0 && <p className="text-ink-muted mb-6">None waiting.</p>}
      <ul className="divide-y divide-line mb-8">
        {help.map((r) => (
          <li key={r.id} className="py-4" data-testid="checkin-help">
            <p className="m-0 font-semibold">
              {r.display_name} · <Link href={`/admin/events/${r.event_id}`}>{r.event_name}</Link>
            </p>
            <p className="m-0 text-sm text-ink-muted">
              {when(r.created_at)} · Last attempt: {r.reason ? REASON[r.reason] : 'none'}
              {r.distance_m !== null ? ` · ${r.distance_m} m from the pin` : ''}
              {r.accuracy_m !== null ? ` (phone accuracy ±${r.accuracy_m} m)` : ''}
            </p>
            {r.note && <p className="m-0 mt-1">&ldquo;{r.note}&rdquo;</p>}
            <CheckinDecision requestId={r.id} userId={r.user_id} eventId={r.event_id} />
          </li>
        ))}
      </ul>
      {event && (
        <>
          <h2 className="text-xl font-bold mb-3">Failed attempts for this race ({attempts.length})</h2>
          <p className="text-sm text-ink-muted mb-3">If many runners fail from the same spot, the pin or radius is probably wrong: fix it on the race page and these are re-tested automatically.</p>
          <ul className="divide-y divide-line">
            {attempts.map((r) => (
              <li key={r.id} className="py-2 text-sm" data-testid="checkin-attempt">
                {when(r.created_at)} · {r.display_name} · {r.reason ? REASON[r.reason] : ''}
                {r.distance_m !== null ? ` · ${r.distance_m} m` : ''}
                {r.accuracy_m !== null ? ` (±${r.accuracy_m} m)` : ''} · {r.status === 'resolved' ? 'approved after correction' : 'not checked in'}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
