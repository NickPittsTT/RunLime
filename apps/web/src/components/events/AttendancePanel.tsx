import type { SupabaseClient } from '@supabase/supabase-js';

interface Summary {
  going_people: number;
  going_adults: number;
  going_children: number;
  maybe: number;
  not_going: number;
  trend: { day: string; going_adults: number; going_children: number; maybe: number }[];
}

const dayLabel = (d: string) => new Intl.DateTimeFormat('en-TT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

/** One series (adults going by day): thin 2px line, ≥8px markers with native tooltips, recessive axis, table view. */
function TrendChart({ trend }: { trend: Summary['trend'] }) {
  // Sized close to a phone's width so text renders near its nominal size; capped on wide screens.
  const W = 360;
  const H = 150;
  const pad = { l: 32, r: 16, t: 14, b: 30 };
  const max = Math.max(1, ...trend.map((t) => t.going_adults));
  const x = (i: number) => pad.l + (trend.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (trend.length - 1));
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const pts = trend.map((t, i) => `${x(i)},${y(t.going_adults)}`).join(' ');
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl h-auto" role="img" aria-label={`Adults going over time: from ${trend[0]?.going_adults ?? 0} to ${trend.at(-1)?.going_adults ?? 0}`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--color-line)" strokeWidth={1} />
        <text x={pad.l - 6} y={y(max) + 4} textAnchor="end" fontSize={13} fill="var(--color-ink-muted)">
          {max}
        </text>
        <text x={pad.l - 6} y={H - pad.b + 4} textAnchor="end" fontSize={13} fill="var(--color-ink-muted)">
          0
        </text>
        <polyline points={pts} fill="none" stroke="var(--color-leaf)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((t, i) => (
          <g key={t.day}>
            <circle cx={x(i)} cy={y(t.going_adults)} r={4} fill="var(--color-leaf)" stroke="#fff" strokeWidth={2} />
            {/* larger invisible hit target carrying the tooltip */}
            <circle cx={x(i)} cy={y(t.going_adults)} r={12} fill="transparent">
              <title>{`${dayLabel(t.day)}: ${t.going_adults} adults going, ${t.going_children} children, ${t.maybe} maybe`}</title>
            </circle>
          </g>
        ))}
        {[0, trend.length - 1].filter((v, i, a) => a.indexOf(v) === i && trend[v]).map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 && trend.length > 1 ? 'start' : 'end'} fontSize={13} fill="var(--color-ink-muted)">
            {dayLabel(trend[i]!.day)}
          </text>
        ))}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Adults going</th>
              <th scope="col">Children</th>
              <th scope="col">Maybe</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((t) => (
              <tr key={t.day}>
                <td>{dayLabel(t.day)}</td>
                <td>{t.going_adults}</td>
                <td>{t.going_children}</td>
                <td>{t.maybe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** O10: RSVP totals, trend, children total and club turnout for one race. No names, no ages. */
export async function AttendancePanel({ supabase, eventId }: { supabase: SupabaseClient; eventId: string }) {
  const [{ data, error }, { data: turnout }] = await Promise.all([supabase.rpc('rsvp_summary', { p_event: eventId }), supabase.rpc('club_turnout', { p_event: eventId })]);
  if (error || !data) return null;
  const s = data as Summary;
  const clubs = (turnout ?? []) as { club_id: string; club_name: string; going: number }[];
  const tiles = [
    { label: 'Adults going', value: s.going_adults, hint: `${s.going_people} RSVP${s.going_people === 1 ? '' : 's'} (groups count everyone)` },
    { label: 'Children coming', value: s.going_children, hint: 'Total only. Never names or ages' },
    { label: 'Maybe', value: s.maybe, hint: 'People, not groups' },
    { label: 'Not going', value: s.not_going, hint: 'Changed their mind' },
  ];
  return (
    <section className="rounded-xl border border-line p-5 mb-8" aria-labelledby="attendance" data-testid="attendance">
      <h2 id="attendance" className="text-xl font-bold mb-1">
        Attendance
      </h2>
      <p className="text-ink-muted text-sm mb-4">From RSVPs in the RunLime app. RunLime does not take registrations: these are not entries.</p>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg bg-surface p-3">
            <dt className="text-sm text-ink-muted">{t.label}</dt>
            <dd className="m-0 text-3xl font-bold text-ink">{t.value}</dd>
            <dd className="m-0 text-xs text-ink-muted">{t.hint}</dd>
          </div>
        ))}
      </dl>
      <h3 className="font-semibold mb-2">Adults going over time</h3>
      {s.trend.length === 0 ? <p className="text-ink-muted">No RSVPs yet.</p> : <TrendChart trend={s.trend} />}
      <h3 className="font-semibold mt-5 mb-2">Club turnout</h3>
      {clubs.length === 0 ? (
        <p className="text-ink-muted text-sm">No club has enough members going to show yet (counts appear from the minimum set by RunLime, and only for members who opted in).</p>
      ) : (
        <ul className="m-0 pl-5">
          {clubs.map((c) => (
            <li key={c.club_id}>
              {c.club_name}: {c.going} going
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
