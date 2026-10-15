/**
 * Guards the Android/iOS release build: Babel resolves presets relative to apps/mobile, and pnpm does not
 * expose transitive packages there. A preset that is only a dependency of `expo` bundles locally but fails
 * on EAS ("Cannot find module 'babel-preset-expo'", build 2827c6eb, 2026-10-15).
 */
import fs from 'node:fs';
import path from 'node:path';

describe('mobile build configuration', () => {
  const appDir = path.resolve(__dirname, '..');

  it('every Babel preset in babel.config.js is a direct, resolvable dependency of apps/mobile', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const factory = require('../babel.config.js') as (api: { cache: (v: boolean) => void }) => { presets?: (string | [string, unknown])[] };
    const config = factory({ cache: () => undefined });
    const pkg = require('../package.json') as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const preset of config.presets ?? []) {
      const name = Array.isArray(preset) ? preset[0] : preset;
      expect(declared).toHaveProperty([name]);
      expect(() => require.resolve(name, { paths: [appDir] })).not.toThrow();
    }
  });

  it('the splash screen and app icons point at image files that exist (EAS build 98d0e228: splashscreen_logo not found)', () => {
    process.env.APP_ENV = 'staging';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = (require('../app.config') as { default: import('expo/config').ExpoConfig }).default;
    const splash = (config.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, { image?: string }] | undefined;
    const images = [config.icon, config.android?.adaptiveIcon?.foregroundImage, splash?.[1].image];
    for (const img of images) {
      expect(typeof img).toBe('string');
      expect(fs.existsSync(path.resolve(appDir, img as string))).toBe(true);
    }
  });
});
