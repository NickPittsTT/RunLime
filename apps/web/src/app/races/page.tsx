import { DISTANCE_CHOICES, addMonths, eventsByDay, filterEvents, todayKey, zonedLocalToIso, type EventFilters } from '@runlime/shared/events';
import type { Metadata } from 'next';
import { MonthCalendar } from '@/components/calendar/MonthCalendar';
import { RaceList } from '@/components/calendar/RaceList';
import { Button, Input, Select } from '@/components/ui';
import { fetchPublicEvents } from '@/lib/events/public';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Race calendar', description: '5K and road races in Trinidad and Tobago.' };
export const dynamic = 'force-dynamic';

const TZ = 'America/Port_of_Spain';
type SP = { month?: string; day?: string; area?: string; distance?: string; free?: string; walk?: string; cause?: string; q?: string };

export default async function Races({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const today = todayKey(TZ);
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  const m = /^(\d{4})-(\d{2})$/.exec(sp.month ?? '');
  const ym = m ? { year: Number(m[1]), month: Number(m[2]) } : { year: ty, month: tm };
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = `${ym.year}-${pad(ym.month)}-01`;
  const nextM = addMonths(ym, 1);
  const monthEndExcl = `${nextM.year}-${pad(nextM.month)}-01`;

  const supabase = await createClient();
  const [events, { data: areas }] = await Promise.all([
    fetchPublicEvents(zonedLocalToIso(`${monthStart}T00:00`, TZ), zonedLocalToIso(`${monthEndExcl}T00:00`, TZ)),
    supabase.from('regions').select('id, name').eq('kind', 'area').order('sort'),
  ]);
  const filters: EventFilters = {
    regionIds: sp.area ? [sp.area] : undefined,
    distanceKm: sp.distance !== undefined && sp.distance !== '' && Number.isFinite(Number(sp.distance)) ? [Number(sp.distance)] : undefined,
    maxFee: sp.free ? 0 : undefined,
    walkFriendly: Boolean(sp.walk),
    cause: Boolean(sp.cause),
    text: sp.q,
  };
  const filtered = filterEvents(events, filters);
  const byDay = eventsByDay(filtered);
  const day = sp.day && byDay.has(sp.day) ? sp.day : undefined;
  const listed = day ? (byDay.get(day) ?? []) : filtered.filter((e) => e.starts_at >= zonedLocalToIso(`${today}T00:00`, TZ) || ym.month !== tm || ym.year !== ty);

  const hrefFor = (p: { month?: string; day?: string | null }) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...sp, month: p.month ?? sp.month, day: p.day === null ? undefined : (p.day ?? sp.day) };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/races${q.size ? `?${q}` : ''}`;
  };
  const areaName = (id: string) => areas?.find((a) => a.id === id)?.name ?? '';

  return (
    <>
      <h1 className="text-3xl font-bold mb-2">Race calendar</h1>
      <p className="text-ink-muted mb-6">5K and road races in Trinidad and Tobago. RunLime lists races; register with each organiser.</p>
      <MonthCalendar year={ym.year} month={ym.month} byDay={byDay} hrefFor={hrefFor} selectedDay={day} todayKey={today} />

      <form method="get" action="/races" className="rounded-xl border border-line p-4 mb-6 grid gap-3 sm:grid-cols-3" aria-label="Filter races">
        <input type="hidden" name="month" value={`${ym.year}-${pad(ym.month)}`} />
        <label className="block">
          <span className="text-sm font-semibold">Search</span>
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Race or venue" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Area</span>
          <Select name="area" defaultValue={sp.area ?? ''}>
            <option value="">All areas</option>
            {(areas ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Distance</span>
          <Select name="distance" defaultValue={sp.distance ?? ''}>
            <option value="">Any</option>
            {DISTANCE_CHOICES.map((d) => (
              <option key={d.km} value={String(d.km)}>
                {d.label}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex flex-wrap gap-4 items-center sm:col-span-2">
          <label className="flex gap-2 items-center">
            <input type="checkbox" name="free" value="1" defaultChecked={Boolean(sp.free)} className="w-5 h-5" /> Free
          </label>
          <label className="flex gap-2 items-center">
            <input type="checkbox" name="walk" value="1" defaultChecked={Boolean(sp.walk)} className="w-5 h-5" /> Walkers welcome
          </label>
          <label className="flex gap-2 items-center">
            <input type="checkbox" name="cause" value="1" defaultChecked={Boolean(sp.cause)} className="w-5 h-5" /> Charity / cause
          </label>
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>

      <h2 className="text-xl font-bold mb-2">{day ? `Races on ${day}` : 'Upcoming races this month'}</h2>
      <RaceList events={listed} areaName={areaName} />
    </>
  );
}
