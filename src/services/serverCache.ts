/** Cache-first policy with bounded freshness and shared concurrent server reads. */
export function createServerCache() {
  const completed = new Map<string, number>();
  const pending = new Map<string, Promise<unknown>>();
  return async function read<T>(key: string, options: {
    cache: () => Promise<T>; server: () => Promise<T>; usable: (value: T) => boolean;
    maxAgeMs: number; force?: boolean; offline?: boolean; now?: number;
  }): Promise<{ value: T; source: 'cache' | 'server'; stale: boolean }> {
    const now = options.now ?? Date.now();
    let cached: T | undefined;
    let hasCache = false;
    try { cached = await options.cache(); hasCache = options.usable(cached); } catch { /* cache miss */ }
    const fresh = completed.has(key) && now - completed.get(key)! < options.maxAgeMs;
    if (hasCache && (options.offline || fresh && !options.force)) {
      return { value: cached!, source: 'cache', stale: !fresh || Boolean(options.offline) };
    }
    if (options.offline) throw new Error('Sem conexão e sem dados salvos para esta consulta.');
    let request = pending.get(key) as Promise<T> | undefined;
    if (!request) {
      request = options.server().then(value => { completed.set(key, Date.now()); return value; });
      pending.set(key, request);
    }
    try { return { value: await request, source: 'server', stale: false }; }
    catch (error) {
      // Permission failures must never be disguised as a valid offline response.
      const code = (error as { code?: string })?.code?.replace('firestore/', '');
      if (hasCache && ['unavailable', 'deadline-exceeded'].includes(code || '')) {
        return { value: cached!, source: 'cache', stale: true };
      }
      throw error;
    } finally { if (pending.get(key) === request) pending.delete(key); }
  };
}
