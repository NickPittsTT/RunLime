/**
 * RunLime age rule: every account holder must be 18 or older.
 *
 * This is a hard rule (owner policy), deliberately NOT configurable.
 * The same rule is enforced server-side by `public.is_adult(date)` in Postgres;
 * both use the calendar date in AGE_REFERENCE_TIME_ZONE so device and server agree.
 *
 * Semantics match Postgres `dob <= (today - interval '18 years')`:
 * a person born on 29 Feb becomes 18 on 1 Mar in non-leap years.
 */
export const MINIMUM_ACCOUNT_AGE = 18 as const;
export const AGE_REFERENCE_TIME_ZONE = 'America/Port_of_Spain' as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export type AgeGateResult =
  | { status: 'allowed'; age: number }
  | { status: 'blocked'; age: number }
  | { status: 'invalid'; reason: 'format' | 'future' | 'too_old' };

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseIsoDate(value: string): CalendarDate | null {
  const m = ISO_DATE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Calendar date "today" in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Subtract whole years, clamping the day like Postgres interval arithmetic. */
export function subtractYears(date: CalendarDate, years: number): CalendarDate {
  const year = date.year - years;
  return { year, month: date.month, day: Math.min(date.day, daysInMonth(year, date.month)) };
}

export function ageOn(dob: CalendarDate, today: CalendarDate): number {
  let age = today.year - dob.year;
  // Birthday this year, clamped the same way as subtractYears (29 Feb -> 28 Feb is NOT reached until 1 Mar).
  const thresholdDob = subtractYears(today, age);
  if (compareDates(dob, thresholdDob) > 0) age -= 1;
  return age;
}

/**
 * Evaluate the age gate. `today` defaults to the current date in AGE_REFERENCE_TIME_ZONE.
 */
export function evaluateAgeGate(dobIso: string, today: CalendarDate = todayIn(AGE_REFERENCE_TIME_ZONE)): AgeGateResult {
  const dob = parseIsoDate(dobIso);
  if (!dob) return { status: 'invalid', reason: 'format' };
  if (compareDates(dob, today) > 0) return { status: 'invalid', reason: 'future' };
  if (today.year - dob.year > 120) return { status: 'invalid', reason: 'too_old' };
  const age = ageOn(dob, today);
  const cutoff = subtractYears(today, MINIMUM_ACCOUNT_AGE);
  return compareDates(dob, cutoff) <= 0 ? { status: 'allowed', age } : { status: 'blocked', age };
}

export function isAdult(dobIso: string, today?: CalendarDate): boolean {
  return evaluateAgeGate(dobIso, today).status === 'allowed';
}
