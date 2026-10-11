import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = await requireAdmin();
  return (
    <div>
      <nav aria-label="Admin" className="flex flex-wrap gap-x-5 gap-y-2 mb-8 pb-4 border-b border-line">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/organisers">Organisers</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/clubs">Clubs</Link>
        <span className="ml-auto text-sm text-ink-muted">{isSuperAdmin ? 'Super admin' : 'Platform admin'} · MFA verified</span>
      </nav>
      {children}
    </div>
  );
}
