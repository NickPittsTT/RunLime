import { Button, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { setClubArchived } from './actions';
import { ClubForm } from './ClubForm';

export default async function ClubsAdmin() {
  const { supabase } = await requireAdmin('/admin/clubs');
  const [{ data: clubs }, { data: areas }, { data: counts }] = await Promise.all([
    supabase.from('clubs').select('id, name, description, region_id, archived_at').order('name'),
    supabase.from('regions').select('id, name').eq('kind', 'area').order('sort'),
    supabase.from('club_member_counts').select('club_id, member_count'),
  ]);
  const countOf = (id: string) => counts?.find((c) => c.club_id === id)?.member_count ?? 0;
  return (
    <>
      <PageTitle lead="Clubs are created by admins. Runners can join and choose to show their race attendance to club members.">Clubs</PageTitle>
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
