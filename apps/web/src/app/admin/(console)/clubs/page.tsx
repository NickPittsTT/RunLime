import { Button, Notice, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { setClubArchived } from './actions';
import { ClubRequestReview, LeaderForm } from './ClubAdminForms';
import { ClubForm } from './ClubForm';

const DONE: Record<string, string> = { approved: 'Club created.', rejected: 'Request rejected. The runner sees your reason.' };

export default async function ClubsAdmin({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const { supabase } = await requireAdmin('/admin/clubs');
  const [{ data: clubs }, { data: areas }, { data: counts }, { data: requests }, { data: leaderRows }] = await Promise.all([
    supabase.from('clubs').select('id, name, description, region_id, archived_at').order('name'),
    supabase.from('regions').select('id, name').eq('kind', 'area').order('sort'),
    supabase.from('club_member_counts').select('club_id, member_count'),
    supabase.rpc('admin_club_requests'),
    supabase.from('club_members').select('club_id, user_id').eq('role', 'leader'),
  ]);
  const leaderIds = [...new Set((leaderRows ?? []).map((l) => l.user_id as string))];
  const { data: people } = leaderIds.length ? await supabase.rpc('admin_list_users', { p_search: null, p_limit: 200, p_offset: 0 }) : { data: [] };
  const nameOf = (id: string) => ((people ?? []) as { id: string; display_name: string }[]).find((p) => p.id === id)?.display_name ?? 'Unknown';
  const leadersOf = (clubId: string) => (leaderRows ?? []).filter((l) => l.club_id === clubId).map((l) => ({ id: l.user_id as string, display_name: nameOf(l.user_id as string) }));
  const countOf = (id: string) => counts?.find((c) => c.club_id === id)?.member_count ?? 0;
  return (
    <>
      <PageTitle lead="Runners ask to join; each club's leaders approve members. Runners can ask for a new club, which you approve here. Club turnout on race pages shows counts only.">Clubs</PageTitle>
      {done && DONE[done] && <Notice tone="success">{DONE[done]}</Notice>}
      <section className="mb-8" aria-labelledby="club-requests">
        <h2 id="club-requests" className="text-xl font-bold mb-2">New-club requests</h2>
        {(requests ?? []).length === 0 && <p className="text-ink-muted">No requests waiting.</p>}
        {((requests ?? []) as { id: string; name: string; description: string | null; area: string | null; requester: string | null; proposed_leader: string | null; leader_is_requester: boolean | null }[]).map((r) => (
          <div key={r.id} data-testid="club-request" className="rounded-xl border border-line p-4 mb-3">
            <div className="font-semibold">{r.name}</div>
            <div className="text-sm text-ink-muted">
              {[r.area, r.requester ? `asked by ${r.requester}` : null].filter(Boolean).join(' · ')}
            </div>
            {r.description && <p className="text-sm mt-1 mb-0">{r.description}</p>}
            <p className="text-sm mt-1 mb-0" data-testid="proposed-leader">
              Proposed leader: <strong>{r.proposed_leader ?? 'none'}</strong>
              {r.proposed_leader ? (r.leader_is_requester ? ' (the requester)' : ' (named by the requester; they join as a member)') : ''}
            </p>
            <ClubRequestReview id={r.id} leader={r.proposed_leader} />
          </div>
        ))}
      </section>
      <section className="rounded-xl border border-line p-6 mb-8 max-w-xl">
        <h2 className="text-xl font-bold mb-4">New club</h2>
        <ClubForm areas={areas ?? []} />
      </section>
      {(clubs ?? []).map((c) => (
        <details key={c.id} className="rounded-xl border border-line p-4 mb-4">
          <summary className="cursor-pointer font-semibold">
            {c.name} · {countOf(c.id)} members {c.archived_at && <span className="text-ink-muted">(archived)</span>}
          </summary>
          <div className="mt-4 max-w-xl">
            <ClubForm club={c} areas={areas ?? []} />
            <LeaderForm clubId={c.id} leaders={leadersOf(c.id)} />
            <form action={setClubArchived} className="mt-4">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="archive" value={String(!c.archived_at)} />
              <Button type="submit" variant="secondary">
                {c.archived_at ? 'Restore club' : 'Archive club'}
              </Button>
            </form>
          </div>
        </details>
      ))}
    </>
  );
}
