import type { Metadata } from 'next';
import { Notice, PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { ApplyForm } from './ApplyForm';

export const metadata: Metadata = { title: 'Organiser portal' };
export const dynamic = 'force-dynamic';

const STATUS_TEXT = {
  applied: { tone: 'info', text: 'Thanks! Your application is waiting for review by the RunLime team. We usually reply within 2 working days.' },
  verified: { tone: 'success', text: 'You are a verified organiser. Event creation opens in the next release of the portal.' },
  rejected: { tone: 'danger', text: 'Your application was not approved.' },
  suspended: { tone: 'warning', text: 'This organisation is suspended. Contact support if you think this is a mistake.' },
} as const;

export default async function OrganiserPage() {
  const { supabase } = await requireProfile('/organiser');
  const { data: orgs } = await supabase
    .from('organisations')
    .select('id, name, status, rejection_reason, created_at')
    .order('created_at', { ascending: false });
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
          </section>
        );
      })}
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
