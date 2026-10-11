import { CHUNK_SIZE, createChunkedStorage, type KeyValueStore } from '../src/lib/chunkedSecureStore';

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => void map.set(k, v),
    deleteItemAsync: async (k) => void map.delete(k),
  };
}

describe('chunked secure storage for the auth session', () => {
  it('round-trips values larger than the SecureStore limit', async () => {
    const mem = memoryStore();
    const storage = createChunkedStorage(mem);
    const big = 'x'.repeat(CHUNK_SIZE * 3 + 17);
    await storage.setItem('sb-123-auth-token', big);
    expect(await storage.getItem('sb-123-auth-token')).toBe(big);
    for (const v of mem.map.values()) expect(v.length).toBeLessThanOrEqual(CHUNK_SIZE);
  });

  it('removes every chunk and leaves no stale data when a shorter value is written', async () => {
    const mem = memoryStore();
    const storage = createChunkedStorage(mem);
    await storage.setItem('k', 'a'.repeat(CHUNK_SIZE * 2 + 1));
    await storage.setItem('k', 'short');
    expect(await storage.getItem('k')).toBe('short');
    expect(mem.map.size).toBe(2);
    await storage.removeItem('k');
    expect(mem.map.size).toBe(0);
    expect(await storage.getItem('k')).toBeNull();
  });

  it('treats a partially written value as missing', async () => {
    const mem = memoryStore();
    const storage = createChunkedStorage(mem);
    await storage.setItem('k', 'b'.repeat(CHUNK_SIZE + 5));
    mem.map.delete('k.1');
    expect(await storage.getItem('k')).toBeNull();
  });
});
