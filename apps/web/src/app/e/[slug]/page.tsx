import { STATUS_LABEL, feeLabel, formatEventDate, formatEventTime, postponementInfo } from '@runlime/shared/events';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventMap } from '@/components/events/EventMap';
import { ShareButton } from '@/components/events/ShareButton';
import { Notice } from '@/components/ui';
import { eventMediaUrl } from '@/lib/media';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from('events')
    .select(
      'id, slug, name, description, starts_at, original_starts_at, timezone, status, status_reason, listing_source, venue_name, start_lat, start_lng, route, registration_url, registration_instructions, package_collection, parking, contact_email, contact_phone, cause, charity_name, walk_friendly, fee_min, fee_max, currency, regions!events_region_id_fkey(name), event_distances(distance_km, label), event_media(id, kind, storage_path, alt_text, sort), event_sponsors(id, name, url, sort)',
    )
    .eq('slug', slug)
    .in('status', ['published', 'postponed', 'cancelled'])
    .maybeSingle();
  return e;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const e = await load(slug);
  if (!e) return { title: 'Race not found' };
  const when = `${formatEventDate(e.starts_at, e.timezone)}, ${formatEventTime(e.starts_at, e.timezone)}`;
  return {
    title: e.name,
    description: `${when} · ${e.venue_name}. Race details on RunLime.`,
    openGraph: { title: e.name, description: `${when} · ${e.venue_name}`, type: 'website' },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [e, settings] = await Promise.all([load(slug), getPublicSettings()]);
  if (!e) notFound();
  const setting = (k: string) => {
    const v = settings.find((s) => s.key === k)?.value;
    return typeof v === 'string' ? v : null;
  };
  const minors = setting('legal.minors_notice');
  const unaffiliated = setting('events.unaffiliated_notice');
  const area = (e.regions as unknown as { name: string } | null)?.name;
  const media = [...(e.event_media ?? [])].sort((a, b) => a.sort - b.sort);
  const sponsors = [...(e.event_sponsors ?? [])].sort((a, b) => a.sort - b.sort);
  const isListing = e.listing_source === 'runlime';
  const postponed = postponementInfo(e);

  return (
    <article>
      {e.status !== 'published' && (
        <Notice tone={e.status === 'cancelled' ? 'danger' : 'warning'}>
          <strong>{STATUS_LABEL[e.status]}.</strong>
          {postponed && (
            <>
              {' '}
              <strong data-testid="postponed-to">{postponed.headline}.</strong> Original date: <s data-testid="original-date">{postponed.originalDate}</s>.
            </>
          )}{' '}
          {e.status_reason}
        </Notice>
      )}
      <h1 className="text-3xl font-bold mb-2">{e.name}</h1>
      <p className={`text-lg mb-1 ${postponed && !postponed.hasNewDate ? 'line-through' : ''}`}>
        {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)}
      </p>
      <p className="text-ink-muted mb-4">
        {e.venue_name}
        {area ? `, ${area}` : ''}
      </p>
      {isListing && unaffiliated && <Notice tone="info">{unaffiliated}</Notice>}

      <div className="flex flex-wrap gap-3 mb-6">
        {e.registration_url && (
          <a href={e.registration_url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-lg bg-leaf text-white px-5 py-3 font-semibold no-underline">
            Register with the organiser ↗
          </a>
        )}
        <a href={`/e/${e.slug}/calendar.ics`} className="rounded-lg border border-line px-5 py-3 font-semibold no-underline">
          Add to calendar
        </a>
        <ShareButton title={e.name} />
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-6">
        <div>
          <dt className="font-semibold">Distances</dt>
          <dd>{(e.event_distances ?? []).map((d) => d.label).join(' · ')}</dd>
        </div>
        <div>
          <dt className="font-semibold">Entry</dt>
          <dd>{feeLabel(e)} (paid to the organiser, not RunLime)</dd>
        </div>
        {e.walk_friendly && (
          <div>
            <dt className="font-semibold">Walkers</dt>
            <dd>Walkers welcome</dd>
          </div>
        )}
        {(e.cause || e.charity_name) && (
          <div>
            <dt className="font-semibold">Cause</dt>
            <dd>{[e.cause, e.charity_name].filter(Boolean).join(' · ')}</dd>
          </div>
        )}
      </dl>

      {minors && (
        <Notice tone="info">
          <strong>Children:</strong> {minors}
        </Notice>
      )}

      <EventMap lat={e.start_lat} lng={e.start_lng} route={e.route as [number, number][] | null} name={e.name} />

      {e.description && <p className="whitespace-pre-line my-6">{e.description}</p>}
      {[
        ['How to register', e.registration_instructions],
        ['Race-pack collection', e.package_collection],
        ['Parking', e.parking],
      ].map(([title, text]) =>
        text ? (
          <section key={title} className="my-5">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="whitespace-pre-line">{text}</p>
          </section>
        ) : null,
      )}
      {(e.contact_email || e.contact_phone) && (
        <section className="my-5">
          <h2 className="text-lg font-bold">Contact the organiser</h2>
          <p>
            {e.contact_email && <a href={`mailto:${e.contact_email}`}>{e.contact_email}</a>}
            {e.contact_email && e.contact_phone && ' · '}
            {e.contact_phone && <a href={`tel:${e.contact_phone.replace(/[^\d+]/g, '')}`}>{e.contact_phone}</a>}
          </p>
        </section>
      )}
      {media.length > 0 && (
        <section className="my-6">
          <h2 className="text-lg font-bold mb-3">Flyer and photos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {media.map((m) => (
              <a key={m.id} href={eventMediaUrl(m.storage_path)} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={eventMediaUrl(m.storage_path)} alt={m.alt_text} loading="lazy" className="w-full rounded-lg border border-line" />
              </a>
            ))}
          </div>
        </section>
      )}
      {sponsors.length > 0 && (
        <section className="my-6">
          <h2 className="text-lg font-bold mb-2">Sponsors</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {sponsors.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer sponsored">
                    {s.name}
                  </a>
                ) : (
                  s.name
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-ink-muted mt-10">
        RunLime does not take registrations, entry fees or official times. Results and timing come from the organiser.
      </p>
    </article>
  );
}
