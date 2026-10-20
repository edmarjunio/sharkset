import { LocationScopeFilter } from './LocationScopeFilter';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useScopedCatalog } from '../hooks/useScopedCatalog';
import { validCoordinates } from '../store/useBookingLocation';
import { useBookingLocation } from '../store/useBookingLocation';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { SportType, TenantConfig } from '../types';
import { RegionalAvailabilityFinder } from './RegionalAvailabilityFinder';
import { FreeSlotsDateTimeFilter } from './FreeSlotsDateTimeFilter';
import { ARENA_BRAND_PRESETS } from '../services/logoPaletteExtractor';
import {
  calculateHaversineDistanceKm,
  calculateArenaDistanceFromUser,
  sortArenasByProximity,
  filterAndSortArenasByProximity,
  formatArenaDistanceKm,
  isValidGeoCoordinates,
} from '../services/geoService';
import {
  clearRecentSearches,
  getPopularArenaSuggestions,
  getRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from '../services/searchSuggestions';
import {
  MapPin,
  Navigation,
  ArrowRight,
  Search,
  Trophy,
  GraduationCap,
  Zap,
  Clock,
  Palette,
  Compass,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Flame,
  Star,
} from 'lucide-react';

export const ArenasDirectory: React.FC = () => {
  const {
    availableTenants,
    tenant,
    setTenantId,
    selectedSport,
    setSelectedSport,
    setActiveTab,
    setArenaSubTab,
    tournaments,
    updateArenaBranding,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [activeFinderSection, setActiveFinderSection] = useState<'free_slots' | 'classes' | 'none'>('free_slots');

  const popularArenas = useMemo(
    () => getPopularArenaSuggestions(availableTenants, tenant),
    [availableTenants, tenant]
  );

  const { filter: locationFilter, setFilter: setLocationFilter } = useDirectoryScope();
  const { coords: userCoords, status: geoStatus, request: requestUserLocation } = useBookingLocation();
  const scopedArenas = useScopedCatalog(availableTenants, arena => arena);

  const sportNames: Record<SportType, string> = {
    futevolei: 'Futevôlei',
    beach_tennis: 'Beach Tennis',
    volei_praia: 'Vôlei de Praia',
  };

  // Compute calculated distance for each arena using geoService utilities (closest first)
  const arenasWithCalculatedDistance = useMemo(() => {
    return sortArenasByProximity(scopedArenas, userCoords);
  }, [scopedArenas, userCoords]);

  // Filter arenas by sport and search query, preserving proximity ordering
  const filteredArenas = useMemo(() => {
    return filterAndSortArenasByProximity(scopedArenas, {
      userCoords,
      sport: selectedSport,
      searchQuery,
    });
  }, [scopedArenas, userCoords, selectedSport, searchQuery]);

  // Enter selected Arena
  const handleSelectArena = (
    arena: TenantConfig,
    targetSubTab: 'agendamentos' | 'ranking' | 'campeonatos' | 'transmissoes' | 'comunidade' | 'info_historico' = 'agendamentos'
  ) => {
    setTenantId(arena.id);
    setArenaSubTab(targetSubTab);
    setActiveTab('scheduler');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      {/* Compact Top Filter Bar */}
      <div className="aquarium-glass bg-slate-950/95 text-white rounded-2xl p-3.5 sm:p-4 shadow-lg border border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Arenas</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-bold text-amber-300">
              {filteredArenas.length} {filteredArenas.length === 1 ? 'arena' : 'arenas'}
            </span>
            <button
              type="button"
              onClick={requestUserLocation}
              disabled={geoStatus === 'locating'}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-white px-2 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 cursor-pointer transition-colors"
              title="Recalcular distâncias usando GPS atual"
            >
              <RotateCw className={`w-3 h-3 ${geoStatus === 'locating' ? 'animate-spin' : ''}`} />
              <span>{geoStatus === 'granted' ? 'GPS Ativo' : 'Usar GPS'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sport Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setSelectedSport('all')}
                className={`px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  selectedSport === 'all'
                    ? 'bg-white text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedSport('futevolei')}
                className={`px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  selectedSport === 'futevolei'
                    ? 'bg-white text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ⚽ Futevôlei
              </button>
              <button
                onClick={() => setSelectedSport('beach_tennis')}
                className={`px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  selectedSport === 'beach_tennis'
                    ? 'bg-white text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🎾 Beach Tennis
              </button>
              <button
                onClick={() => setSelectedSport('volei_praia')}
                className={`px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  selectedSport === 'volei_praia'
                    ? 'bg-white text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🏐 Vôlei
              </button>
            </div>

            {/* Search Input with Recent Searches & Popular Arenas Dropdown */}
            <div className="relative w-full sm:w-64" data-testid="arenas-search-container">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  setRecentSearches(getRecentSearches());
                  setSearchDropdownOpen(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setSearchDropdownOpen(false), 180);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setRecentSearches(saveRecentSearch(searchQuery.trim()));
                    setSearchDropdownOpen(false);
                  } else if (e.key === 'Escape') {
                    setSearchDropdownOpen(false);
                  }
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchDropdownOpen(true);
                }}
                placeholder="Buscar arena ou cidade..."
                data-testid="arenas-search-input"
                className="w-full pl-9 pr-7 py-2 text-xs font-medium bg-slate-900 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              )}

              {searchDropdownOpen && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  data-testid="arenas-search-dropdown"
                  className="absolute right-0 left-0 sm:left-auto sm:w-80 top-full mt-2 z-50 rounded-2xl bg-[#071D3D] border border-[#145A9B] shadow-2xl p-3 space-y-3 text-white animate-in fade-in duration-150"
                >
                  {recentSearches.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#5BC3FA]" />
                          Pesquisas Recentes
                        </span>
                        <button
                          type="button"
                          onClick={() => setRecentSearches(clearRecentSearches())}
                          className="text-[10px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.map((term) => (
                          <div
                            key={term}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] px-2 py-1 text-[11px] text-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery(term);
                                setRecentSearches(saveRecentSearch(term));
                                setSearchDropdownOpen(false);
                              }}
                              className="font-semibold hover:text-[#12C7BB] cursor-pointer"
                            >
                              {term}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecentSearches(removeRecentSearch(term))}
                              className="text-slate-500 hover:text-white cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1 border-t border-[#145A9B]/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Arenas Populares
                      </span>
                      <span className="text-[10px] text-slate-400">Acesso rápido</span>
                    </div>
                    <div className="space-y-1">
                      {popularArenas.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setRecentSearches(saveRecentSearch(item.name));
                            setSearchDropdownOpen(false);
                            if (item.isCatalogArena) {
                              setTenantId(item.id);
                              setArenaSubTab('agenda');
                              setActiveTab('scheduler');
                            } else {
                              setSearchQuery(item.city);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B]/70 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-white truncate group-hover:text-[#12C7BB]">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {item.city}/{item.state} · {item.courtsCount} quadras
                            </p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            {item.rating.toFixed(1)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80">
          <LocationScopeFilter compact />
        </div>
      </div>

      {/* Arenas Grid — Focus exclusively on Arenas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredArenas.map((arena) => {
          const isCurrent = arena.id === tenant.id;
          const uniqueSports = Array.from(new Set(arena.courts.flatMap((c) => c.sports)));
          const minPrice = Math.min(...arena.courts.map((c) => c.hourlyRate));
          const arenaTournaments = tournaments.filter((t) => t.tenantId === arena.id);
          const coverImg =
            arena.imageUrl ||
            'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1000&q=85';

          return (
            <div
              key={arena.id}
              onClick={() => handleSelectArena(arena, 'agendamentos')}
              className={`bg-white border-2 rounded-2xl overflow-hidden transition-all cursor-pointer hover:shadow-xl flex flex-col justify-between group ${
                isCurrent ? 'border-slate-950 ring-2 ring-amber-400/60' : 'border-slate-200 hover:border-slate-900'
              }`}
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                  <img
                    src={coverImg}
                    alt={arena.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-xs text-white font-mono font-black tabular-nums border border-white/15 flex items-center gap-1 shadow-sm">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{formatArenaDistanceKm(arena.calculatedDistanceKm)}</span>
                      <span className="text-slate-400 text-[10px]">({arena.city}/{arena.state})</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-xs text-amber-400 font-black tabular-nums">
                        ★ {arena.rating.toFixed(1)}
                      </span>
                      {isCurrent && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black uppercase">
                          Selecionada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <h2 className="text-xl font-black tracking-tight group-hover:text-amber-300 transition-colors">
                      {arena.name}
                    </h2>
                    <p className="text-xs text-slate-200 truncate">{arena.address}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block text-[10px] uppercase">Quadras</span>
                      <span className="font-black text-slate-950 text-sm tabular-nums">{arena.courts.length} Quadras</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block text-[10px] uppercase">Aberta Hoje</span>
                      <span className="font-black text-slate-950 text-sm tabular-nums">
                        {arena.operatingHours.open} – {arena.operatingHours.close}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block text-[10px] uppercase">Locação / Hora</span>
                      <span className="font-black text-emerald-700 text-sm tabular-nums">A partir R$ {minPrice}</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="text-slate-800">
                      <span className="text-slate-400 font-semibold">Modalidades: </span>
                      <span className="font-extrabold">
                        {uniqueSports.map((s) => sportNames[s]).join(' · ')}
                      </span>
                    </div>
                    <div className="text-slate-600 truncate">
                      <span className="text-slate-400 font-semibold">Estrutura: </span>
                      <span>{arena.amenities.slice(0, 4).join(' · ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="px-5 pb-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectArena(arena, 'agendamentos')}
                    className="px-3 py-2 text-xs font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    Horários
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectArena(arena, 'campeonatos')}
                    className="px-3 py-2 text-xs font-extrabold text-orange-950 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trophy className="w-3.5 h-3.5 text-orange-700" />
                    Torneios ({arenaTournaments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const presetIdx =
                        availableTenants.findIndex((a) => a.id === arena.id) %
                        ARENA_BRAND_PRESETS.length;
                      const preset = ARENA_BRAND_PRESETS[Math.max(0, presetIdx)];
                      updateArenaBranding(arena.id, {
                        logoUrl: arena.logoUrl || preset.logoUrl,
                        brandPalette: arena.brandPalette || preset.palette,
                        whiteLabelEnabled: true,
                      });
                      handleSelectArena(arena, 'agendamentos');
                    }}
                    className="px-3 py-2 text-xs font-extrabold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Palette className="w-3.5 h-3.5 text-orange-600" />
                    Página Oficial
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectArena(arena, 'agendamentos')}
                  className="px-4 py-2.5 text-xs font-black text-white bg-[#FF6B00] hover:bg-[#EA580C] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  ENTRAR NA ARENA
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredArenas.length === 0 && (
          <div className="aquarium-glass col-span-full bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-12 text-center space-y-4 text-white shadow-2xl">
            <MapPin className="w-12 h-12 text-cyan-400 mx-auto" />
            <h3 className="text-lg font-black text-white">
              {availableTenants.length === 0
                ? 'Nenhuma arena cadastrada ainda'
                : 'Nenhuma arena encontrada para este local'}
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              {availableTenants.length === 0
                ? 'Cadastre a sua primeira arena oficial para liberar agendamentos, quadras e transmissões.'
                : 'Altere a cidade no filtro acima ou veja todas as arenas cadastradas.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('saas_hub')}
                className="px-6 py-3 text-xs font-black text-white bg-gradient-to-r from-[#FF6B00] to-[#FF8800] hover:brightness-110 rounded-xl transition-all cursor-pointer shadow-lg"
              >
                + Cadastrar Minha Arena Agora
              </button>
              {availableTenants.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLocationFilter({ ...locationFilter, mode: 'all' })}
                  className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
                >
                  VER TODAS AS ARENAS NO SITE
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
