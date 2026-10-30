import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { removeMember } from './actions';
import { AddMemberForm, OrgDetailsForm } from './OrgForms';

export const dynamic = 'force-dynamic';

export default async function OrgSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org: orgId } = await params;
  const { supabase, user, roles } = await requireProfile(`/organiser/settings/${orgId}`);
  const { data: org } = await supabase.from('organisations').select('id, name, status, contact_email, contact_phone, website, about').eq('id', orgId).maybeSingle();
  if (!org) notFound();
  const { data: team } = await supabase.rpc('organisation_team', { p_org: orgId });
  const members = (team ?? []) as { user_id: string; display_name: string; role: 'owner' | 'manager' }[];
  const iAmOwner = members.some((m) => m.user_id === user.id && m.role === 'owner');
  // Owners manage the team; RunLime admins can too (the server also requires their MFA).
  const canManageTeam = iAmOwner || roles.includes('platform_admin') || roles.includes('super_admin');
  const owners = members.filter((m) => m.role === 'owner').map((m) => m.display_name);
  return (
    <>
      <p className="mb-2">
        <Link href="/organiser" className="underline">
          ← Organiser portal
        </Link>
      </p>
      <PageTitle lead="Your contact details are shown to the RunLime team and on your event pages if you choose to add them there.">{org.name}</PageTitle>
      <OrgDetailsForm org={org} />
      <section className="mt-10 max-w-xl">
        <h2 className="text-xl font-bold mb-3">Team</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="py-2 flex justify-between gap-3">
              <span>
                {m.display_name}
                {m.user_id === user.id && ' (you)'} · {m.role}
              </span>
              {canManageTeam && m.user_id !== user.id && (
                <form action={removeMember}>
                  <input type="hidden" name="org" value={org.id} />
                  <input type="hidden" name="user" value={m.user_id} />
                  <button className="text-danger underline text-sm">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {canManageTeam ? (
          <AddMemberForm orgId={org.id} />
        ) : (
          <p className="text-sm text-ink-muted mt-3" data-testid="team-owner-only">
            Only the organisation&apos;s owners can add people to the team{owners.length ? ` (${owners.join(', ')})` : ''}. Ask an owner to add
            them by the email they use for RunLime.
          </p>
        )}
      </section>
    </>
  );
}
