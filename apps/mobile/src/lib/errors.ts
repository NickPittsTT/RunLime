export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  if (/18 and over/i.test(msg)) return 'RunLime accounts are for adults aged 18 and over.';
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return 'That code is wrong or has expired. Request a new one.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  if (error?.code === 'P0429' || /rate|too many/i.test(msg)) return 'Too many attempts. Please wait a little and try again.';
  // Validation messages from our own database functions are written for people: show them as they are.
  if ((error?.code === '22023' || error?.code === 'P0002') && msg && msg.length < 200 && !/violates|constraint|relation/i.test(msg)) return msg;
  // Specific messages instead of a generic one (owner retest B3).
  if (error?.code === '23505' && /nickname/i.test(msg)) return 'That nickname is already taken. Choose another, or leave it empty.';
  if (error?.code === '23505') return 'That already exists. Pull down to refresh, then try again.';
  if (error?.code === '23514' && /nickname/i.test(msg)) return 'Nicknames are 3–30 letters, numbers, spaces, dots, dashes or underscores.';
  if (error?.code === '23514' && /display_name/i.test(msg)) return 'Your name must be 1–50 characters.';
  if (error?.code === '23514' || error?.code === '22P02') return 'Some details aren\'t in the right format. Check them and try again.';
  if (error?.code === '28000' || error?.code === 'PGRST301' || /jwt|not signed in/i.test(msg)) return 'Your sign-in has expired. Sign out and sign in again.';
  if (error?.code === '42501') return 'You don\'t have permission to do that.';
  return `Something went wrong. Please try again.${error?.code ? ` (code ${error.code})` : ''}`;
}
