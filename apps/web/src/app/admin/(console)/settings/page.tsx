import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { SettingForm } from './SettingForm';

export default async function SettingsAdmin() {
  const { supabase } = await requireAdmin('/admin/settings');
  const { data } = await supabase.from('app_settings').select('key, value, is_public, description').order('key');
  const groups = new Map<string, NonNullable<typeof data>>();
  for (const s of data ?? []) {
    const g = s.key.split('.')[0]!;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return (
    <>
      <PageTitle lead="Limits, notices and legal text live here, never in the code. Every change is recorded in the audit log. (The 18+ rule is not a setting.)">
        Settings
      </PageTitle>
      {[...groups.entries()].map(([group, rows]) => (
        <section key={group} className="mb-8">
          <h2 className="text-xl font-bold capitalize mb-1">{group}</h2>
          <div className="divide-y divide-line max-w-3xl">
            {rows.map((s) => (
              <SettingForm key={s.key} settingKey={s.key} value={s.value} description={s.description} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
