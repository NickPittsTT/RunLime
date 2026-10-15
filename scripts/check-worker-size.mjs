// Fails if the built Cloudflare Worker is too big for the Workers FREE plan (3 MiB compressed).
// Run from apps/web after `cf:build`. Warns early so we can act before a paid plan would be needed.
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIMIT_KIB = 3072; // Workers Free: 3 MiB after compression
const WARN_KIB = 2816; // ~92%: time to slim the bundle (see BACKLOG)

const out = execSync(`npx wrangler deploy --dry-run --outdir ${mkdtempSync(join(tmpdir(), 'worker-'))}`, {
  encoding: 'utf8',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
const m = /gzip:\s*([\d.]+)\s*KiB/.exec(out);
if (!m) throw new Error(`Could not read the worker size from wrangler:\n${out.slice(-500)}`);
const kib = Number(m[1]);
const pct = ((kib / LIMIT_KIB) * 100).toFixed(0);
console.log(`Worker size: ${kib} KiB compressed (${pct}% of the free-plan limit of ${LIMIT_KIB} KiB)`);
if (kib > LIMIT_KIB) {
  console.log(`::error::Worker is ${kib} KiB: over the Workers FREE limit. Do not upgrade; tell the owner (budget rule).`);
  process.exit(1);
}
if (kib > WARN_KIB) console.log(`::warning::Worker is at ${pct}% of the free-plan limit.`);
