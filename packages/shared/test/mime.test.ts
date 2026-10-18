import { describe, expect, it } from 'vitest';
import { buildMessage, isPlainAddress } from '../../../supabase/functions/_shared/mime';

describe('alert email message', () => {
  it('headers, UTF-8 subject, base64 body that round-trips', () => {
    const raw = buildMessage({ from: 'alerts@runlime.test', fromName: 'RunLime alerts', to: 'support@runlime.test', subject: 'Résumé · report', text: 'Line 1\n.Line starting with a dot', date: new Date('2026-10-18T12:00:00Z'), id: 'abc' });
    const [head, body] = raw.split('\r\n\r\n');
    expect(head).toContain('From: RunLime alerts <alerts@runlime.test>');
    expect(head).toContain('To: support@runlime.test');
    expect(head).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    expect(head).toContain('Message-ID: <abc@runlime.test>');
    expect(head).toContain('Content-Transfer-Encoding: base64');
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(body!.replace(/\r\n/g, '')), (ch) => ch.charCodeAt(0)));
    expect(decoded).toBe('Line 1\r\n.Line starting with a dot');
    expect(body!.split('\r\n').every((l) => l.length <= 76)).toBe(true);
  });
  it('rejects addresses that could inject SMTP commands', () => {
    expect(isPlainAddress('runlimett@gmail.com')).toBe(true);
    expect(isPlainAddress('a@b.c>\r\nRCPT TO:<x@y.z')).toBe(false);
    expect(isPlainAddress('Name <a@b.c>')).toBe(false);
  });
});
