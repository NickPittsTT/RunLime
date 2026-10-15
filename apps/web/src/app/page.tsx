import Link from 'next/link';
import { RaceList } from '@/components/calendar/RaceList';
import { fetchPublicEvents, upcomingWindow } from '@/lib/events/public';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { from, to } = upcomingWindow(120);
  const supabase = await createClient();
  const [events, { data: areas }] = await Promise.all([
    fetchPublicEvents(from, to),
    supabase.from('regions').select('id, name').eq('kind', 'area'),
  ]);
  const areaName = (id: string) => areas?.find((a) => a.id === id)?.name ?? '';
  return (
    <>
      <section className="rounded-2xl bg-forest text-white p-8 mb-8">
        <h1 className="text-4xl font-bold mb-3">
          Find the race. <span className="text-lime">Join the lime.</span>
        </h1>
        <p className="text-lg max-w-2xl">
          RunLime is the 5K race calendar and run tracker for Trinidad and Tobago. Discover races, get reminders, check in on race day
          and keep your own running history.
        </p>
      </section>
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-2xl font-bold">Upcoming races</h2>
          <Link href="/races">Full calendar →</Link>
        </div>
        <RaceList events={events.slice(0, 6)} areaName={areaName} />
      </section>
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-6">
          <h2 className="text-xl font-bold mb-2">Organising a race?</h2>
          <p className="mb-4">Apply for an organiser account to list your events once our team has verified you.</p>
          <Link href="/organiser" className="font-semibold">
            Go to the organiser portal →
          </Link>
        </div>
        <div className="rounded-xl border border-line p-6">
          <h2 className="text-xl font-bold mb-2">Adults 18+</h2>
          <p>
            RunLime accounts are for adults aged 18 and over. Children are welcome at events with an adult, who adds them to their group.
          </p>
        </div>
      </section>
    </>
  );
}
