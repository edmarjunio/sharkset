import { readLivePage } from '../services/livePageCache';
import { livekitApiPath } from '../services/livekitApi';
import { LocationScopeFilter } from './LocationScopeFilter';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Radio, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { useBroadcastNavigation } from '../store/useBroadcastNavigation';

type LiveItem = { id: string; title: string; city: string; state: string; arenaName: string; distanceKm: number | null };
type Filter = { mode: 'nearby' | 'city' | 'all'; city: string; state: string };
export function LiveDirectory({ compact = false }: { compact?: boolean }) {
  const { setActiveTab } = useApp();
  const { coords, status: locationStatus, request } = useBookingLocation();
  const { filter } = useDirectoryScope();
  const [items, setItems] = useState<LiveItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const pending = useRef(false);
  const currentRequest = useRef<AbortController | null>(null);
  const canSearch = filter.mode === 'city' ? !!filter.city : filter.mode !== 'nearby' || validCoordinates(coords);
  const load = useCallback(async (after?: string) => {
    if (!canSearch || pending.current) return;
    const version = generation.current;
    pending.current = true; setLoading(true); setError('');
    const controller = new AbortController(); currentRequest.current = controller;
    try {
      const params = new URLSearchParams({ mode: filter.mode });
      if (filter.mode === 'city') { params.set('city', filter.city); if (filter.state) params.set('state', filter.state); }
      if (filter.mode === 'nearby' && coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)); }
      if (after) params.set('cursor', after);
      const data = await readLivePage((import.meta.env.VITE_LIVEKIT_ENABLED === 'true' ? livekitApiPath('directory') : '/api/broadcasts') + '?' + params);
      if (version !== generation.current) return;
      setItems(previous => after ? [...new Map([...previous, ...data.items].map((item: LiveItem) => [item.id, item])).values()] : data.items);
      setCursor(data.nextCursor);
    } catch (failure) {
      if (version === generation.current && !controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar as transmissões.');
      }
    } finally { if (version === generation.current) { pending.current = false; setLoading(false); } }
  }, [canSearch, filter, coords?.lat, coords?.lng]);
  useEffect(() => {
    generation.current++; pending.current = false; setItems([]); setCursor(null); setLoading(false); setError(''); currentRequest.current?.abort();
    void load();
    return () => { generation.current++; currentRequest.current?.abort(); pending.current = false; };
  }, [load]);
  return <section className={compact ? 'space-y-3' : 'max-w-7xl mx-auto px-4 sm:px-6 py-5 text-white space-y-5'} aria-labelledby={compact ? 'home-live-title' : 'live-directory-title'}>
    <header className="flex justify-between items-center gap-3">
      <div>
        <h1 id={compact ? 'home-live-title' : 'live-directory-title'} className="text-xl font-bold flex items-center gap-2">
          <Radio size={20} className="text-red-400" />
          {compact ? (filter.mode === 'nearby' ? 'Jogos ao vivo perto de você' : filter.mode === 'city' ? `Jogos ao vivo em ${filter.city || 'outra cidade'}` : 'Jogos ao vivo') : 'LIVE'}
        </h1>
        {!compact && <p className="text-xs text-slate-400 mt-1">Acompanhe as transmissões das arenas.</p>}
      </div>
      {compact && (
        <button
          onClick={() => setActiveTab('live')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/40 bg-[#052445]/90 hover:bg-[#083566] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <span>Ver transmissões →</span>
        </button>
      )}
    </header>
    {!compact && <LocationScopeFilter />}
    {filter.mode === 'nearby' && !validCoordinates(coords) ? (compact ? <p className="text-sm text-slate-400">Escolha uma localização no filtro acima para ver os jogos.</p> : null) : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <button key={item.id} onClick={() => useBroadcastNavigation.getState().open({ kind: 'published', id: item.id })} className="rounded-2xl border border-slate-700 hover:border-red-400 bg-slate-950 p-4 text-left space-y-2"><span className="inline-flex items-center gap-2 text-xs font-bold text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />AO VIVO</span><strong className="block">{item.title}</strong><span className="block text-xs text-slate-400">{[item.arenaName, [item.city, item.state].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Localização não informada'}{item.distanceKm !== null ? ` · ${item.distanceKm} km` : ''}</span><span className="block text-sm text-cyan-300">Assistir →</span></button>)}</div>
      {!loading && !items.length && !error && <p className="text-sm text-slate-400">{filter.mode === 'city' && !filter.city ? 'Selecione uma cidade no filtro acima para ver as transmissões.' : cursor ? 'Nenhuma transmissão encontrada nesta parte da busca.' : 'Nenhuma transmissão disponível para este local.'}</p>}
      {error && <div role="alert" className="text-sm text-red-300">{error}<button onClick={() => void load(cursor || undefined)} className="ml-3 underline">Tentar novamente</button></div>}
      {loading && <p role="status" className="text-sm text-slate-400">Buscando transmissões…</p>}
      {!compact && cursor && !error && <button disabled={loading} onClick={() => void load(cursor)} className="border border-slate-600 px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">{loading ? 'Buscando…' : items.length ? 'Carregar mais' : 'Continuar busca'}</button>}
      {!compact && <p className="text-xs text-slate-500">Resultados carregados em partes. Transmissões sem localização aparecem em “Todas no site”.</p>}
    </>}
  </section>;
}
