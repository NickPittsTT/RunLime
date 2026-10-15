import { STATUS_LABEL, formatEventDate } from '@runlime/shared/events';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { ApplyForm } from './ApplyForm';
import { acceptInvite } from './events/actions';

export const metadata: Metadata = { title: 'Organiser portal' };
export const dynamic = 'force-dynamic';

const STATUS_TEXT = {
  applied: { tone: 'info', text: 'Thanks! Your application is waiting for review by the RunLime team. We usually reply within 2 working days.' },
  verified: { tone: 'success', text: 'Verified organiser. Create events below; each one is checked by the RunLime team before it goes live.' },
  rejected: { tone: 'danger', text: 'Your application was not approved.' },
  suspended: { tone: 'warning', text: 'This organisation is suspended. Contact support if you think this is a mistake.' },
} as const;

export default async function OrganiserPage() {
  const { supabase, user } = await requireProfile('/organiser');
  const { data: orgs } = await supabase
    .from('organisations')
    .select('id, name, status, rejection_reason, created_at')
    .order('created_at', { ascending: false });
  const verifiedIds = (orgs ?? []).filter((o) => o.status === 'verified').map((o) => o.id);
  const [{ data: events }, { data: invites }] = await Promise.all([
    verifiedIds.length
      ? supabase.from('events').select('id, name, starts_at, timezone, status, organisation_id').in('organisation_id', verifiedIds).order('starts_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; name: string; starts_at: string; timezone: string; status: string; organisation_id: string }[] }),
    supabase.from('event_members').select('event_id, accepted_at, events(id, name, starts_at, timezone, status)').eq('user_id', user.id),
  ]);
  const hasPending = (orgs ?? []).some((o) => o.status === 'applied');
  const canApply = !hasPending && !(orgs ?? []).some((o) => o.status === 'verified');

  return (
    <>
      <PageTitle lead="List your races on the RunLime calendar.">Organiser portal</PageTitle>
      {(orgs ?? []).map((o) => {
        const s = STATUS_TEXT[o.status as keyof typeof STATUS_TEXT];
        return (
          <section key={o.id} className="rounded-xl border border-line p-6 mb-6">
            <h2 className="text-xl font-bold mb-3">{o.name}</h2>
            <Notice tone={s.tone}>
              {s.text}
              {o.rejection_reason && (
                <>
                  {' '}
                  Reason: <em>{o.rejection_reason}</em>
                </>
              )}
            </Notice>
            {o.status === 'verified' && (
              <>
                <div className="flex flex-wrap gap-3 mb-5">
                  <Link className="rounded-lg bg-leaf text-white px-4 py-3 font-semibold" href={`/organiser/events/new?org=${o.id}`}>
                    New event
                  </Link>
                  <Link className="rounded-lg border border-line px-4 py-3 font-semibold" href={`/organiser/settings/${o.id}`}>
                    Organisation settings
                  </Link>
                </div>
                <h3 className="font-bold mb-2">Your events</h3>
                {(events ?? []).filter((e) => e.organisation_id === o.id).length === 0 && <p className="text-ink-muted">No events yet.</p>}
                <ul className="divide-y divide-line">
                  {(events ?? [])
                    .filter((e) => e.organisation_id === o.id)
                    .map((e) => (
                      <li key={e.id} className="py-2 flex justify-between gap-3">
                        <Link href={`/organiser/events/${e.id}`} className="font-semibold">
                          {e.name}
                        </Link>
                        <span className="text-sm text-ink-muted">
                          {formatEventDate(e.starts_at, e.timezone)} · {STATUS_LABEL[e.status] ?? e.status}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
      {(invites ?? []).length > 0 && (
        <section className="rounded-xl border border-line p-6 mb-6">
          <h2 className="text-xl font-bold mb-3">Events you co-organise</h2>
          <ul className="divide-y divide-line">
            {(invites ?? []).map((i) => {
              const ev = i.events as unknown as { id: string; name: string; starts_at: string; timezone: string; status: string } | null;
              if (!ev) return null;
              return (
                <li key={i.event_id} className="py-2 flex justify-between gap-3 items-center">
                  <span>
                    {i.accepted_at ? <Link href={`/organiser/events/${ev.id}`}>{ev.name}</Link> : ev.name} · {formatEventDate(ev.starts_at, ev.timezone)}
                  </span>
                  {!i.accepted_at && (
                    <form action={acceptInvite}>
                      <input type="hidden" name="event" value={i.event_id} />
                      <button className="rounded-lg bg-leaf text-white px-4 py-2 font-semibold">Accept invitation</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {canApply && (
        <section>
          <h2 className="text-2xl font-bold mb-4">Apply for an organiser account</h2>
          <p className="mb-6">Our team checks every organiser before their events can go live.</p>
          <ApplyForm />
        </section>
      )}
    </>
  );
}
