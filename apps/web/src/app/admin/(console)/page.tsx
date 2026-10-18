import Link from 'next/link';
import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const [{ count: pendingOrgs }, { count: clubs }, users, reports] = await Promise.all([
    supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('status', 'applied'),
    supabase.from('clubs').select('id', { count: 'exact', head: true }).is('archived_at', null),
    supabase.rpc('admin_list_users', { p_search: null, p_limit: 200, p_offset: 0 }),
    supabase.rpc('admin_reports', { p_status: 'open' }),
  ]);
  const tiles = [
    { label: 'Open reports (review within 48 h)', value: reports.data?.length ?? 0, href: '/admin/reports' },
    { label: 'Organiser applications waiting', value: pendingOrgs ?? 0, href: '/admin/organisers' },
    { label: 'Users (latest 200 shown in list)', value: users.data?.length ?? 0, href: '/admin/users' },
    { label: 'Active clubs', value: clubs ?? 0, href: '/admin/clubs' },
  ];
  return (
    <>
      <PageTitle>Admin overview</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-xl border border-line p-5 no-underline text-ink hover:bg-surface">
            <div className="text-3xl font-bold">{t.value}</div>
            <div className="text-ink-muted">{t.label}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
