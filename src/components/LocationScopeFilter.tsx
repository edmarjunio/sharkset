import React, { useMemo } from 'react';
import { MapPin, Navigation, ChevronDown, X } from 'lucide-react';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { useApp } from '../context/AppContext';

export function LocationScopeFilter({ className = '' }: { className?: string }) {
  const { filter, setFilter, setRadiusKm: setScopeRadiusKm } = useDirectoryScope();
  const { setRadiusKm: setAppRadiusKm, availableTenants } = useApp();
  const { coords, status, request } = useBookingLocation();

  const activeRadius = filter.radiusKm ?? 50;

  // Extrai lista única de cidades onde há arenas cadastradas no SHARKSET
  const availableCities = useMemo(() => {
    const cityMap = new Map<string, { city: string; state: string; count: number }>();
    availableTenants.forEach((a) => {
      const c = (a.city || '').trim();
      const s = (a.state || '').trim().toUpperCase();
      if (!c) return;
      const key = `${c.toLowerCase()}|${s.toLowerCase()}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        cityMap.set(key, { city: c, state: s, count: 1 });
      }
    });
    return Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));
  }, [availableTenants]);

  const selectedCityKey = filter.city
    ? `${filter.city.toLowerCase()}|${(filter.state || '').toLowerCase()}`
    : '';

  const handleSelectRadius = (km: number) => {
    setScopeRadiusKm(km);
    setAppRadiusKm(km);
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      setFilter({ ...filter, mode: 'city', city: '', state: '' });
      return;
    }
    const found = availableCities.find(
      (c) => `${c.city.toLowerCase()}|${c.state.toLowerCase()}` === val
    );
    if (found) {
      setFilter({ ...filter, mode: 'city', city: found.city, state: found.state });
    }
  };

  const handleClearCity = () => {
    setFilter({ ...filter, mode: 'city', city: '', state: '' });
  };

  return (
    <div
      className={`rounded-2xl bg-[#04162a]/90 border border-cyan-500/30 p-2 sm:p-2.5 backdrop-blur-md shadow-lg text-white ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Modos: Perto de mim | Cidade | Todas no site */}
        <div
          className="flex items-center gap-1 bg-[#020b17] p-1 rounded-xl border border-cyan-800/60"
          role="tablist"
          aria-label="Filtro de localização"
        >
          {([
            ['nearby', 'Perto de mim'],
            ['city', 'Cidade'],
            ['all', 'Todas no site'],
          ] as const).map(([mode, label]) => {
            const isActive = filter.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (mode === 'city' && !filter.city && availableCities.length > 0) {
                    setFilter({
                      mode: 'city',
                      city: availableCities[0].city,
                      state: availableCities[0].state,
                      radiusKm: activeRadius,
                    });
                  } else {
                    setFilter({ ...filter, mode });
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0987CE] text-white shadow-sm shadow-cyan-900/50'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Controles dinâmicos e compactos por modo */}
        <div className="flex flex-wrap items-center gap-2">
          {filter.mode === 'nearby' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Chips de raio compactos */}
              <div
                className="inline-flex items-center gap-0.5 rounded-lg bg-[#020b17] p-0.5 border border-cyan-800/60 text-[11px] font-bold"
                role="group"
                aria-label="Raio de distância"
              >
                {[15, 30, 50, 100].map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => handleSelectRadius(km)}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      activeRadius === km
                        ? 'bg-cyan-400 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {km}km
                  </button>
                ))}
              </div>

              {/* Botão de GPS / Localização */}
              <button
                type="button"
                disabled={status === 'locating'}
                onClick={() => void request()}
                title={
                  validCoordinates(coords)
                    ? 'GPS ativo · Clique para atualizar coordenadas'
                    : 'Clique para ativar localização via GPS'
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-[#052445]/90 hover:bg-[#083566] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <Navigation
                  size={13}
                  className={status === 'locating' ? 'animate-spin text-cyan-300' : 'text-cyan-300'}
                />
                <span>
                  {status === 'locating'
                    ? 'Localizando…'
                    : validCoordinates(coords)
                    ? 'GPS Ativo'
                    : 'Meu GPS'}
                </span>
              </button>
            </div>
          )}

          {filter.mode === 'city' && (
            <div className="flex items-center gap-2">
              {/* Dropdown com SOMENTE cidades que possuem arenas cadastradas */}
              <div className="relative inline-flex items-center min-w-[210px] sm:min-w-[260px]">
                <MapPin size={14} className="absolute left-3 text-cyan-400 pointer-events-none" />
                <select
                  value={selectedCityKey}
                  onChange={handleCityChange}
                  aria-label="Selecionar cidade com arena cadastrada"
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-[#020b17] border border-cyan-700/70 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer appearance-none shadow-inner truncate"
                >
                  <option value="">Todas as cidades com arenas ({availableCities.length})</option>
                  {availableCities.map((c) => (
                    <option
                      key={`${c.city}|${c.state}`}
                      value={`${c.city.toLowerCase()}|${c.state.toLowerCase()}`}
                    >
                      {c.city} - {c.state} ({c.count} {c.count === 1 ? 'arena' : 'arenas'})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 text-slate-400 pointer-events-none"
                />
              </div>

              {/* Botão para limpar filtro de cidade */}
              {filter.city && (
                <button
                  type="button"
                  onClick={handleClearCity}
                  title="Ver todas as cidades com arenas"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {filter.mode === 'all' && (
            <span className="text-xs text-slate-300 font-medium px-2.5 py-1 bg-white/5 rounded-lg border border-white/10">
              Todas as arenas ({availableTenants.length})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
