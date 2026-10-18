import { STATUS_LABEL, formatEventDate, formatEventTime } from '@runlime/shared/events';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AttendancePanel } from '@/components/events/AttendancePanel';
import { MessagePanel } from '@/components/events/MessagePanel';
import { loadMessages } from '@/lib/events/messages';
import { EventForm } from '@/components/events/EventForm';
import { DuplicatePanel, StatusChangePanel } from '@/components/events/EventPanels';
import { InviteForm, MediaUploader, SponsorForm } from '@/components/events/OrganiserTools';
import { Button, Notice, PageTitle } from '@/components/ui';
import { requireProfile } from '@/lib/auth';
import { submitEventAction } from '@/lib/events/actions';
import { loadAreas, loadEvent, toFormValues } from '@/lib/events/load';
import { eventMediaUrl } from '@/lib/media';
import { removeCoOrganiser, removeMedia, removeSponsor } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS_HELP: Record<string, string> = {
  draft: 'Draft: only you and your team can see it. Submit it when it is ready.',
  pending_approval: 'Waiting for the RunLime team to check it. You can still make changes.',
  published: 'Live on the RunLime calendar.',
  postponed: 'Postponed. Runners see the reason you gave.',
  cancelled: 'Cancelled. Runners see the reason you gave.',
  rejected: 'Not approved. Fix the issue below and submit again.',
  unpublished: 'Taken off the calendar by the RunLime team. Fix the issue below and submit again.',
};

export default async function OrganiserEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireProfile(`/organiser/events/${id}`);
  const e = await loadEvent(supabase, id);
  if (!e) notFound();
  const { data: canEdit } = await supabase.rpc('can_edit_event', { p_event: id });
  if (!canEdit) notFound();
  const [areas, { data: media }, { data: sponsors }, { data: team }] = await Promise.all([
    loadAreas(supabase),
    supabase.from('event_media').select('id, kind, storage_path, alt_text').eq('event_id', id).order('sort'),
    supabase.from('event_sponsors').select('id, name, url').eq('event_id', id).order('sort'),
    supabase.rpc('event_team', { p_event: id }),
  ]);
  const canSubmit = ['draft', 'rejected', 'unpublished'].includes(e.status);

  return (
    <>
      <p className="mb-2">
        <Link href="/organiser" className="underline">
          ← Organiser portal
        </Link>
      </p>
      <PageTitle lead={`${formatEventDate(e.starts_at, e.timezone)} · ${formatEventTime(e.starts_at, e.timezone)} · ${STATUS_LABEL[e.status] ?? e.status}`}>
        {e.name}
      </PageTitle>
      {sp.saved && <Notice tone="success">Saved.</Notice>}
      {sp.submitted && <Notice tone="success">Submitted. We&apos;ll check it soon.</Notice>}
      {sp.duplicated && <Notice tone="success">Draft copy created. Check the date and details, then submit.</Notice>}
      {sp.error && <Notice tone="danger">{sp.error}</Notice>}
      <Notice tone={['rejected', 'unpublished'].includes(e.status) ? 'warning' : 'info'}>
        {STATUS_HELP[e.status]}
        {e.status_reason && (
          <>
            {' '}
            Reason: <em>{e.status_reason}</em>
          </>
        )}
      </Notice>
      {canSubmit && (
        <form action={submitEventAction} className="mb-8">
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="back" value="/organiser/events" />
          <Button type="submit">Submit for approval</Button>
        </form>
      )}
      {['published', 'postponed', 'cancelled'].includes(e.status) && <AttendancePanel supabase={supabase} eventId={e.id} />}
      <div className="grid lg:grid-cols-[1fr_22rem] gap-8">
        <EventForm initial={toFormValues(e)} areas={areas} back="/organiser/events" />
        <aside>
          <StatusChangePanel id={e.id} status={e.status} timezone={e.timezone} back={`/organiser/events/${e.id}`} />
          {['published', 'postponed'].includes(e.status) && <MessagePanel eventId={e.id} back={`/organiser/events/${e.id}`} {...(await loadMessages(supabase, e.id))} />}
          <section className="rounded-xl border border-line p-5 mb-6">
            <h2 className="text-lg font-bold mb-3">Flyer and photos</h2>
            <ul className="space-y-3 mb-4">
              {(media ?? []).map((m) => (
                <li key={m.id} className="flex gap-3 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={eventMediaUrl(m.storage_path)} alt={m.alt_text} className="w-16 h-16 object-cover rounded" />
                  <span className="text-sm flex-1">{m.alt_text}</span>
                  <form action={removeMedia}>
                    <input type="hidden" name="event" value={e.id} />
                    <input type="hidden" name="id" value={m.id} />
                    <button className="text-danger text-sm underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <MediaUploader eventId={e.id} />
          </section>
          <section className="rounded-xl border border-line p-5 mb-6">
            <h2 className="text-lg font-bold mb-3">Sponsors</h2>
            <ul className="space-y-2">
              {(sponsors ?? []).map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>{s.name}</span>
                  <form action={removeSponsor}>
                    <input type="hidden" name="event" value={e.id} />
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-danger text-sm underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <SponsorForm eventId={e.id} />
          </section>
          <section className="rounded-xl border border-line p-5 mb-6">
            <h2 className="text-lg font-bold mb-3">Co-organisers</h2>
            <p className="text-sm text-ink-muted mb-2">People outside your organisation who help run this one event.</p>
            <ul className="space-y-2">
              {((team ?? []) as { user_id: string; display_name: string; accepted: boolean }[]).map((t) => (
                <li key={t.user_id} className="flex justify-between gap-3 text-sm">
                  <span>
                    {t.user_id === user.id ? 'You' : t.display_name} · {t.accepted ? 'active' : 'invited'}
                  </span>
                  <form action={removeCoOrganiser}>
                    <input type="hidden" name="event" value={e.id} />
                    <input type="hidden" name="user" value={t.user_id} />
                    <button className="text-danger underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <InviteForm eventId={e.id} />
          </section>
          <DuplicatePanel id={e.id} timezone={e.timezone} back="/organiser/events" />
        </aside>
      </div>
    </>
  );
}
