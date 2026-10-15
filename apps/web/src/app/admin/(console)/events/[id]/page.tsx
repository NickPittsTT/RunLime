import { STATUS_LABEL, formatEventDate, formatEventTime } from '@runlime/shared/events';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventForm } from '@/components/events/EventForm';
import { DuplicatePanel, ReviewPanel, StatusChangePanel } from '@/components/events/EventPanels';
import { Notice, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { loadAreas, loadEvent, toFormValues } from '@/lib/events/load';

export default async function AdminEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(`/admin/events/${id}`);
  const e = await loadEvent(supabase, id);
  if (!e) notFound();
  const [areas, { data: changes }, { data: dups }] = await Promise.all([
    loadAreas(supabase),
    supabase.from('event_changes').select('field, old_value, new_value, changed_at').eq('event_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase
      .from('duplicate_candidates')
      .select('event_id, other_event_id, similarity')
      .or(`event_id.eq.${id},other_event_id.eq.${id}`)
      .is('resolved_at', null),
  ]);
  const otherIds = (dups ?? []).map((d) => (d.event_id === id ? d.other_event_id : d.event_id));
  const { data: others } = otherIds.length ? await supabase.from('events').select('id, name, starts_at, timezone').in('id', otherIds) : { data: [] };

  return (
    <>
      <PageTitle lead={`${formatEventDate(e.starts_at, e.timezone)} · ${formatEventTime(e.starts_at, e.timezone)} · ${STATUS_LABEL[e.status] ?? e.status}`}>
        {e.name}
      </PageTitle>
      {sp.saved && <Notice tone="success">Saved.</Notice>}
      {sp.duplicated && <Notice tone="success">Draft copy created. Check the details, then publish.</Notice>}
      {e.status_reason && <Notice tone="warning">Reason on record: {e.status_reason}</Notice>}
      {(others ?? []).length > 0 && (
        <Notice tone="warning">
          Possible duplicate of:{' '}
          {(others ?? []).map((o) => (
            <Link key={o.id} href={`/admin/events/${o.id}`} className="underline mr-2">
              {o.name} ({formatEventDate(o.starts_at, o.timezone)})
            </Link>
          ))}
        </Notice>
      )}
      {['published', 'postponed', 'cancelled'].includes(e.status) && (
        <p className="mb-6">
          <Link href={`/e/${e.slug}`} className="underline">
            View public page
          </Link>
        </p>
      )}
      <div className="grid lg:grid-cols-[1fr_20rem] gap-8">
        <EventForm initial={toFormValues(e)} areas={areas} back="/admin/events" />
        <aside>
          <ReviewPanel id={e.id} status={e.status} />
          <StatusChangePanel id={e.id} status={e.status} timezone={e.timezone} back={`/admin/events/${e.id}`} />
          <DuplicatePanel id={e.id} timezone={e.timezone} back="/admin/events" />
          <section className="rounded-xl border border-line p-5">
            <h2 className="text-lg font-bold mb-3">Change history</h2>
            {(changes ?? []).length === 0 && <p className="text-sm text-ink-muted">No changes yet.</p>}
            <ul className="text-sm space-y-2">
              {(changes ?? []).map((c, i) => (
                <li key={i}>
                  <strong>{c.field}</strong>: {c.old_value ?? '—'} → {c.new_value ?? '—'}
                  <div className="text-ink-muted">{new Date(c.changed_at).toLocaleString('en-TT', { timeZone: 'America/Port_of_Spain' })}</div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
