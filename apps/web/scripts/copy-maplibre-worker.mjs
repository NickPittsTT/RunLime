// MapLibre GL 6 runs its tile worker as an ES module next to the library. Bundlers don't emit it,
// so copy the worker (and the shared chunk it imports) into public/ and point MapLibre at it (MapView.tsx).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
const out = join(import.meta.dirname, '..', 'public', 'maplibre');
mkdirSync(out, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(join(dist, f), join(out, f));
console.log(`MapLibre worker copied to public/maplibre (${dist})`);
