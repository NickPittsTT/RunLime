import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** One-event iCalendar file ("Add to calendar"). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase
    .from('events')
    .select('id, slug, name, starts_at, venue_name, status, registration_url')
    .eq('slug', slug)
    .in('status', ['published', 'postponed', 'cancelled'])
    .maybeSingle();
  if (!e) return new Response('Not found', { status: 404 });
  const start = new Date(e.starts_at);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RunLime//Race calendar//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@runlime`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(start.toISOString())}`,
    `DTEND:${stamp(end.toISOString())}`,
    `SUMMARY:${esc(e.name)}`,
    `LOCATION:${esc(e.venue_name)}`,
    e.registration_url ? `URL:${esc(e.registration_url)}` : '',
    e.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
  return new Response(body + '\r\n', {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${e.slug}.ics"` },
  });
}
