/**
 * Supabase session storage backed by the OS keychain/keystore (expo-secure-store).
 * SecureStore values are limited to ~2 KB, so values are split across numbered keys.
 */
export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(store: KeyValueStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      const k = safeKey(key);
      const countRaw = await store.getItemAsync(`${k}.n`);
      if (countRaw === null) return null;
      const count = Number(countRaw);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.getItemAsync(`${k}.${i}`);
        if (part === null) return null; // partial write: treat as signed out
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      const k = safeKey(key);
      await this.removeItem(key);
      const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
      for (let i = 0; i < count; i++) await store.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      await store.setItemAsync(`${k}.n`, String(count));
    },
    async removeItem(key: string): Promise<void> {
      const k = safeKey(key);
      const countRaw = await store.getItemAsync(`${k}.n`);
      const count = countRaw === null ? 0 : Number(countRaw);
      await store.deleteItemAsync(`${k}.n`);
      for (let i = 0; i < count; i++) await store.deleteItemAsync(`${k}.${i}`);
    },
  };
}
