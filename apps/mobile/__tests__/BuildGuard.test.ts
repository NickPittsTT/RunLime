// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertPublicEnv } = require('../build-guards/publicEnv');

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'supabase' })}.c2ln`;

describe('app builds refuse secret EXPO_PUBLIC_ values (incident review 31 Oct 2026)', () => {
  it('public values pass: anon JWT, publishable key, URLs', () => {
    expect(() => assertPublicEnv({ EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'), EXPO_PUBLIC_X: 'sb_publishable_abc123def456', EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).not.toThrow();
  });
  it('a secret key fails, naming the variable but never printing the value', () => {
    const value = 'sb_' + 'secret_' + 'ab12'.repeat(8); // fake, low-entropy, built at runtime so secret scans ignore it
    expect(() => assertPublicEnv({ EXPO_PUBLIC_SUPABASE_ANON_KEY: value })).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY holds a Supabase secret key/);
    try {
      assertPublicEnv({ EXPO_PUBLIC_SUPABASE_ANON_KEY: value });
    } catch (e) {
      expect(String(e)).not.toContain(value);
    }
  });
  it('a service_role JWT fails', () => {
    expect(() => assertPublicEnv({ EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') })).toThrow(/role "service_role"/);
  });
  it('non-public variables are not its business (they never reach the app)', () => {
    expect(() => assertPublicEnv({ SUPABASE_SERVICE_ROLE_KEY: jwt('service_role') })).not.toThrow();
  });
});
