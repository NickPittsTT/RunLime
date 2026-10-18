import { REPORT_CATEGORIES, avatarUrl } from '@runlime/shared/community';
import Link from 'next/link';
import { Notice, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { ReportActions } from './ReportActions';

const TARGET: Record<string, string> = {
  profile_photo: 'Profile photo',
  profile: 'Profile',
  club: 'Club',
  event: 'Race listing',
  general: 'Safety concern',
};
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-TT', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Port_of_Spain' }).format(new Date(iso));

interface ReportRow {
  id: string;
  category: string;
  target_kind: string;
  target_user_id: string | null;
  target_name: string | null;
  target_ref: string | null;
  current_avatar_path: string | null;
  details: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  reports_against_user: number;
}

/** Moderation queue (Play UGC + Child Safety Standards). Child-safety reports first; target: review within 48 hours. */
const DONE: Record<string, string> = {
  photo: 'Photo removed and the report closed.',
  dismissed: 'Report dismissed.',
  actioned: 'Report closed as handled.',
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string; done?: string }> }) {
  const { status: s, done } = await searchParams;
  const status = s === 'actioned' || s === 'dismissed' ? s : 'open';
  const { supabase } = await requireAdmin('/admin/reports');
  const { data } = await supabase.rpc('admin_reports', { p_status: status });
  const rows = (data ?? []) as ReportRow[];
  const label = (c: string) => REPORT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
  return (
    <>
      <PageTitle lead="Reports from runners about photos, profiles, clubs and safety. Review within 48 hours; child-safety reports first. Reporters are never shown to the person reported.">
        Reports
      </PageTitle>
      {done && DONE[done] && <Notice tone="success">{DONE[done]}</Notice>}
      <nav aria-label="Report status" className="flex gap-4 mb-6">
        {(['open', 'actioned', 'dismissed'] as const).map((k) => (
          <Link key={k} href={`/admin/reports${k === 'open' ? '' : `?status=${k}`}`} aria-current={k === status ? 'page' : undefined} className={k === status ? 'font-bold underline' : ''}>
            {k === 'open' ? 'Open' : k === 'actioned' ? 'Handled' : 'Dismissed'}
          </Link>
        ))}
      </nav>
      {rows.length === 0 && <p className="text-ink-muted">{status === 'open' ? 'No open reports.' : 'Nothing here yet.'}</p>}
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const photo = r.target_kind === 'profile_photo' && r.current_avatar_path && r.current_avatar_path === r.target_ref ? r.current_avatar_path : null;
          return (
            <li key={r.id} className="py-5" data-testid="report">
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`rounded px-2 py-0.5 text-sm font-semibold ${r.category === 'child_safety' ? 'bg-red-50 text-danger' : 'bg-surface'}`}>{label(r.category)}</span>
                <span className="text-sm text-ink-muted">
                  {TARGET[r.target_kind] ?? r.target_kind} · {when(r.created_at)}
                </span>
              </div>
              {r.target_name && (
                <p className="m-0 mt-2">
                  About <strong>{r.target_name}</strong>
                  {r.reports_against_user > 1 && <span className="text-sm text-danger"> · {r.reports_against_user} reports about this person</span>}
                </p>
              )}
              {r.details && <p className="m-0 mt-1 whitespace-pre-wrap">{r.details}</p>}
              {r.target_kind === 'profile_photo' &&
                (photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', photo)!} alt={`Reported profile photo of ${r.target_name ?? 'a runner'}`} width={160} height={160} className="mt-3 rounded-lg border border-line" />
                ) : (
                  <p className="text-sm text-ink-muted mt-2">The reported photo has since been changed or removed.</p>
                ))}
              {status === 'open' ? (
                <ReportActions reportId={r.id} userId={r.target_user_id} canRemovePhoto={Boolean(photo)} />
              ) : (
                <p className="text-sm text-ink-muted mt-2">
                  {r.resolved_at ? `Closed ${when(r.resolved_at)}` : ''}
                  {r.resolution_note ? ` · ${r.resolution_note}` : ''}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
