import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, supabase } = await requireAdmin();
  // Open reports waiting for review (Moderation Policy: within 48 hours, child safety first).
  const { count: openReports } = await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
  const { count: urgent } = await supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('category', 'child_safety');
  return (
    <div>
      <nav aria-label="Admin" className="flex flex-wrap gap-x-5 gap-y-2 mb-8 pb-4 border-b border-line">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/organisers">Organisers</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/events">Events</Link>
        <Link href="/admin/suggestions">Suggestions</Link>
        <Link href="/admin/clubs">Clubs</Link>
        <Link href="/admin/reports" aria-label={openReports ? `Reports, ${openReports} open${urgent ? `, ${urgent} child safety` : ''}` : 'Reports'}>
          Reports
          {openReports ? (
            <span data-testid="open-reports" className={`ml-1 rounded-full px-2 text-sm font-bold text-white ${urgent ? 'bg-danger' : 'bg-forest'}`}>
              {openReports}
            </span>
          ) : null}
        </Link>
        <Link href="/admin/settings">Settings</Link>
        <span className="ml-auto text-sm text-ink-muted">{isSuperAdmin ? 'Super admin' : 'Platform admin'} · MFA verified</span>
      </nav>
      {children}
    </div>
  );
}
