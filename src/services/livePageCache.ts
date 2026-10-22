import { createQueryResource } from './queryResource';

export interface LiveDirectoryPage {
  items: Array<{ id: string; title: string; city: string; state: string; arenaName: string; distanceKm: number | null }>;
  nextCursor: string | null;
}
// Exact filter/cursor keys, memory only. Location coordinates are never persisted.
const pages = new Map<string, ReturnType<typeof createQueryResource<LiveDirectoryPage>>>();
export async function readLivePage(url: string): Promise<LiveDirectoryPage> {
  let resource = pages.get(url);
  if (!resource) {
    resource = createQueryResource(async () => {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Listagem de transmissões indisponível.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar as transmissões.');
      if (!Array.isArray(data.items)) throw new Error('Resposta inválida da listagem.');
      return data;
    }, { ttl: 10_000, maxAge: 15_000 });
    pages.set(url, resource);
    if (pages.size > 32) pages.delete(pages.keys().next().value!);
  }
  const result = await resource.refresh();
  if (!result) throw new Error(resource.getSnapshot().error || 'Não foi possível consultar as transmissões.');
  return result;
}
