import { describe, expect, it } from 'vitest';
import { ageOn, evaluateAgeGate, isAdult, parseIsoDate, subtractYears, todayIn, MINIMUM_ACCOUNT_AGE } from '../src/rules/age';

const d = (s: string) => parseIsoDate(s)!;

describe('age gate (18+, hard rule)', () => {
  it('minimum age is 18 and not configurable', () => {
    expect(MINIMUM_ACCOUNT_AGE).toBe(18);
  });

  it('allows someone turning 18 today', () => {
    expect(evaluateAgeGate('2008-10-11', d('2026-10-11'))).toEqual({ status: 'allowed', age: 18 });
  });

  it('blocks someone turning 18 tomorrow', () => {
    expect(evaluateAgeGate('2008-10-12', d('2026-10-11'))).toEqual({ status: 'blocked', age: 17 });
  });

  it('blocks children and teens of every age', () => {
    for (const dob of ['2026-01-01', '2020-05-05', '2013-10-11', '2010-06-30', '2009-01-01']) {
      expect(isAdult(dob, d('2026-10-11'))).toBe(false);
    }
  });

  it('handles 29 February birthdays like Postgres interval arithmetic', () => {
    // Born 2008-02-29: on 2026-02-28 still 17; on 2026-03-01 is 18.
    expect(evaluateAgeGate('2008-02-29', d('2026-02-28')).status).toBe('blocked');
    expect(evaluateAgeGate('2008-02-29', d('2026-03-01')).status).toBe('allowed');
    // Today is 29 Feb in a leap year: cutoff clamps to 28 Feb.
    expect(subtractYears(d('2028-02-29'), 18)).toEqual(d('2010-02-28'));
    expect(evaluateAgeGate('2010-02-28', d('2028-02-29')).status).toBe('allowed');
    expect(evaluateAgeGate('2010-03-01', d('2028-02-29')).status).toBe('blocked');
  });

  it('rejects malformed, impossible, future and implausible dates', () => {
    expect(evaluateAgeGate('11/10/1990', d('2026-10-11'))).toEqual({ status: 'invalid', reason: 'format' });
    expect(evaluateAgeGate('1990-02-30', d('2026-10-11'))).toEqual({ status: 'invalid', reason: 'format' });
    expect(evaluateAgeGate('1990-13-01', d('2026-10-11'))).toEqual({ status: 'invalid', reason: 'format' });
    expect(evaluateAgeGate('2027-01-01', d('2026-10-11'))).toEqual({ status: 'invalid', reason: 'future' });
    expect(evaluateAgeGate('1900-01-01', d('2026-10-11'))).toEqual({ status: 'invalid', reason: 'too_old' });
  });

  it('computes age correctly around birthdays', () => {
    expect(ageOn(d('1990-10-12'), d('2026-10-11'))).toBe(35);
    expect(ageOn(d('1990-10-11'), d('2026-10-11'))).toBe(36);
  });

  it('uses the calendar date in the reference time zone', () => {
    // 2026-10-12T02:00Z is still 11 Oct in Port of Spain (UTC-4).
    expect(todayIn('America/Port_of_Spain', new Date('2026-10-12T02:00:00Z'))).toEqual(d('2026-10-11'));
  });
});
