import { STATUS_LABEL, feeLabel, formatEventDate, formatEventTime, postponementInfo, type CalendarEvent } from '@runlime/shared/events';
import Link from 'next/link';

export function RaceList({ events, areaName }: { events: CalendarEvent[]; areaName: (id: string) => string }) {
  if (events.length === 0) return <p className="text-ink-muted">No races match. Try another month or fewer filters.</p>;
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => {
        const postponed = postponementInfo(e);
        return (
        <li key={e.id} className="py-4">
          <Link href={`/e/${e.slug}`} className="text-lg font-semibold">
            {e.name}
          </Link>
          {e.status !== 'published' && (
            <span className={`ml-2 rounded px-2 py-0.5 text-sm font-semibold ${e.status === 'cancelled' ? 'bg-red-50 text-danger' : 'bg-amber-50 text-warning'}`}>
              {STATUS_LABEL[e.status]}
            </span>
          )}
          {postponed && (
            <div className="text-warning font-semibold">
              {postponed.headline} · was <s>{postponed.originalDate}</s>
            </div>
          )}
          <div className={`text-ink-muted ${postponed && !postponed.hasNewDate ? 'line-through' : ''}`}>
            {formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)} · {e.venue_name}, {areaName(e.region_id)}
          </div>
          <div className="text-sm mt-1">
            {e.distances.map((d) => d.label).join(' · ')} · {feeLabel(e)}
            {e.walk_friendly && ' · Walkers welcome'}
            {e.listing_source === 'runlime' && <span className="text-ink-muted"> · Listed by RunLime</span>}
          </div>
        </li>
        );
      })}
    </ul>
  );
}
