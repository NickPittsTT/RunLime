import { describe, expect, it } from 'vitest';
import { completeSignupSchema, nicknameSchema, organiserApplicationSchema } from '../src/schemas';

const base = {
  dateOfBirth: '1990-05-05',
  displayName: 'Keisha',
  homeRegionId: '6f1d1c5e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  termsVersion: '2026-10-11',
  privacyVersion: '2026-10-11',
};

describe('completeSignupSchema', () => {
  it('accepts an adult', () => {
    expect(completeSignupSchema.safeParse(base).success).toBe(true);
  });
  it('rejects an under-18 date of birth', () => {
    const r = completeSignupSchema.safeParse({ ...base, dateOfBirth: '2015-01-01' });
    expect(r.success).toBe(false);
  });
});

describe('nickname', () => {
  it.each(['Speedy K', 'run_lime.tt', 'abc'])('accepts %s', (n) => expect(nicknameSchema.safeParse(n).success).toBe(true));
  it.each(['a', ' x', '<script>', 'way-too-long-nickname-for-the-board'])('rejects %s', (n) =>
    expect(nicknameSchema.safeParse(n).success).toBe(false),
  );
});

describe('organiserApplicationSchema', () => {
  it('requires a meaningful description and valid contact details', () => {
    const r = organiserApplicationSchema.safeParse({
      organisationName: 'Savannah Striders',
      contactEmail: 'not-an-email',
      contactPhone: '868-555-0100',
      about: 'short',
      isCharity: false,
    });
    expect(r.success).toBe(false);
  });
});
