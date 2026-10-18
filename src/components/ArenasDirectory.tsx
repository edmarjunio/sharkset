import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SportType, TenantConfig } from '../types';
import { RegionalAvailabilityFinder } from './RegionalAvailabilityFinder';
import { ARENA_BRAND_PRESETS } from '../services/logoPaletteExtractor';
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
} from 'lucide-react';

export const ArenasDirectory: React.FC = () => {
  const {
    availableTenants,
    tenant,
    setTenantId,
    radiusKm,
    setRadiusKm,
    selectedSport,
    setSelectedSport,
    setActiveTab,
    setArenaSubTab,
    tournaments,
    updateArenaBranding,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showRegionalClassFinder, setShowRegionalClassFinder] = useState(true);

  const radiusOptions = [
    { km: 5, label: 'Até 5 km' },
    { km: 15, label: 'Até 15 km' },
    { km: 30, label: 'Até 30 km' },
    { km: 50, label: 'Até 50 km' },
    { km: 500, label: 'Todo o Estado' },
  ];

  const sportNames: Record<SportType, string> = {
    futevolei: 'Futevôlei',
    beach_tennis: 'Beach Tennis',
    volei_praia: 'Vôlei de Praia',
  };

  // Filter arenas by radius, sport, and search query
  const filteredArenas = useMemo(() => {
    return availableTenants
      .filter((arena) => {
        if (arena.distanceKm > radiusKm) return false;

        if (selectedSport !== 'all') {
          const hasSport = arena.courts.some((c) => c.sports.includes(selectedSport));
          if (!hasSport) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = arena.name.toLowerCase().includes(q);
          const matchCity = arena.city.toLowerCase().includes(q);
          const matchAddress = arena.address.toLowerCase().includes(q);
          if (!matchName && !matchCity && !matchAddress) return false;
        }

        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [availableTenants, radiusKm, selectedSport, searchQuery]);

  // Enter selected Arena
  const handleSelectArena = (arena: TenantConfig, targetSubTab: 'agenda' | 'aulas' | 'campeonatos' = 'agenda') => {
    setTenantId(arena.id);
    setArenaSubTab(targetSubTab);
    setActiveTab('scheduler');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* High-Impact Minimalist Hero & Filter Bar */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-md space-y-5 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
              <Navigation className="w-3.5 h-3.5" />
              <span>LOCALIZAÇÃO BASE: MINEIROS, GO</span>
              <span>·</span>
              <span className="text-emerald-400">
                RAIO ATIVO: {radiusKm >= 500 ? 'TODO O ESTADO' : `${radiusKm} KM`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Arenas na Sua Região — Agende e Pague em 2 Cliques
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Escolha a arena abaixo para reservar seu horário imediatamente ou busque aulas por dia e horário na sua região.
            </p>
          </div>

          {/* Search Input & Toggle Class Finder */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowRegionalClassFinder((v) => !v)}
              className="px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Clock className="w-4 h-4" />
              {showRegionalClassFinder ? 'Ocultar Busca por Horário' : 'Buscar Aula por Dia/Horário'}
            </button>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar arena ou cidade..."
                className="w-full pl-10 pr-4 py-3 text-xs font-medium bg-slate-900 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>

        {/* High-Visibility Radius Selector + Sport Filter */}
        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Radius Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-amber-400 mr-1 flex items-center gap-1 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5" />
              Raio de Alcance:
            </span>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              {radiusOptions.map((opt) => (
                <button
                  key={opt.km}
                  onClick={() => setRadiusKm(opt.km)}
                  className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                    radiusKm === opt.km
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sport Filter */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
            <button
              onClick={() => setSelectedSport('all')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                selectedSport === 'all'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todos Esportes
            </button>
            <button
              onClick={() => setSelectedSport('futevolei')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                selectedSport === 'futevolei'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ⚽ Futevôlei
            </button>
            <button
              onClick={() => setSelectedSport('beach_tennis')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                selectedSport === 'beach_tennis'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🎾 Beach Tennis
            </button>
            <button
              onClick={() => setSelectedSport('volei_praia')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                selectedSport === 'volei_praia'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🏐 Vôlei
            </button>
          </div>
        </div>
      </div>

      {/* Regional Class & Court Availability Finder ("Quero Terça e Quinta 7 às 8") */}
      {showRegionalClassFinder && <RegionalAvailabilityFinder />}

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
        <span>
          Exibindo <strong className="text-slate-950 font-black tabular-nums">{filteredArenas.length}</strong>{' '}
          {filteredArenas.length === 1 ? 'arena disponível' : 'arenas disponíveis'} dentro de{' '}
          {radiusKm >= 500 ? 'todo o estado' : `${radiusKm} km`}
        </span>
        <span>Ordenado por menor distância</span>
      </div>

      {/* Arenas Grid — High-Contrast Cards with Arena Photo & 1-Click Direct Booking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredArenas.map((arena) => {
          const isCurrent = arena.id === tenant.id;
          const uniqueSports = Array.from(new Set(arena.courts.flatMap((c) => c.sports)));
          const minPrice = Math.min(...arena.courts.map((c) => c.hourlyRate));
          const totalClasses = arena.courts.reduce((acc, c) => acc + (c.classSchedules?.length || 0), 0);
          const arenaTournaments = tournaments.filter((t) => t.tenantId === arena.id);
          const coverImg =
            arena.imageUrl ||
            'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1000&q=85';

          return (
            <div
              key={arena.id}
              onClick={() => handleSelectArena(arena, 'agenda')}
              className={`bg-white border-2 rounded-2xl overflow-hidden transition-all cursor-pointer hover:shadow-xl flex flex-col justify-between group ${
                isCurrent ? 'border-slate-950 ring-2 ring-amber-400/60' : 'border-slate-200 hover:border-slate-900'
              }`}
            >
              <div>
                {/* Arena Cover Image Header */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                  <img
                    src={coverImg}
                    alt={arena.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                  {/* Top Distance & Active Status over Image */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-xs text-white font-mono font-black tabular-nums border border-white/15">
                      📍 {arena.distanceKm.toFixed(1)} km · {arena.city}/{arena.state}
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

                  {/* Arena Title at Bottom of Image */}
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <h2 className="text-xl font-black tracking-tight group-hover:text-amber-300 transition-colors">
                      {arena.name}
                    </h2>
                    <p className="text-xs text-slate-200 truncate">{arena.address}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Key Specs Highlight Box */}
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

                  {/* Sports & Amenities Clean Typography */}
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

              {/* Unmistakable Direct Entry Buttons */}
              <div
                className="px-5 pb-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectArena(arena, 'aulas')}
                    className="px-3 py-2 text-xs font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-slate-600" />
                    Aulas ({totalClasses})
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
                      handleSelectArena(arena, 'agenda');
                    }}
                    className="px-3 py-2 text-xs font-extrabold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Abrir página da Arena toda na paleta da logo da Arena com DESENVOLVIDO POR SHARKSET"
                  >
                    <Palette className="w-3.5 h-3.5 text-orange-600" />
                    Site da Arena (Logo)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectArena(arena, 'agenda')}
                  className="px-4 py-2.5 text-xs font-black text-white bg-[#FF6B00] hover:bg-[#EA580C] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 fill-white" />
                  AGENDAR HORÁRIO & PAGAR
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredArenas.length === 0 && (
          <div className="col-span-full bg-white border-2 border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <MapPin className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-black text-slate-900">
              Nenhuma arena encontrada num raio de {radiusKm} km
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Clique abaixo para ampliar o alcance e ver todas as unidades em Goiás.
            </p>
            <button
              onClick={() => setRadiusKm(500)}
              className="mt-2 px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
            >
              MOSTRAR TODAS AS ARENAS DO ESTADO
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
