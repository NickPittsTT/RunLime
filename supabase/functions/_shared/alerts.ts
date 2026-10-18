// Admin alert emails for new reports (no npm imports; unit-tested from packages/shared). Emails carry the category,
// what was reported (a profile, a photo …) and when — never the report text or anyone's name: details stay in the
// admin console.

export interface AlertReport {
  id: string;
  category: string;
  target_kind: string;
  created_at: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  child_safety: 'A child may be at risk',
  sexual_content: 'Nudity or sexual content',
  harassment: 'Bullying or harassment',
  hate_or_violence: 'Hate or violence',
  impersonation: 'Pretending to be someone else',
  spam: 'Spam or scam',
  other: 'Something else',
};
const TARGETS: Record<string, string> = { general: 'a general safety concern', profile: 'a profile', profile_photo: 'a profile photo', club: 'a club', event: 'a race listing' };

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-TT', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Port_of_Spain' }).format(new Date(iso));

export interface Email {
  subject: string;
  text: string;
}

export function urgentEmail(r: AlertReport, queueUrl: string): Email {
  return {
    subject: 'Urgent RunLime report: a child may be at risk',
    text: [
      `A report in the category "${CATEGORY_LABELS.child_safety}" was received ${when(r.created_at)} (Port of Spain time).`,
      `It is about ${TARGETS[r.target_kind] ?? 'something in the app'}.`,
      '',
      `Review it now in the admin console: ${queueUrl}`,
      'Child-safety reports come first (Moderation Policy). If a child is in immediate danger, call the police on 999.',
      '',
      'The report details are only in the admin console. Please do not forward this email.',
    ].join('\n'),
  };
}

export function dailySummaryEmail(reports: AlertReport[], queueUrl: string): Email | null {
  if (reports.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of reports) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const oldest = reports.reduce((a, b) => (a.created_at < b.created_at ? a : b));
  const n = reports.length;
  return {
    subject: `RunLime: ${n} new report${n === 1 ? '' : 's'} to review`,
    text: [
      `${n} new report${n === 1 ? '' : 's'} since the last summary:`,
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => `• ${CATEGORY_LABELS[c] ?? c}: ${k}`),
      '',
      `Oldest: received ${when(oldest.created_at)} (Port of Spain time). We promise a review within 48 hours of each report.`,
      `Review them in the admin console: ${queueUrl}`,
      '',
      'Report details are only in the admin console.',
    ].join('\n'),
  };
}
