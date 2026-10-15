/** Turn database/auth errors into plain-English messages. Never leak internals. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = error.message ?? '';
  if (error.code === 'P0429' || /too many/i.test(msg)) return 'Too many attempts. Please wait a while and try again.';
  if (/18 and over/i.test(msg)) return 'RunLime accounts are for adults aged 18 and over.';
  if (/requires MFA/i.test(msg)) return 'Please confirm your authenticator code first.';
  if (/already have an application/i.test(msg)) return 'You already have an application waiting for review.';
  if (/reason is required/i.test(msg)) return 'Please give a reason (at least 5 characters).';
  if (/Token has expired|invalid/i.test(msg) && /otp|token/i.test(msg)) return 'That code is wrong or has expired. Request a new one.';
  // Validation messages raised by our own database functions are written for people: show them as they are.
  if ((error.code === '22023' || error.code === 'P0002' || error.code === '23514') && msg && msg.length < 200) return msg;
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '42501') return 'You do not have permission to do that.';
  return 'Something went wrong. Please try again.';
}

export interface ActionResult {
  error?: string;
  ok?: string;
}
