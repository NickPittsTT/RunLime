import { friendlyError } from '@/lib/errors';

describe('error messages say what went wrong (owner retest B3)', () => {
  it.each([
    [{ code: '23505', message: 'duplicate key value violates unique constraint "profiles_nickname_key"' }, 'That nickname is already taken. Choose another, or leave it empty.'],
    [{ code: '23514', message: 'new row violates check constraint "profiles_nickname_check"' }, 'Nicknames are 3–30 letters, numbers, spaces, dots, dashes or underscores.'],
    [{ code: '23514', message: 'violates check constraint "profiles_display_name_check"' }, 'Your name must be 1–50 characters.'],
    [{ code: '28000', message: 'Not signed in' }, 'Your sign-in has expired. Sign out and sign in again.'],
    [{ code: '22023', message: 'That nickname is already taken. Choose another, or leave it empty.' }, 'That nickname is already taken. Choose another, or leave it empty.'],
    [{ code: '42501', message: 'permission denied' }, "You don't have permission to do that."],
  ])('%j', (err, text) => expect(friendlyError(err)).toBe(text));

  it('anything else still says something went wrong, with a code to report', () => {
    expect(friendlyError({ code: 'XX000', message: 'internal' })).toBe('Something went wrong. Please try again. (code XX000)');
    expect(friendlyError(null)).toBe('Something went wrong. Please try again.');
  });
});
