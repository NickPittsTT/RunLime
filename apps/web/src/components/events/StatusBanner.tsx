import { STATUS_LABEL, postponementInfo } from '@runlime/shared/events';

const EXPLAIN: Record<string, string> = {
  published: 'Live. Runners see this race in the app and on the website.',
  postponed: 'Runners see "Postponed" and your reason in the app and on the website.',
  cancelled: 'Runners see "Cancelled" and your reason in the app and on the website.',
  draft: 'Not visible to runners yet.',
  pending_approval: 'Waiting for approval. Not visible to runners yet.',
  unpublished: 'Hidden from runners.',
  rejected: 'Not approved. Not visible to runners.',
};

/** Large, unmissable status at the top of the admin/organiser event page. */
export function StatusBanner({
  status,
  reason,
  startsAt,
  originalStartsAt,
  timezone,
}: {
  status: string;
  reason?: string | null;
  startsAt: string;
  originalStartsAt: string | null;
  timezone: string;
}) {
  const postponed = postponementInfo({ status, starts_at: startsAt, original_starts_at: originalStartsAt, timezone });
  const tone =
    status === 'cancelled' ? 'border-red-700 bg-red-50 text-red-900' : status === 'postponed' ? 'border-amber-700 bg-amber-50 text-amber-900' : 'border-line bg-surface text-ink';
  return (
    <div role="status" data-testid="event-status" className={`rounded-xl border-2 p-4 mb-6 ${tone}`}>
      <p className="text-lg font-bold m-0">Status: {STATUS_LABEL[status] ?? status}</p>
      <p className="m-0 text-sm">{EXPLAIN[status] ?? ''}</p>
      {postponed && (
        <p className="m-0 mt-1 font-semibold">
          {postponed.headline}. Original date: <s>{postponed.originalDate}</s>
        </p>
      )}
      {reason && <p className="m-0 mt-1 text-sm">Reason runners see: {reason}</p>}
    </div>
  );
}
