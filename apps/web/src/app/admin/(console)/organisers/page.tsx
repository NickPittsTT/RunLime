import { PageTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth';
import { ReviewForm } from './ReviewForm';

export default async function OrganisersQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = 'applied' } = await searchParams;
  const { supabase } = await requireAdmin('/admin/organisers');
  const { data: orgs } = await supabase
    .from('organisations')
    .select('id, name, contact_email, contact_phone, website, about, is_charity, status, rejection_reason, created_at')
    .eq('status', status)
    .order('created_at');
  const tabs = ['applied', 'verified', 'rejected', 'suspended'];
  return (
    <>
      <PageTitle lead="Verify organisers before any of their events can go live.">Organisers</PageTitle>
      <nav aria-label="Filter by status" className="flex gap-4 mb-6">
        {tabs.map((t) => (
          <a key={t} href={`?status=${t}`} aria-current={t === status ? 'page' : undefined} className={t === status ? 'font-bold' : ''}>
            {t === 'applied' ? 'Waiting' : t[0]!.toUpperCase() + t.slice(1)}
          </a>
        ))}
      </nav>
      {(orgs ?? []).length === 0 && <p>Nothing here.</p>}
      {(orgs ?? []).map((o) => (
        <article key={o.id} className="rounded-xl border border-line p-6 mb-6">
          <h2 className="text-xl font-bold">
            {o.name} {o.is_charity && <span className="ml-2 text-sm rounded bg-lime px-2 py-0.5 text-ink">Charity</span>}
          </h2>
          <p className="text-sm text-ink-muted mb-3">Applied {new Date(o.created_at).toLocaleDateString('en-TT', { timeZone: 'America/Port_of_Spain' })}</p>
          <p className="mb-3 whitespace-pre-line">{o.about}</p>
          <p className="text-sm">
            {o.contact_email} · {o.contact_phone}
            {o.website && (
              <>
                {' · '}
                <a href={o.website} rel="noopener noreferrer nofollow" target="_blank">
                  website
                </a>
              </>
            )}
          </p>
          {o.rejection_reason && <p className="text-sm mt-2">Reason on record: {o.rejection_reason}</p>}
          <ReviewForm id={o.id} status={o.status} />
        </article>
      ))}
    </>
  );
}
