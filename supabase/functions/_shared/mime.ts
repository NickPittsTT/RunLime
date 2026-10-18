// Plain-text email as an RFC 5322 message (no npm imports; unit-tested from packages/shared). UTF-8 subject via
// RFC 2047; base64 body (no dot-stuffing or line-length issues on the SMTP DATA stream).

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export function buildMessage(m: { from: string; fromName?: string; to: string; subject: string; text: string; date?: Date; id?: string }): string {
  const domain = m.from.split('@')[1] ?? 'localhost';
  const body = b64(m.text.replace(/\r?\n/g, '\r\n')).replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: ${m.fromName ? `${encodeHeader(m.fromName)} <${m.from}>` : m.from}`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${(m.date ?? new Date()).toUTCString()}`,
    `Message-ID: <${m.id ?? crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

/** SMTP addresses must be bare and safe for the command line. */
export function isPlainAddress(a: string): boolean {
  return /^[^\s<>()@,;:"]+@[^\s<>()@,;:"]+\.[^\s<>()@,;:"]+$/.test(a);
}
