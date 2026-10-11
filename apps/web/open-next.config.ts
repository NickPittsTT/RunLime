import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache: every RunLime page that matters is dynamic (auth, legal text from the database).
export default defineCloudflareConfig({});
