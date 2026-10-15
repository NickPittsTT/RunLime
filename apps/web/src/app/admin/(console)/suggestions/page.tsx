import Link from 'next/link';
import { Button, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { dismissSuggestion } from './actions';

export default async function Suggestions() {
  const { supabase } = await requireAdmin('/admin/suggestions');
  const { data } = await supabase
    .from('race_suggestions')
    .select('id, name, event_date, location, url, notes, status, created_at, converted_event_id')
    .order('created_at', { ascending: false })
    .limit(200);
  const pending = (data ?? []).filter((s) => s.status === 'pending');
  const done = (data ?? []).filter((s) => s.status !== 'pending');
  return (
    <>
      <PageTitle lead="Races runners asked us to add. Check the facts with the organiser's public information before listing.">Race suggestions</PageTitle>
      {pending.length === 0 && <p className="text-ink-muted mb-8">No new suggestions.</p>}
      <ul className="divide-y divide-line mb-10">
        {pending.map((s) => (
          <li key={s.id} className="py-4">
            <div className="font-semibold">{s.name}</div>
            <div className="text-sm text-ink-muted">
              {s.event_date ?? 'date unknown'} · {s.location ?? 'location unknown'}
              {s.url && (
                <>
                  {' · '}
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                    link
                  </a>
                </>
              )}
            </div>
            {s.notes && <p className="text-sm mt-1">{s.notes}</p>}
            <div className="flex gap-3 mt-3">
              <Link className="rounded-lg bg-leaf text-white px-4 py-2 font-semibold" href={`/admin/events/new?type=runlime&suggestion=${s.id}`}>
                Create RunLime listing
              </Link>
              <form action={dismissSuggestion}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="secondary">
                  Dismiss
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Handled ({done.length})</summary>
          <ul className="mt-3 text-sm space-y-1">
            {done.map((s) => (
              <li key={s.id}>
                {s.name} — {s.status}
                {s.converted_event_id && (
                  <>
                    {' '}
                    <Link className="underline" href={`/admin/events/${s.converted_event_id}`}>
                      event
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
