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
  const [filter, setFilter] = useState<Filter>({ mode: 'nearby', city: '', state: '' });
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
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
      const response = await fetch('/api/broadcasts?' + params, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar as transmissões.');
      if (version !== generation.current) return;
      setItems(previous => after ? [...new Map([...previous, ...data.items].map((item: LiveItem) => [item.id, item])).values()] : data.items);
      setCursor(data.nextCursor);
    } catch (failure) {
      if (version === generation.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Falha na consulta. Tente novamente.');
    } finally { if (version === generation.current) { pending.current = false; setLoading(false); } }
  }, [canSearch, filter, coords?.lat, coords?.lng]);
  useEffect(() => {
    generation.current++; pending.current = false; setItems([]); setCursor(null); setLoading(false); setError(''); currentRequest.current?.abort();
    void load();
    return () => { generation.current++; currentRequest.current?.abort(); pending.current = false; };
  }, [load]);
  return <section className={compact ? 'space-y-3' : 'max-w-7xl mx-auto px-4 sm:px-6 py-5 text-white space-y-5'} aria-labelledby={compact ? 'home-live-title' : 'live-directory-title'}>
    <header className="flex justify-between items-center gap-3"><div><h1 id={compact ? 'home-live-title' : 'live-directory-title'} className="text-xl font-bold flex items-center gap-2"><Radio size={20} className="text-red-400" />{compact ? 'Jogos ao vivo perto de você' : 'LIVE'}</h1>{!compact && <p className="text-xs text-slate-400 mt-1">Acompanhe as transmissões das arenas.</p>}</div>{compact && <button onClick={() => setActiveTab('live')} className="text-cyan-300 text-sm py-2">Ver transmissões →</button>}</header>
    {!compact && <div className="flex flex-wrap gap-2" aria-label="Local das transmissões">{([['nearby', 'Perto de mim'], ['city', 'Outra cidade'], ['all', 'Todas no site']] as const).map(([mode, label]) => <button key={mode} aria-pressed={filter.mode === mode} onClick={() => { if (mode === 'city') setFilter({ mode, city: city.trim(), state: state.trim() }); else setFilter({ mode, city: '', state: '' }); }} className={`px-4 py-2 rounded-xl text-sm border ${filter.mode === mode ? 'bg-cyan-900 border-cyan-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{label}</button>)}</div>}
    {!compact && filter.mode === 'city' && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); if (city.trim()) setFilter({ mode: 'city', city: city.trim(), state: state.trim() }); }}>
      <label className="text-xs text-slate-400 flex-1 min-w-40">Cidade<input required maxLength={100} value={city} onChange={event => setCity(event.target.value)} placeholder="Nome da cidade" className="block mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" /></label>
      <label className="text-xs text-slate-400">UF (opcional)<input maxLength={2} value={state} onChange={event => setState(event.target.value.toUpperCase())} className="block mt-1 w-24 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" /></label>
      <button className="px-4 py-2 rounded-lg bg-cyan-700 inline-flex items-center gap-2"><Search size={16} />Buscar</button>
    </form>}
    {filter.mode === 'nearby' && !validCoordinates(coords) ? <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm space-y-3"><p className="text-slate-300">{locationStatus === 'denied' ? 'Localização indisponível. Ative no navegador ou busque uma cidade na tela LIVE.' : 'Use sua localização para encontrar transmissões em até 50 km.'}</p><button disabled={locationStatus === 'locating'} onClick={() => void request()} className="inline-flex items-center gap-2 text-cyan-300"><MapPin size={16} />{locationStatus === 'locating' ? 'Localizando…' : 'Usar minha localização'}</button></div> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <button key={item.id} onClick={() => useBroadcastNavigation.getState().open({ kind: 'published', id: item.id })} className="rounded-2xl border border-slate-700 hover:border-red-400 bg-slate-950 p-4 text-left space-y-2"><span className="inline-flex items-center gap-2 text-xs font-bold text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />AO VIVO</span><strong className="block">{item.title}</strong><span className="block text-xs text-slate-400">{[item.arenaName, [item.city, item.state].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Localização não informada'}{item.distanceKm !== null ? ` · ${item.distanceKm} km` : ''}</span><span className="block text-sm text-cyan-300">Assistir →</span></button>)}</div>
      {!loading && !items.length && !error && <p className="text-sm text-slate-400">{filter.mode === 'city' && !filter.city ? 'Digite uma cidade para buscar.' : cursor ? 'Nenhuma transmissão encontrada nesta parte da busca.' : 'Nenhuma transmissão disponível para este local.'}</p>}
      {error && <div role="alert" className="text-sm text-red-300">{error}<button onClick={() => void load(cursor || undefined)} className="ml-3 underline">Tentar novamente</button></div>}
      {loading && <p role="status" className="text-sm text-slate-400">Buscando transmissões…</p>}
      {!compact && cursor && !error && <button disabled={loading} onClick={() => void load(cursor)} className="border border-slate-600 px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">{loading ? 'Buscando…' : items.length ? 'Carregar mais' : 'Continuar busca'}</button>}
      {!compact && <p className="text-xs text-slate-500">Resultados carregados em partes. Transmissões sem localização aparecem em “Todas no site”.</p>}
    </>}
  </section>;
}
