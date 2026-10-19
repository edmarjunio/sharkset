import { useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';

export function LocationScopeFilter() {
  const { filter, setFilter } = useDirectoryScope();
  const { coords, status, request } = useBookingLocation();
  const [city, setCity] = useState(filter.city);
  const [state, setState] = useState(filter.state);
  return <div className="space-y-3 text-white">
    <div className="flex flex-wrap gap-2" aria-label="Filtrar listagens por localização">
      {([['nearby', 'Perto de mim'], ['city', 'Cidade'], ['all', 'Todas no site']] as const).map(([mode, label]) => <button key={mode} aria-pressed={filter.mode === mode} onClick={() => setFilter({ mode, city: mode === 'city' ? city.trim() : filter.city, state: mode === 'city' ? state.trim() : filter.state })} className={`px-4 py-2 rounded-xl text-sm border ${filter.mode === mode ? 'bg-cyan-900 border-cyan-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-300'}`}>{label}</button>)}
    </div>
    {filter.mode === 'city' && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); if (city.trim()) setFilter({ mode: 'city', city: city.trim(), state: state.trim() }); }}>
      <label className="text-xs text-slate-400 flex-1 min-w-40">Cidade<input required maxLength={100} value={city} onChange={event => setCity(event.target.value)} placeholder="Nome da cidade" className="block mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" /></label>
      <label className="text-xs text-slate-400">UF (opcional)<input maxLength={2} value={state} onChange={event => setState(event.target.value.toUpperCase())} className="block mt-1 w-24 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" /></label>
      <button className="px-4 py-2 rounded-lg bg-cyan-700 inline-flex items-center gap-2"><Search size={16} />Buscar</button>
    </form>}
    {filter.mode === 'nearby' && (validCoordinates(coords) ? <p className="text-xs text-slate-400">Até 50 km da sua localização.</p> : <div className="text-sm space-y-2"><p className="text-slate-400">{status === 'denied' ? 'Localização indisponível. Ative no navegador ou escolha uma cidade.' : 'Ative a localização para encontrar opções em até 50 km.'}</p><button disabled={status === 'locating'} onClick={() => void request()} className="inline-flex items-center gap-2 text-cyan-300"><MapPin size={16} />{status === 'locating' ? 'Localizando…' : 'Usar minha localização'}</button></div>)}
  </div>;
}
