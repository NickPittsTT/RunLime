import { STATUS_LABEL, formatEventDate, formatEventTime } from '@runlime/shared/events';
import Link from 'next/link';
import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';

const FILTERS = ['pending_approval', 'published', 'postponed', 'cancelled', 'draft', 'rejected', 'unpublished'] as const;

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin('/admin/events');
  const { status = 'pending_approval' } = await searchParams;
  const current = (FILTERS as readonly string[]).includes(status) ? status : 'pending_approval';
  const [{ data: events }, { data: dups }] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, starts_at, timezone, status, listing_source, venue_name, organisations(name)')
      .eq('status', current)
      .order('starts_at', { ascending: current !== 'published' })
      .limit(200),
    supabase.from('duplicate_candidates').select('event_id, other_event_id, similarity').is('resolved_at', null),
  ]);
  const dupCount = (id: string) => (dups ?? []).filter((d) => d.event_id === id || d.other_event_id === id).length;

  return (
    <>
      <PageTitle lead="Approve organiser events and enter RunLime listings (public facts only).">Events</PageTitle>
      <section aria-labelledby="add-race" className="rounded-xl border-2 border-leaf bg-surface p-5 mb-4">
        <h2 id="add-race" className="text-lg font-bold mb-1">
          Add a race you found
        </h2>
        <p className="text-sm mb-3">Most races: enter the public facts and the official registration link. Runners see a &quot;not affiliated&quot; notice.</p>
        <Link className="inline-block rounded-lg bg-leaf text-white px-5 py-3 font-semibold no-underline" href="/admin/events/new?type=runlime">
          New RunLime listing
        </Link>
      </section>
      <section aria-labelledby="add-org-event" className="rounded-xl border border-line p-4 mb-8">
        <h2 id="add-org-event" className="text-base font-bold mb-1">
          Organiser events (less common)
        </h2>
        <p className="text-sm mb-3">
          Only for a <strong>verified organisation</strong> you manage on its behalf. No organisation yet?{' '}
          <Link href="/admin/organisers/new">Add organisation</Link> first.
        </p>
        <Link className="inline-block rounded-lg border border-line px-4 py-2 font-semibold text-sm" href="/admin/events/new?type=organiser">
          New event for an organiser
        </Link>
      </section>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/events?status=${f}`}
            aria-current={f === current ? 'page' : undefined}
            className={`rounded-full px-3 py-1 border ${f === current ? 'bg-forest text-white border-forest' : 'border-line'}`}
          >
            {STATUS_LABEL[f]}
          </Link>
        ))}
      </nav>
      {(events ?? []).length === 0 && <p className="text-ink-muted">No events here.</p>}
      <ul className="divide-y divide-line">
        {(events ?? []).map((e) => {
          const org = (e.organisations as unknown as { name: string } | null)?.name;
          const n = dupCount(e.id);
          return (
            <li key={e.id} className="py-3">
              <Link href={`/admin/events/${e.id}`} className="font-semibold">
                {e.name}
              </Link>
              <div className="text-sm text-ink-muted">
                {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)} · {e.venue_name} ·{' '}
                {e.listing_source === 'runlime' ? 'RunLime listing' : org}
                {n > 0 && <span className="ml-2 text-warning font-semibold">⚠ possible duplicate ({n})</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
