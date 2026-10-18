// Emails the support address about new reports (Moderation Policy: review within 48 hours, child safety first).
// mode "urgent" (every minute): each child-safety report not yet emailed. mode "daily": one summary of other open
// reports not yet summarised. Called by pg_cron (public.dispatch_admin_alerts) with a shared secret; never by apps.
// SMTP over implicit TLS (port 465; Supabase blocks outbound 25 and 587), with our own small client. Logs counts only.
import { dailySummaryEmail, urgentEmail, type AlertReport, type Email } from '../_shared/alerts.ts';
import { sendMail } from './smtp.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, apikey: env('SUPABASE_SERVICE_ROLE_KEY'), 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function setting(key: string): Promise<string | null> {
  const rows = (await (await rest(`app_settings?key=eq.${encodeURIComponent(key)}&select=value`)).json()) as { value: unknown }[];
  const v = Array.isArray(rows) ? rows[0]?.value : null;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function send(to: string, emails: Email[]): Promise<void> {
  const from = env('SMTP_FROM') || env('SMTP_USER');
  await sendMail(
    { host: env('SMTP_HOST'), port: Number(env('SMTP_PORT') || 465), tls: env('SMTP_TLS') !== 'false', user: env('SMTP_USER') || undefined, password: env('SMTP_PASSWORD') },
    emails.map((e) => ({ from, fromName: 'RunLime alerts', to, subject: e.subject, text: e.text })),
  );
}

Deno.serve(async (req) => {
  const secret = env('ADMIN_ALERTS_SECRET');
  if (req.method !== 'POST' || !secret || !sameSecret(req.headers.get('x-dispatch-secret') ?? '', secret)) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const { mode } = (await req.json().catch(() => ({}))) as { mode?: string };
    const to = await setting('legal.support_email');
    if (!to || !env('SMTP_HOST')) {
      console.error('admin-alerts: support email or SMTP not configured');
      return Response.json({ sent: 0, reason: 'not configured' });
    }
    const site = await setting('legal.website');
    const queue = site ? `${site.replace(/\/$/, '')}/admin/reports` : '(admin console → Reports)';
    if (mode === 'test') {
      await send(to, [{ subject: 'RunLime admin alerts are set up', text: `Report alerts will reach this address: child-safety reports at once, others in a daily summary.\nAdmin console: ${queue}` }]);
      return Response.json({ sent: 1 });
    }
    const cols = 'select=id,category,target_kind,created_at&order=created_at';
    if (mode === 'daily') {
      const rows = (await (await rest(`reports?category=neq.child_safety&status=eq.open&summary_emailed_at=is.null&${cols}&limit=500`)).json()) as AlertReport[];
      const email = dailySummaryEmail(rows, queue);
      if (!email) return Response.json({ sent: 0 });
      await send(to, [email]);
      await rest(`reports?id=in.(${rows.map((r) => r.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ summary_emailed_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } });
      return Response.json({ sent: 1, reports: rows.length });
    }
    const since = new Date(Date.now() - 2 * 86400_000).toISOString();
    const rows = (await (await rest(`reports?category=eq.child_safety&alert_emailed_at=is.null&created_at=gt.${since}&${cols}&limit=20`)).json()) as AlertReport[];
    if (!Array.isArray(rows) || rows.length === 0) return Response.json({ sent: 0 });
    await send(to, rows.map((r) => urgentEmail(r, queue)));
    await rest(`reports?id=in.(${rows.map((r) => r.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ alert_emailed_at: new Date().toISOString() }), headers: { prefer: 'return=minimal' } });
    return Response.json({ sent: rows.length });
  } catch (err) {
    console.error('admin-alerts failed', err instanceof Error ? err.message.replace(/\S+@\S+/g, '(address)') : 'unknown');
    return new Response('error', { status: 500 });
  }
});
