import { EventForm, emptyEvent } from '@/components/events/EventForm';
import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { loadAreas } from '@/lib/events/load';

export default async function NewAdminEvent({ searchParams }: { searchParams: Promise<{ type?: string; suggestion?: string }> }) {
  const { supabase } = await requireAdmin('/admin/events/new');
  const { type, suggestion } = await searchParams;
  const source = type === 'organiser' ? 'organiser' : 'runlime';
  const [areas, { data: orgs }, { data: sug }] = await Promise.all([
    loadAreas(supabase),
    supabase.from('organisations').select('id, name').eq('status', 'verified').order('name'),
    suggestion
      ? supabase.from('race_suggestions').select('name, url, location, event_date').eq('id', suggestion).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const initial = emptyEvent(source);
  if (sug) {
    initial.name = sug.name;
    initial.registrationUrl = sug.url ?? '';
    initial.venueName = sug.location ?? '';
    if (sug.event_date) initial.startsLocal = `${sug.event_date}T06:00`;
  }
  return (
    <>
      <PageTitle lead={source === 'runlime' ? 'A fact-only listing for a real race, entered by RunLime.' : 'Create an event on behalf of a verified organiser.'}>
        {source === 'runlime' ? 'New RunLime listing' : 'New event for an organiser'}
      </PageTitle>
      <EventForm initial={initial} areas={areas} organisations={orgs ?? []} back="/admin/events" suggestionId={suggestion} />
    </>
  );
}
