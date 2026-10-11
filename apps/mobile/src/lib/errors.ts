export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  if (/18 and over/i.test(msg)) return 'RunLime accounts are for adults aged 18 and over.';
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return 'That code is wrong or has expired. Request a new one.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  if (/rate|too many/i.test(msg)) return 'Too many attempts. Please wait a little and try again.';
  return 'Something went wrong. Please try again.';
}
