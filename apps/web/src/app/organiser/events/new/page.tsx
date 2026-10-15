import { redirect } from 'next/navigation';
import { EventForm } from '@/components/events/EventForm';
import { emptyEvent } from '@/components/events/eventValues';
import { PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { loadAreas } from '@/lib/events/load';

export const dynamic = 'force-dynamic';

export default async function NewOrganiserEvent({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { supabase } = await requireProfile('/organiser/events/new');
  const { org } = await searchParams;
  const [areas, { data: orgs }] = await Promise.all([
    loadAreas(supabase),
    supabase.from('organisations').select('id, name').eq('status', 'verified').order('name'),
  ]);
  if (!orgs?.length) redirect('/organiser');
  return (
    <>
      <PageTitle lead="Save a draft, then submit it. The RunLime team checks every event before it goes live.">New event</PageTitle>
      <EventForm initial={emptyEvent('organiser', org ?? orgs[0]!.id)} areas={areas} organisations={orgs} back="/organiser/events" />
    </>
  );
}
