/* global Buffer */
// Build guard (incident review 31 Oct 2026): every EXPO_PUBLIC_ value is compiled into the app and readable by anyone
// with the APK. Refuse to build if one looks secret. Runs when app.config.ts is read (local builds and EAS builds).
const FORBIDDEN_ROLES = ['service_role', 'supabase_admin', 'postgres'];

function secretReason(value) {
  if (typeof value !== 'string' || value.length < 8) return null;
  if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(value)) return 'a Supabase secret key (sb_secret_)';
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)) return 'a private key';
  if (/"type"\s*:\s*"service_account"/.test(value)) return 'a Google service-account key';
  const jwt = value.match(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/);
  if (jwt) {
    try {
      const role = JSON.parse(Buffer.from(jwt[1], 'base64url').toString('utf8')).role;
      if (FORBIDDEN_ROLES.includes(role)) return `a JWT with role "${role}"`;
    } catch {
      // not a JWT payload
    }
  }
  return null;
}

/** Throws (never printing the value) if any EXPO_PUBLIC_ variable holds something secret. */
function assertPublicEnv(env = process.env) {
  const bad = Object.keys(env)
    .filter((name) => name.startsWith('EXPO_PUBLIC_'))
    .map((name) => [name, secretReason(env[name])])
    .filter(([, reason]) => reason);
  if (bad.length) {
    throw new Error(`Refusing to build: ${bad.map(([n, r]) => `${n} holds ${r}`).join('; ')}. EXPO_PUBLIC_ values are public; put the public key there instead.`);
  }
}

module.exports = { assertPublicEnv, secretReason };
