import { STATUS_LABEL, formatEventDate, formatEventTime } from '@runlime/shared/events';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventForm } from '@/components/events/EventForm';
import { DuplicatePanel, ReviewPanel, StatusChangePanel } from '@/components/events/EventPanels';
import { ListingMediaPermission } from '@/components/events/ListingMediaPermission';
import { MediaUploader, SponsorForm } from '@/components/events/OrganiserTools';
import { StatusBanner } from '@/components/events/StatusBanner';
import { AttendancePanel } from '@/components/events/AttendancePanel';
import { removeMedia, removeSponsor } from '@/app/organiser/events/actions';
import { eventMediaUrl } from '@/lib/media';
import { Notice, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { loadAreas, loadEvent, toFormValues } from '@/lib/events/load';

export default async function AdminEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireAdmin(`/admin/events/${id}`);
  const e = await loadEvent(supabase, id);
  if (!e) notFound();
  const isListing = e.listing_source === 'runlime';
  const [areas, { data: changes }, { data: dups }, { data: media }, { data: sponsors }] = await Promise.all([
    loadAreas(supabase),
    supabase.from('event_changes').select('field, old_value, new_value, changed_at').eq('event_id', id).order('changed_at', { ascending: false }).limit(20),
    supabase
      .from('duplicate_candidates')
      .select('event_id, other_event_id, similarity')
      .or(`event_id.eq.${id},other_event_id.eq.${id}`)
      .is('resolved_at', null),
    supabase.from('event_media').select('id, kind, storage_path, alt_text').eq('event_id', id).order('sort'),
    supabase.from('event_sponsors').select('id, name').eq('event_id', id).order('sort'),
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
      <StatusBanner status={e.status} reason={e.status_reason} startsAt={e.starts_at} originalStartsAt={e.original_starts_at} timezone={e.timezone} />
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
      {['published', 'postponed', 'cancelled'].includes(e.status) && <AttendancePanel supabase={supabase} eventId={e.id} />}
      <div className="grid lg:grid-cols-[1fr_20rem] gap-8">
        <EventForm initial={toFormValues(e)} areas={areas} back="/admin/events" />
        <aside>
          <ReviewPanel id={e.id} status={e.status} />
          <StatusChangePanel id={e.id} status={e.status} timezone={e.timezone} back={`/admin/events/${e.id}`} />
          {isListing && (
            <section className="rounded-xl border border-line p-5 mb-6" aria-labelledby="listing-media">
              <h2 id="listing-media" className="text-lg font-bold mb-1">
                Organiser&apos;s flyer and sponsors
              </h2>
              <p className="text-sm text-ink-muted mb-3">RunLime listings show facts only, unless the organiser has given permission.</p>
              <ListingMediaPermission id={e.id} grantedAt={e.media_permission_at} />
              {e.media_permission_at && (
                <>
                  <ul className="space-y-3 mb-4">
                    {(media ?? []).map((m) => (
                      <li key={m.id} className="flex gap-3 items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={eventMediaUrl(m.storage_path)} alt={m.alt_text} className="w-16 h-16 object-cover rounded" />
                        <span className="text-sm flex-1">{m.alt_text}</span>
                        <form action={removeMedia}>
                          <input type="hidden" name="event" value={e.id} />
                          <input type="hidden" name="id" value={m.id} />
                          <button className="text-danger text-sm underline">Remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <MediaUploader eventId={e.id} allowPhotos={false} />
                  <h3 className="font-bold mt-5 mb-2">Sponsors</h3>
                  <ul className="space-y-2">
                    {(sponsors ?? []).map((s) => (
                      <li key={s.id} className="flex justify-between gap-3">
                        <span>{s.name}</span>
                        <form action={removeSponsor}>
                          <input type="hidden" name="event" value={e.id} />
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-danger text-sm underline">Remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <SponsorForm eventId={e.id} />
                </>
              )}
            </section>
          )}
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
