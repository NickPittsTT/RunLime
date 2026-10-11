import { Input, PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { RoleButton } from './RoleButton';

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { supabase, isSuperAdmin, user } = await requireAdmin('/admin/users');
  const { data: users, error } = await supabase.rpc('admin_list_users', { p_search: q || null, p_limit: 100, p_offset: 0 });
  return (
    <>
      <PageTitle lead={isSuperAdmin ? 'Only you (super admin) can grant or remove platform admins.' : undefined}>Users</PageTitle>
      <form className="mb-6 flex gap-3" role="search">
        <label htmlFor="q" className="sr-only">
          Search users
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder="Search name, nickname or email" />
      </form>
      {error && <p role="alert">Could not load users.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Roles</th>
              <th className="py-2 pr-4">2FA</th>
              {isSuperAdmin && <th className="py-2">Admin role</th>}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: { id: string; display_name: string; nickname: string | null; email: string; roles: string[]; has_mfa: boolean }) => (
              <tr key={u.id} className="border-b border-line align-top">
                <td className="py-3 pr-4">
                  {u.display_name}
                  {u.nickname && <div className="text-sm text-ink-muted">{u.nickname}</div>}
                </td>
                <td className="py-3 pr-4 break-all">{u.email}</td>
                <td className="py-3 pr-4">{u.roles.join(', ')}</td>
                <td className="py-3 pr-4">{u.has_mfa ? 'Yes' : 'No'}</td>
                {isSuperAdmin && (
                  <td className="py-3">
                    {u.id !== user.id && !u.roles.includes('super_admin') && (
                      <RoleButton userId={u.id} isPlatformAdmin={u.roles.includes('platform_admin')} name={u.display_name} />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
