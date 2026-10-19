import { LiveDirectory } from './LiveDirectory';
import { HomeRanking } from './HomeRanking';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { calculateHaversineDistance } from '../utils/geoUtils';
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useBookingSelection } from '../store/useBookingSelection';
import type { Tournament } from '../types';

export const HomeHighlights: React.FC = () => {
  const { availableTenants, tournaments, matchesByTournament, setTenantId, setArenaSubTab, setActiveTab, setActiveTournamentId } = useApp();
  const [filter, setFilter] = useState('all');
  const { coords } = useBookingLocation();
  const distance = (arena: typeof availableTenants[number]) => validCoordinates(coords) && validCoordinates({ lat: arena.lat!, lng: arena.lng! }) ? calculateHaversineDistance(coords.lat, coords.lng, arena.lat!, arena.lng!) : arena.distanceKm;
  const { date } = useBookingSelection();
  const stage = (t: Tournament) => t.isFinished ? 'finished' : (matchesByTournament[t.id] || []).some(m => m.status === 'in_progress' || m.status === 'completed') ? 'running' : 'upcoming';
  const labels = { running: 'Em execução', upcoming: 'Próximos', finished: 'Finalizados' };
  const ordered = useMemo(() => [...tournaments].sort((a, b) => ['running', 'upcoming', 'finished'].indexOf(stage(a)) - ['running', 'upcoming', 'finished'].indexOf(stage(b)) || a.date.localeCompare(b.date)), [tournaments, matchesByTournament]);
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 text-white">
    <LiveDirectory compact />
    <HomeRanking />
    <section className="space-y-3" aria-labelledby="nearby-arenas-title">
      <div className="flex justify-between gap-3"><h2 id="nearby-arenas-title" className="font-black text-xl">Arenas próximas</h2><button onClick={() => setActiveTab('arenas_directory')} className="text-cyan-300">Localizar arenas →</button></div>
      <p className="text-xs text-slate-400">Catálogo local de referência. Distâncias aproximadas; o diretório permite autorizar a localização. A disponibilidade é consultada separadamente na agenda online.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...availableTenants].sort((a,b) => distance(a)-distance(b)).map(arena => <article key={arena.id} className="rounded-2xl border border-cyan-900 bg-slate-950 p-4 space-y-2">
        <h3 className="font-black">{arena.name}</h3><p className="text-sm text-slate-300">{arena.city}/{arena.state} · {distance(arena).toFixed(1)} km {coords && validCoordinates({ lat: arena.lat!, lng: arena.lng! }) ? 'por coordenadas' : 'de referência'}</p>
        <button className="text-cyan-300 font-bold" onClick={() => { setTenantId(arena.id); setArenaSubTab('agendamentos'); setActiveTab('scheduler'); }}>Ver Arena · {date.split('-').reverse().join('/')} →</button>
      </article>)}</div>
    </section>
    <section className="space-y-3" aria-labelledby="home-tournaments-title">
      <h2 id="home-tournaments-title" className="font-black text-xl">Campeonatos</h2>
      <p className="text-xs text-slate-400">Catálogo local do aplicativo; confirme a programação com a organização.</p>
      <label className="flex items-center gap-3 py-1">Exibir <select value={filter} onChange={e => setFilter(e.target.value)} className="min-h-10 rounded-xl bg-slate-800 px-4 py-2"><option value="all">Todos</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ordered.filter(t => filter === 'all' || stage(t) === filter).map(t => <button key={t.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-left" onClick={() => { setActiveTournamentId(t.id); setActiveTab('tournaments'); }}><span className="text-xs text-cyan-300">{labels[stage(t)]}</span><strong className="block mt-2">{t.name}</strong><span className="text-sm text-slate-400">{t.date}</span></button>)}</div>
      {!ordered.some(t => filter === 'all' || stage(t) === filter) && <p>Nenhum campeonato nesta categoria.</p>}
    </section>
  </div>;
};