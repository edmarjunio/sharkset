import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { SportType, TenantConfig } from '../types';
import { calculateHaversineDistance, GeoCoordinates, DEFAULT_BASE_COORDINATES } from '../utils/geoUtils';
import {
  Calendar,
  Clock,
  MapPin,
  Zap,
  ArrowRight,
  Filter,
  CheckCircle2,
  Navigation,
  Sparkles,
  Phone,
} from 'lucide-react';

interface FreeSlotsDateTimeFilterProps {
  userCoords?: GeoCoordinates | null;
  onSelectSlot?: (arena: TenantConfig, courtId: string, time: string, date: string) => void;
  className?: string;
  defaultSport?: SportType | 'all';
}

export const FreeSlotsDateTimeFilter: React.FC<FreeSlotsDateTimeFilterProps> = ({
  userCoords,
  onSelectSlot,
  className = '',
  defaultSport = 'all',
}) => {
  const {
    availableTenants,
    bookings,
    setTenantId,
    setActiveTab,
    setArenaSubTab,
    setSelectedSport,
  } = useApp();

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Quick date options for the next 5 days
  const dateOptions = useMemo(() => {
    const list = [];
    const base = new Date();
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const isTomorrow = i === 1;
      const label = isToday
        ? 'Hoje'
        : isTomorrow
        ? 'Amanhã'
        : `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]}`;

      list.push({ iso, label, fullDate: d });
    }
    return list;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('19:00');
  const [selectedSportFilter, setSelectedSportFilter] = useState<SportType | 'all'>(defaultSport);

  // Quick popular hour shortcuts
  const popularHours = [
    { time: '06:00', label: '06h' },
    { time: '07:00', label: '07h' },
    { time: '08:00', label: '08h' },
    { time: '09:00', label: '09h' },
    { time: '16:00', label: '16h' },
    { time: '17:00', label: '17h' },
    { time: '18:00', label: '18h (Pico)' },
    { time: '19:00', label: '19h (Pico)' },
    { time: '20:00', label: '20h (Pico)' },
    { time: '21:00', label: '21h' },
    { time: '22:00', label: '22h' },
  ];

  // Sport labels
  const sportLabels: Record<SportType, string> = {
    futevolei: '⚽ Futevôlei',
    beach_tennis: '🎾 Beach Tennis',
    volei_praia: '🏐 Vôlei de Praia',
  };

  // Compute available arenas and courts matching selected date, time, and sport
  const availableResults = useMemo(() => {
    const selectedHour = parseInt(selectedTime.split(':')[0], 10) || 19;
    const isPeakTime = selectedHour >= 18;

    const list: {
      arena: TenantConfig;
      court: TenantConfig['courts'][0];
      distanceKm: number;
      price: number;
      isPeak: boolean;
      whatsappUrl: string;
    }[] = [];

    for (const arena of availableTenants) {
      // Calculate distance based on GPS coords if provided, otherwise default arena distance
      const distance =
        userCoords && arena.lat && arena.lng
          ? calculateHaversineDistance(userCoords.lat, userCoords.lng, arena.lat, arena.lng)
          : arena.distanceKm;

      // Check arena opening hours
      const openHour = parseInt((arena.operatingHours.open || '06:00').split(':')[0], 10) || 6;
      const closeHour = parseInt((arena.operatingHours.close || '23:00').split(':')[0], 10) || 23;

      if (selectedHour < openHour || selectedHour >= closeHour) {
        continue;
      }

      for (const court of arena.courts) {
        // Filter by sport
        if (selectedSportFilter !== 'all' && !court.sports.includes(selectedSportFilter)) {
          continue;
        }

        // Check court hours
        const courtOpen = parseInt((court.openTime || arena.operatingHours.open || '06:00').split(':')[0], 10) || 6;
        const courtClose = parseInt((court.closeTime || arena.operatingHours.close || '23:00').split(':')[0], 10) || 23;
        if (selectedHour < courtOpen || selectedHour >= courtClose) continue;

        // Check if court is booked at selected date and time
        const isBooked = bookings.some(
          (b) =>
            b.tenantId === arena.id &&
            b.courtId === court.id &&
            b.date === selectedDate &&
            b.startTime === selectedTime &&
            b.status === 'confirmed'
        );

        if (isBooked) continue;

        const price = isPeakTime && court.peakHourlyRate ? court.peakHourlyRate : court.hourlyRate;
        const cleanWhatsapp = (arena.whatsapp || '5564999990001').replace(/\D/g, '');
        const whatsappMsg = encodeURIComponent(
          `Olá ${arena.name}! Vi no SHARKSET o horário livre das ${selectedTime} no dia ${selectedDate} na ${court.name} (R$ ${price}/h) e gostaria de confirmar a reserva!`
        );
        const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${whatsappMsg}`;

        list.push({
          arena,
          court,
          distanceKm: distance,
          price,
          isPeak: isPeakTime,
          whatsappUrl,
        });
      }
    }

    // Sort by shortest distance first
    return list.sort((a, b) => a.distanceKm - b.distanceKm);
  }, [availableTenants, bookings, selectedDate, selectedTime, selectedSportFilter, userCoords]);

  const handleBookingClick = (
    arena: TenantConfig,
    courtId: string,
    time: string,
    date: string
  ) => {
    if (onSelectSlot) {
      onSelectSlot(arena, courtId, time, date);
      return;
    }
    // Default flow: select arena and navigate to scheduler
    setTenantId(arena.id);
    setArenaSubTab('agendamentos');
    setActiveTab('scheduler');
  };

  return (
    <div
      className={`aquarium-glass bg-slate-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-cyan-500/30 space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-cyan-400 uppercase tracking-widest">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>ENCONTRE QUADRAS LIVRES POR DATA & HORÁRIO</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Filtro de Horários Livres nas Arenas Próximas
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Selecione o dia e o horário exato que deseja jogar. Calculamos a distância em km e o preço em tempo real!
          </p>
        </div>

        {/* GPS Badge Indicator */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-400/30 text-cyan-200 text-xs font-extrabold shrink-0">
          <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {userCoords
              ? 'GPS ATIVO: Distâncias calculadas em tempo real'
              : 'Referência: Mineiros, GO (padrão)'}
          </span>
        </div>
      </div>

      {/* Filter Controls Grid: Date, Time, Sport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. SELEÇÃO DE DATA */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            1. Selecionar Data
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {dateOptions.map((opt) => {
              const isSelected = selectedDate === opt.iso;
              return (
                <button
                  key={opt.iso}
                  type="button"
                  onClick={() => setSelectedDate(opt.iso)}
                  className={`px-3 py-2 text-xs font-black rounded-xl cursor-pointer transition-all border text-center ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                      : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <input
            type="date"
            min={todayStr}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full mt-1.5 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
          />
        </div>

        {/* 2. SELEÇÃO DE HORÁRIO ESPECÍFICO */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              2. Horário Específico
            </span>
            <span className="font-mono text-[11px] text-cyan-400">{selectedTime}</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {popularHours.map((h) => {
              const isSelected = selectedTime === h.time;
              return (
                <button
                  key={h.time}
                  type="button"
                  onClick={() => setSelectedTime(h.time)}
                  className={`px-2 py-2 text-xs font-black rounded-xl cursor-pointer transition-all border text-center ${
                    isSelected
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-md font-black'
                      : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {h.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
              Outro horário:
            </span>
            <input
              type="time"
              step="3600"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* 3. SELEÇÃO DE ESPORTE */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            3. Modalidade Esportiva
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSportFilter('all')}
              className={`px-3 py-2 text-xs font-extrabold rounded-xl cursor-pointer transition-all border text-left flex items-center justify-between ${
                selectedSportFilter === 'all'
                  ? 'bg-white text-slate-950 border-white shadow-md font-black'
                  : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span>Qualquer Modalidade</span>
              {selectedSportFilter === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
            {(['futevolei', 'beach_tennis', 'volei_praia'] as SportType[]).map((sport) => {
              const isSelected = selectedSportFilter === sport;
              return (
                <button
                  key={sport}
                  type="button"
                  onClick={() => setSelectedSportFilter(sport)}
                  className={`px-3 py-2 text-xs font-extrabold rounded-xl cursor-pointer transition-all border text-left flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-md font-black'
                      : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>{sportLabels[sport]}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="pt-2 flex items-center justify-between text-xs font-bold text-slate-300 border-t border-cyan-500/20">
        <span>
          Encontradas <strong className="text-cyan-300 font-black tabular-nums">{availableResults.length}</strong>{' '}
          quadras disponíveis para <strong>{selectedDate}</strong> às <strong>{selectedTime}</strong>
        </span>
        <span className="text-amber-400 font-extrabold">Ordenadas pela mais próxima de você</span>
      </div>

      {/* Results Grid: Cards com as distâncias calculadas e o preço do horário */}
      {availableResults.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableResults.map((item, idx) => {
            const isClosest = idx === 0;
            return (
              <div
                key={`${item.arena.id}-${item.court.id}`}
                className={`rounded-2xl p-4.5 bg-slate-900/90 border transition-all hover:shadow-xl flex flex-col justify-between space-y-4 group ${
                  isClosest
                    ? 'border-cyan-400 ring-2 ring-cyan-400/40'
                    : 'border-slate-800 hover:border-cyan-500/60'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Badges: Distance & Closest Chip */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-950/90 text-cyan-300 text-xs font-mono font-black border border-cyan-500/30 flex items-center gap-1 tabular-nums">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      {item.distanceKm.toFixed(1)} km de você
                    </span>

                    {isClosest ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                        Mais Próxima
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">
                        {item.arena.city}/{item.arena.state}
                      </span>
                    )}
                  </div>

                  {/* Arena Title & Court */}
                  <div>
                    <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                      {item.arena.name}
                    </h3>
                    <p className="text-xs font-extrabold text-amber-300 mt-0.5">
                      {item.court.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.court.surface} {item.court.isCovered ? '· Coberta' : ''}
                    </p>
                  </div>

                  {/* Sports tags */}
                  <div className="flex flex-wrap gap-1">
                    {item.court.sports.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-extrabold text-slate-300"
                      >
                        {sportLabels[s]}
                      </span>
                    ))}
                  </div>

                  {/* Price Banner */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Preço do Horário ({selectedTime})
                      </span>
                      <span className="text-base font-black text-emerald-400 tabular-nums">
                        R$ {item.price}
                        <span className="text-xs text-slate-400 font-normal"> / hora</span>
                      </span>
                    </div>
                    {item.isPeak && (
                      <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-black border border-orange-500/30">
                        Horário de Pico
                      </span>
                    )}
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      handleBookingClick(item.arena, item.court.id, selectedTime, selectedDate)
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#EA580C] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>RESERVAR QUADRA (R$ {item.price})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={item.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Confirmar via WhatsApp da Arena</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-3">
          <Clock className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-sm font-black text-white">
            Nenhuma quadra livre encontrada para {selectedDate} às {selectedTime}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Todas as quadras já foram reservadas nesse horário ou as arenas estão fechadas. Tente selecionar outro horário como 17h, 18h, 20h ou 21h.
          </p>
        </div>
      )}
    </div>
  );
};
