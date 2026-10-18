// Upload the Firebase service account key to Expo as the FCM V1 key for one Android application identifier.
// Runs ONLY in GitHub Actions ("Upload FCM key"). Uses the same Expo GraphQL calls as `eas credentials`, but only the
// FCM V1 slot: it never creates, reads the secrets of, or changes a keystore or build credentials.
// Prints nothing from the key except its Firebase project ID (Actions logs are public).
//
//   EXPO_TOKEN=… FCM_SERVICE_ACCOUNT_JSON=… node scripts/upload-fcm-key.mjs
const EAS_PROJECT_ID = 'ca1a5ee2-b15a-488d-b123-8fd075db8be1';
const APP_ID = process.env.ANDROID_APPLICATION_ID ?? 'tt.runlime.app.dev';
const API = process.env.EXPO_GRAPHQL_URL ?? 'https://api.expo.dev/graphql';

const token = process.env.EXPO_TOKEN;
const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;

function fail(msg) {
  console.log(`failed: ${msg}`);
  process.exit(1);
}

if (!token) fail('EXPO_TOKEN is missing');
if (!raw) fail('the FCM_SERVICE_ACCOUNT_JSON secret is missing or empty in the staging environment');

let key;
try {
  key = JSON.parse(raw);
} catch {
  // JSON.parse errors quote part of the input, so never print them.
  fail('the secret is not valid JSON (paste the whole downloaded file, unchanged)');
}
for (const f of ['project_id', 'private_key', 'private_key_id', 'client_email']) {
  if (typeof key?.[f] !== 'string' || key[f] === '') fail(`the secret is not a service account key (field "${f}" missing)`);
}
if (key.type !== 'service_account') fail('the secret is not a service account key (type is not "service_account")');
if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(key.project_id)) fail('the key has an unexpected project ID format');

// Strings from the key that must never reach the log, even inside an API error message.
const sensitive = [key.private_key, key.private_key_id, key.client_email, key.client_id].filter((s) => typeof s === 'string' && s.length > 0);
const safe = (s) => (sensitive.some((v) => String(s).includes(v)) || /PRIVATE KEY/.test(String(s)) ? '(message hidden)' : String(s));

async function gql(stage, query, variables) {
  let res;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    fail(`${stage}: could not reach Expo`);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    fail(`${stage}: Expo returned HTTP ${res.status}`);
  }
  if (body.errors?.length) {
    const e = body.errors[0];
    fail(`${stage}: ${e.extensions?.errorCode ?? `HTTP ${res.status}`} ${safe(e.message ?? '')}`);
  }
  if (!res.ok) fail(`${stage}: Expo returned HTTP ${res.status}`);
  return body.data;
}

// Keystore *fingerprints* only: the keystore file and passwords are never requested.
const STATE = `
  query State($appId: String!, $pkg: String) {
    app {
      byId(appId: $appId) {
        id
        fullName
        ownerAccount { id }
        androidAppCredentials(filter: { applicationIdentifier: $pkg }) {
          id
          applicationIdentifier
          googleServiceAccountKeyForFcmV1 { id projectIdentifier privateKeyIdentifier }
          androidAppBuildCredentialsList { id name isDefault androidKeystore { id sha1CertificateFingerprint updatedAt } }
        }
      }
    }
  }`;

async function state(stage) {
  const d = await gql(stage, STATE, { appId: EAS_PROJECT_ID, pkg: APP_ID });
  const app = d?.app?.byId;
  if (!app) fail(`${stage}: the Expo project was not found (check EXPO_TOKEN's access)`);
  const creds = (app.androidAppCredentials ?? []).find((c) => c.applicationIdentifier === APP_ID) ?? null;
  return { app, creds };
}

const signing = (creds) =>
  JSON.stringify(
    (creds.androidAppBuildCredentialsList ?? [])
      .map((b) => ({ id: b.id, name: b.name, isDefault: b.isDefault, keystore: b.androidKeystore }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
const defaultSha1 = (creds) =>
  (creds.androidAppBuildCredentialsList ?? []).find((b) => b.isDefault)?.androidKeystore?.sha1CertificateFingerprint ?? 'none';

console.log(`Firebase project ID: ${key.project_id}`);

const before = await state('reading Expo credentials');
if (!before.creds) {
  // Creating the credentials record is what `eas build` does with the keystore; leave that to the build.
  fail(`${APP_ID} has no Android credentials on Expo yet; nothing was changed`);
}
const signingBefore = signing(before.creds);
if (signingBefore === '[]') fail(`${APP_ID} has no build credentials on Expo; nothing was changed`);

let keyId;
const current = before.creds.googleServiceAccountKeyForFcmV1;
if (current && current.projectIdentifier === key.project_id && current.privateKeyIdentifier === key.private_key_id) {
  keyId = current.id;
  console.log('This key is already attached; nothing to upload.');
} else {
  const created = await gql(
    'uploading the key',
    `mutation Create($input: GoogleServiceAccountKeyInput!, $accountId: ID!) {
      googleServiceAccountKey { createGoogleServiceAccountKey(googleServiceAccountKeyInput: $input, accountId: $accountId) { id projectIdentifier } }
    }`,
    { input: { jsonKey: key }, accountId: before.app.ownerAccount.id },
  );
  keyId = created?.googleServiceAccountKey?.createGoogleServiceAccountKey?.id;
  if (!keyId) fail('uploading the key: Expo did not return a key ID');
  await gql(
    'attaching the key for FCM V1',
    `mutation Attach($credsId: ID!, $keyId: ID!) {
      androidAppCredentials { setGoogleServiceAccountKeyForFcmV1(id: $credsId, googleServiceAccountKeyId: $keyId) { id } }
    }`,
    { credsId: before.creds.id, keyId },
  );
  console.log('uploaded');
}

// Verify from a fresh read.
const after = await state('checking Expo credentials');
const attached = after.creds?.googleServiceAccountKeyForFcmV1;
if (!attached || attached.id !== keyId || attached.projectIdentifier !== key.project_id) {
  fail(`the FCM V1 key is not attached to ${APP_ID}`);
}
console.log(`FCM V1 key attached to ${APP_ID} (Firebase project ${attached.projectIdentifier})`);
if (signing(after.creds) !== signingBefore) fail('build signing credentials changed — stop and tell Claude');
console.log(`Build signing unchanged (default keystore SHA-1 ${defaultSha1(after.creds)})`);
