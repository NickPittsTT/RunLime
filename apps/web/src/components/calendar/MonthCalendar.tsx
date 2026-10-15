import { addMonths, monthGrid, monthLabel, type CalendarEvent } from '@runlime/shared/events';
import Link from 'next/link';
import { SwipeNav } from './SwipeNav';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month view (Monday first). Days with races are marked; tapping a day filters the list below. */
export function MonthCalendar({
  year,
  month,
  byDay,
  hrefFor,
  selectedDay,
  todayKey,
}: {
  year: number;
  month: number;
  byDay: Map<string, CalendarEvent[]>;
  hrefFor: (params: { month?: string; day?: string | null }) => string;
  selectedDay?: string;
  todayKey: string;
}) {
  const prev = addMonths({ year, month }, -1);
  const next = addMonths({ year, month }, 1);
  const ym = (v: { year: number; month: number }) => `${v.year}-${String(v.month).padStart(2, '0')}`;
  const prevHref = hrefFor({ month: ym(prev), day: null });
  const nextHref = hrefFor({ month: ym(next), day: null });
  return (
    <SwipeNav prevHref={prevHref} nextHref={nextHref}>
      <section aria-label={`Race calendar, ${monthLabel(year, month)}`} className="rounded-xl border border-line p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <Link href={prevHref} aria-label={`Previous month, ${monthLabel(prev.year, prev.month)}`} className="rounded-lg border border-line px-3 py-2 no-underline">
            ←
          </Link>
          <h2 className="text-xl font-bold">{monthLabel(year, month)}</h2>
          <Link href={nextHref} aria-label={`Next month, ${monthLabel(next.year, next.month)}`} className="rounded-lg border border-line px-3 py-2 no-underline">
            →
          </Link>
        </div>
        <table className="w-full table-fixed text-center">
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="text-xs font-semibold text-ink-muted pb-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(year, month).map((week, i) => (
              <tr key={i}>
                {week.map((c) => {
                  const races = byDay.get(c.key) ?? [];
                  const selected = c.key === selectedDay;
                  const label = `${c.day}${races.length ? `, ${races.length} race${races.length > 1 ? 's' : ''}` : ''}`;
                  return (
                    <td key={c.key} className="p-0.5">
                      {races.length > 0 && c.inMonth ? (
                        <Link
                          href={hrefFor({ day: selected ? null : c.key })}
                          aria-label={label}
                          aria-current={selected ? 'date' : undefined}
                          className={`block rounded-lg py-2 no-underline font-semibold ${selected ? 'bg-forest text-white' : 'bg-lime text-ink'}`}
                        >
                          {c.day}
                          <span aria-hidden className="block text-[10px] leading-none">
                            {'•'.repeat(Math.min(3, races.length))}
                          </span>
                        </Link>
                      ) : (
                        <span
                          className={`block py-2 rounded-lg ${c.inMonth ? '' : 'text-ink-muted/50'} ${c.key === todayKey ? 'ring-2 ring-leaf' : ''}`}
                          aria-label={c.inMonth ? label : undefined}
                        >
                          {c.day}
                          <span aria-hidden className="block text-[10px] leading-none">&nbsp;</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </SwipeNav>
  );
}
