import { useState } from 'react';
import { MapPin, Navigation, Search } from 'lucide-react';
import { useDirectoryScope } from '../store/useDirectoryScope';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { useApp } from '../context/AppContext';

const RADIUS_OPTIONS = [5, 15, 30, 50, 100] as const;

export function LocationScopeFilter() {
  const { filter, setFilter, setRadiusKm: setScopeRadiusKm } = useDirectoryScope();
  const { setRadiusKm: setAppRadiusKm } = useApp();
  const { coords, status, request } = useBookingLocation();
  const [city, setCity] = useState(filter.city);
  const [state, setState] = useState(filter.state);
  const activeRadius = filter.radiusKm ?? 50;

  const handleSelectRadius = (km: number) => {
    setScopeRadiusKm(km);
    setAppRadiusKm(km);
  };

  return (
    <div className="aquarium-glass rounded-3xl p-5 border border-cyan-500/30 shadow-2xl text-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap gap-2" aria-label="Filtrar listagens por localização">
          {([['nearby', 'Perto de mim'], ['city', 'Cidade'], ['all', 'Todas no site']] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={filter.mode === mode}
              onClick={() =>
                setFilter({
                  mode,
                  city: mode === 'city' ? city.trim() : filter.city,
                  state: mode === 'city' ? state.trim() : filter.state,
                  radiusKm: activeRadius,
                })
              }
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                filter.mode === mode
                  ? 'bg-[#0987CE] border-cyan-400 text-white shadow-md shadow-cyan-900/40'
                  : 'bg-[#041529]/80 border-cyan-800/60 text-slate-300 hover:text-white hover:bg-[#072445]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filter.mode === 'nearby' && (
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-1 rounded-xl bg-[#030D1A]/90 p-1 border border-cyan-800/60"
              role="group"
              aria-label="Raio de distância em quilômetros"
            >
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => handleSelectRadius(km)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                    activeRadius === km
                      ? 'bg-cyan-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={status === 'locating'}
              onClick={() => void request()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/40 bg-[#052445]/90 hover:bg-[#083566] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <MapPin size={15} className="text-cyan-300" />
              <span>{status === 'locating' ? 'Localizando…' : 'Usar minha localização'}</span>
            </button>
          </div>
        )}
      </div>

      {filter.mode === 'city' && (
        <form
          className="flex flex-wrap items-end gap-3 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (city.trim())
              setFilter({
                mode: 'city',
                city: city.trim(),
                state: state.trim(),
                radiusKm: activeRadius,
              });
          }}
        >
          <label className="text-xs text-slate-300 font-bold flex-1 min-w-44 space-y-1">
            <span>Cidade</span>
            <input
              required
              maxLength={100}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Digite o nome da cidade"
              className="block w-full rounded-xl border border-cyan-800/60 bg-[#030D1A] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </label>
          <label className="text-xs text-slate-300 font-bold space-y-1">
            <span>UF (opcional)</span>
            <input
              maxLength={2}
              value={state}
              onChange={(event) => setState(event.target.value.toUpperCase())}
              placeholder="GO"
              className="block w-20 rounded-xl border border-cyan-800/60 bg-[#030D1A] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </label>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Search size={15} />
            <span>Buscar</span>
          </button>
        </form>
      )}

      {filter.mode === 'nearby' && (
        <p className="text-xs text-cyan-200/90 font-medium flex flex-wrap items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          {validCoordinates(coords)
            ? `GPS ativo (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) · Exibindo opções em até ${activeRadius} km da sua localização.`
            : status === 'denied'
            ? `Localização bloqueada no navegador · Exibindo arenas de referência em até ${activeRadius} km ou filtre por Cidade.`
            : `Exibindo opções em até ${activeRadius} km · Clique em "Usar minha localização" para calcular distâncias exatas por GPS.`}
        </p>
      )}
    </div>
  );
}
