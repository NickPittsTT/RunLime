// Minimal SMTP client (no third-party code): implicit TLS (port 465) with AUTH LOGIN, or plain TCP for the local
// mail catcher. Throws on any unexpected reply; never logs credentials or addresses.
import { buildMessage, isPlainAddress } from '../_shared/mime.ts';

export interface SmtpConfig {
  host: string;
  port: number;
  tls: boolean;
  user?: string;
  password?: string;
}

export async function sendMail(cfg: SmtpConfig, mail: { from: string; fromName?: string; to: string; subject: string; text: string }[]): Promise<void> {
  if (mail.some((m) => !isPlainAddress(m.from) || !isPlainAddress(m.to))) throw new Error('invalid address');
  const conn = cfg.tls ? await Deno.connectTls({ hostname: cfg.host, port: cfg.port }) : await Deno.connect({ hostname: cfg.host, port: cfg.port });
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = '';
  const readReply = async (): Promise<{ code: number; text: string }> => {
    const chunk = new Uint8Array(4096);
    for (;;) {
      const lines = buf.split('\r\n');
      // A reply ends with a line "NNN text" (multi-line replies use "NNN-text" before it).
      const end = lines.findIndex((l) => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
      if (end >= 0) {
        const text = lines.slice(0, end + 1).join('\n');
        buf = lines.slice(end + 1).join('\r\n');
        return { code: Number(lines[end]!.slice(0, 3)), text };
      }
      const n = await conn.read(chunk);
      if (n === null) throw new Error('SMTP connection closed');
      buf += dec.decode(chunk.subarray(0, n));
    }
  };
  const cmd = async (line: string, expect: number, what: string) => {
    await conn.write(enc.encode(`${line}\r\n`));
    const r = await readReply();
    if (r.code !== expect) throw new Error(`SMTP ${what}: ${r.code}`);
  };
  try {
    if ((await readReply()).code !== 220) throw new Error('SMTP greeting');
    await cmd('EHLO runlime', 250, 'EHLO');
    if (cfg.user) {
      await cmd('AUTH LOGIN', 334, 'AUTH');
      await cmd(btoa(cfg.user), 334, 'AUTH user');
      await cmd(btoa(cfg.password ?? ''), 235, 'AUTH password');
    }
    for (const m of mail) {
      await cmd(`MAIL FROM:<${m.from}>`, 250, 'MAIL FROM');
      await cmd(`RCPT TO:<${m.to}>`, 250, 'RCPT TO');
      await cmd('DATA', 354, 'DATA');
      await cmd(`${buildMessage(m)}\r\n.`, 250, 'message');
    }
    await conn.write(enc.encode('QUIT\r\n')).catch(() => 0);
  } finally {
    try {
      conn.close();
    } catch {
      // already closed
    }
  }
}
