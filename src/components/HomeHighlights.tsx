import { DropdownUI } from './DropdownUI';
import { LocationScopeFilter } from './LocationScopeFilter';
import { useScopedCatalog } from '../hooks/useScopedCatalog';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { LiveDirectory } from './LiveDirectory';
import { HomeRanking } from './HomeRanking';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { calculateHaversineDistance } from '../utils/geoUtils';
import React, { useMemo, useState } from 'react';
import { Compass, MapPin, Navigation, PlusCircle, Sparkles, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Tournament } from '../types';

export const HomeHighlights: React.FC = () => {
  const {
    availableTenants,
    tournaments,
    matchesByTournament,
    setTenantId,
    setArenaSubTab,
    setActiveTab,
    setActiveTournamentId,
  } = useApp();
  const [filter, setFilter] = useState('all');
  const { coords, status: locationStatus, request: requestLocation } = useBookingLocation();
  const { filter: scopeFilter, setFilter: setScopeFilter } = useDirectoryScope();

  const distance = (arena: (typeof availableTenants)[number]) =>
    validCoordinates(coords) && validCoordinates({ lat: arena.lat!, lng: arena.lng! })
      ? calculateHaversineDistance(coords.lat, coords.lng, arena.lat!, arena.lng!)
      : arena.distanceKm;

  const scopedArenas = useScopedCatalog(availableTenants, (arena) => arena);
  const scopedTournaments = useScopedCatalog(
    tournaments,
    (tournament) => availableTenants.find((arena) => arena.id === tournament.tenantId) || {}
  );
  const stage = (t: Tournament) =>
    t.isFinished
      ? 'finished'
      : (matchesByTournament[t.id] || []).some(
          (m) => m.status === 'in_progress' || m.status === 'completed'
        )
      ? 'running'
      : 'upcoming';
  const labels = { running: 'Em execução', upcoming: 'Próximos', finished: 'Finalizados' };
  const ordered = useMemo(
    () =>
      [...scopedTournaments].sort(
        (a, b) =>
          ['running', 'upcoming', 'finished'].indexOf(stage(a)) -
            ['running', 'upcoming', 'finished'].indexOf(stage(b)) || a.date.localeCompare(b.date)
      ),
    [scopedTournaments, matchesByTournament]
  );

  const handleFindArenasNearMe = () => {
    setScopeFilter({
      ...scopeFilter,
      mode: 'nearby',
      radiusKm: scopeFilter.radiusKm ?? 50,
    });
    void requestLocation();
  };

  const handleShowAllArenas = () => {
    setScopeFilter({
      ...scopeFilter,
      mode: 'all',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-white space-y-6">
      {/* Top Filter & Scope Header */}
      <div className="w-full">
        <LocationScopeFilter />
      </div>

      {/* Fallback Interativo quando nenhuma arena está carregada ou disponível no filtro atual */}
      {scopedArenas.length === 0 && (
        <section
          aria-label="Encontrar Arenas Perto de Você"
          className="aquarium-glass rounded-3xl p-5 sm:p-6 border border-cyan-400/35 bg-gradient-to-r from-[#041529]/95 via-[#062342]/90 to-[#041529]/95 shadow-2xl"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 via-orange-500/20 to-cyan-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <Compass className="w-6 h-6 text-amber-300" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  <Zap className="w-3 h-3" />
                  <span>Carrossel de Horários &amp; Quadras</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Encontrar Arenas Perto de Você
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  {availableTenants.length === 0
                    ? 'Nenhuma arena está carregada no momento. Os carrosséis de horários livres (na TopBar, na Home e na barra flutuante) aparecem automaticamente assim que houver arenas ativas ou cadastradas.'
                    : 'Nenhuma arena foi encontrada para o filtro de localização atual. Ative seu GPS para buscar arenas próximas ou exiba todas as arenas da plataforma.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleFindArenasNearMe}
                disabled={locationStatus === 'locating'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(18,199,187,0.35)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {locationStatus === 'locating' ? 'Localizando GPS…' : 'Buscar Arenas Próximas'}
                </span>
              </button>

              {scopeFilter.mode !== 'all' && availableTenants.length > 0 && (
                <button
                  type="button"
                  onClick={handleShowAllArenas}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#052445]/90 hover:bg-[#083566] text-cyan-200 border border-cyan-500/40 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Mostrar Todas ({availableTenants.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('arenas_directory')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                <span>Diretório de Arenas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('arena_admin')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 font-black text-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>Cadastrar Arena</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Grid: 12-Column Responsive Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols on desktop): Live Directory + Tournaments */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="aquarium-glass rounded-3xl p-4 sm:p-5 border border-cyan-500/25 shadow-xl">
            <LiveDirectory compact />
          </div>

          <section
            className="aquarium-glass rounded-3xl p-4 sm:p-5 border border-cyan-500/25 shadow-xl space-y-4"
            aria-labelledby="home-tournaments-title"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h2
                  id="home-tournaments-title"
                  className="font-black text-lg sm:text-xl text-white flex items-center gap-2"
                >
                  🏆 Campeonatos
                </h2>
                <p className="text-xs text-slate-400">
                  Catálogo oficial de torneios e chaves homologadas.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                Status:
                <DropdownUI
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="min-h-9 rounded-xl bg-slate-900 border border-cyan-800/60 px-3 py-1.5 text-xs text-white"
                >
                  <option value="all">Todos</option>
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </DropdownUI>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {ordered
                .filter((t) => filter === 'all' || stage(t) === filter)
                .map((t) => (
                  <button
                    key={t.id}
                    className="rounded-2xl border border-slate-700/80 hover:border-cyan-400 bg-slate-950/90 p-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md cursor-pointer flex flex-col justify-between min-h-[110px]"
                    onClick={() => {
                      setActiveTournamentId(t.id);
                      setActiveTab('tournaments');
                    }}
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                        {labels[stage(t)]}
                      </span>
                      <strong className="block mt-2 text-sm sm:text-base font-extrabold text-white line-clamp-1">
                        {t.name}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-2 mt-2">
                      <span>Data: {t.date}</span>
                      <span className="text-cyan-400 font-bold">Ver Chave →</span>
                    </div>
                  </button>
                ))}
            </div>
            {!ordered.some((t) => filter === 'all' || stage(t) === filter) && (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nenhum campeonato nesta categoria.
              </p>
            )}
          </section>
        </div>

        {/* Right Column (4 cols on desktop): Ranking Leaders + Nearby Arenas */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="aquarium-glass rounded-3xl p-4 sm:p-5 border border-cyan-500/25 shadow-xl">
            <HomeRanking />
          </div>

          <section
            className="aquarium-glass rounded-3xl p-4 sm:p-5 border border-cyan-500/25 shadow-xl space-y-3.5"
            aria-labelledby="nearby-arenas-title"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <h2
                id="nearby-arenas-title"
                className="font-black text-base sm:text-lg text-white flex items-center gap-1.5"
              >
                📍 Arenas Próximas
              </h2>
              <button
                onClick={() => setActiveTab('arenas_directory')}
                className="site-secondary-action aquarium-glass text-xs py-1 px-2.5"
              >
                Ver Todas →
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Quadras de areia e disponibilidade em tempo real para locação.
            </p>

            {scopedArenas.length > 0 ? (
              <div className="flex flex-col gap-3">
                {scopedArenas.slice(0, 4).map((arena) => (
                  <article
                    key={arena.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2 hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-sm text-white truncate">{arena.name}</h3>
                      <span className="text-[10px] text-cyan-300 font-mono shrink-0">
                        {distance(arena).toFixed(1)} km
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {arena.city}/{arena.state}
                    </p>
                    <button
                      className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-cyan-200 text-xs font-black flex items-center justify-center gap-1 transition-all"
                      onClick={() => {
                        setTenantId(arena.id);
                        setArenaSubTab('agendamentos');
                        setActiveTab('scheduler');
                      }}
                    >
                      Ver Horários da Arena →
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-cyan-500/30 bg-[#030D1A]/90 p-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center mx-auto">
                  <MapPin className="w-5 h-5 text-cyan-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-black text-white">
                    Encontrar Arenas Perto de Você
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {availableTenants.length === 0
                      ? 'Cadastre uma arena ou explore o diretório para ativar os horários livres em tempo real.'
                      : 'Ative sua localização ou amplie o raio de busca para visualizar quadras disponíveis.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleFindArenasNearMe}
                    disabled={locationStatus === 'locating'}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>
                      {locationStatus === 'locating'
                        ? 'Localizando…'
                        : 'Encontrar Arenas Próximas'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      availableTenants.length === 0
                        ? setActiveTab('arena_admin')
                        : setActiveTab('arenas_directory')
                    }
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>
                      {availableTenants.length === 0
                        ? 'Cadastrar Nova Arena →'
                        : 'Explorar Diretório de Arenas →'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};