import { DropdownUI } from './DropdownUI';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Court, SportType, TenantConfig } from '../types';
import { calculateHaversineDistance, type GeoCoordinates } from '../utils/geoUtils';
import { useBookingSelection } from '../store/useBookingSelection';
import { useBookingLocation, validCoordinates } from '../store/useBookingLocation';
import { useArenaAvailability, BOOKING_DEMO } from '../hooks/useArenaAvailability';
import { arenaDate, minutes, type AvailabilityCell } from '../services/bookingAvailability';
import { newlyFreedSlots, slotsInWindow } from '../services/nearbySlots';
import { BookingDatePicker } from './BookingDatePicker';
import { TopBarSlotDetailsModal } from './TopBarSlotDetailsModal';
import { ChevronLeft, ChevronRight, Clock, MapPin, Pause, Play, X, Zap } from 'lucide-react';
import { formatShortHour } from './FreeSlotsNewsTicker';

interface Props {
  userCoords?: GeoCoordinates | null;
  className?: string;
  defaultSport?: SportType | 'all';
  homeTop?: boolean;
}

interface ArenaData {
  cells: AvailabilityCell[];
  loading: boolean;
  error: string;
}

function localClock() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}

export function FreeSlotsDateTimeFilter({
  userCoords,
  className = '',
  defaultSport = 'all',
  homeTop = false,
}: Props) {
  const { availableTenants, radiusKm, activeTab, setTenantId, setArenaSubTab, setActiveTab } = useApp();
  const selection = useBookingSelection();
  const location = useBookingLocation();
  const coords = userCoords ?? location.coords;
  const [now, setNow] = useState(localClock);
  const [today, setToday] = useState(arenaDate);
  const date = homeTop ? today : selection.date;
  const [arenaFilter, setArenaFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Record<string, ArenaData>>({});
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const previous = useRef(new Map<string, AvailabilityCell[]>());

  // Modal com detalhes completos da arena e reserva + AGENDAR AGORA
  const [detailModal, setDetailModal] = useState<{
    arena: TenantConfig;
    slot: AvailabilityCell;
    court: Court;
    distanceKm?: number;
  } | null>(null);

  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(localClock());
      setToday(arenaDate());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!homeTop || activeTab !== 'home' || !section.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [homeTop, activeTab]);

  const receive = useCallback((key: string, state: ArenaData) => {
    setData((prev) => ({ ...prev, [key]: state }));
    if (state.loading || state.error) return;
    const freed = newlyFreedSlots(previous.current.get(key), state.cells);
    previous.current.set(key, state.cells);
    if (freed.length) {
      setFresh((prev) => ({
        ...prev,
        ...Object.fromEntries(freed.map((cell) => [cell.id, Date.now()])),
      }));
      setDismissed(false);
    }
  }, []);

  const arenas = useMemo(
    () =>
      availableTenants
        .map((arena) => ({
          arena,
          distance:
            validCoordinates(coords) && validCoordinates({ lat: arena.lat!, lng: arena.lng! })
              ? calculateHaversineDistance(coords.lat, coords.lng, arena.lat!, arena.lng!)
              : arena.distanceKm,
        }))
        .filter((item) => Number.isFinite(item.distance) && item.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance),
    [availableTenants, coords, radiusKm]
  );

  const groups = useMemo(() => {
    return arenas.map((item) => {
      const state = data[item.arena.id + ':' + date];
      const cells = state?.cells || [];
      const free =
        date === today
          ? slotsInWindow(cells, now, from, to)
          : cells.filter(
              (c) =>
                c.state === 'free' &&
                (!from || c.startTime >= from) &&
                (!to || c.endTime <= to)
            );
      return {
        ...item,
        state,
        free: free.filter(
          (cell) =>
            defaultSport === 'all' ||
            item.arena.courts.find((c) => c.id === cell.courtId)?.sports.includes(defaultSport)
        ),
      };
    });
  }, [arenas, data, date, today, now, from, to, defaultSport]);

  const shown = useMemo(() => {
    return groups.filter(
      (group) =>
        (arenaFilter === 'all' || arenaFilter === group.arena.id) &&
        (!group.state || group.state.loading || group.state.error || group.free.length)
    );
  }, [groups, arenaFilter]);

  const alerts = useMemo(() => {
    return groups
      .map((group) => {
        const rawFree = slotsInWindow(group.state?.cells || [], now);
        const relevantFree = rawFree.filter(
          (cell) => fresh[cell.id] > Date.now() - 300000 || cell.isPeakHour || true
        );
        return { ...group, free: relevantFree };
      })
      .filter((group) => group.free.length && !group.state?.loading && !group.state?.error);
  }, [groups, now, fresh]);

  const alertKey = alerts.map((group) => group.arena.id).join('|');

  useEffect(() => {
    setCarouselIndex(0);
  }, [alertKey]);

  useEffect(() => {
    if (paused || hovered || alerts.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setCarouselIndex((index) => index + 1);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused, hovered, alertKey, alerts.length]);

  const selectedAlert = alerts[carouselIndex % Math.max(1, alerts.length)];

  const viewArena = (arena: TenantConfig) => {
    selection.setDate(date);
    setTenantId(arena.id);
    setArenaSubTab('agendamentos');
    setActiveTab('scheduler');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSlotModal = (arena: TenantConfig, slot: AvailabilityCell, distance: number) => {
    const court = arena.courts.find((c) => c.id === slot.courtId) || arena.courts[0];
    if (!court) return;
    selection.setDate(slot.date);
    setDetailModal({
      arena,
      slot,
      court,
      distanceKm: distance,
    });
  };

  const badRange = !!from && !!to && minutes(from) >= minutes(to);

  return (
    <>
      {arenas.map(({ arena }) => (
        <ArenaSubscription key={arena.id + ':' + date} arena={arena} date={date} receive={receive} />
      ))}

      {(!homeTop || activeTab === 'home') && arenas.length > 0 && (
        <section
          ref={section}
          data-nearby-availability
          className={'max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3 sm:pt-4 ' + className}
          aria-label="Horários livres nas próximas horas"
        >
          {/* Seção Compacta de Horários Livres */}
          <div className="vacancy-promo rounded-2xl border border-cyan-400/35 bg-[#041224]/95 p-3 sm:p-4 text-white shadow-xl">
            {/* Header: No Computador, título e filtros na MESMA LINHA */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2 border-b border-white/10">
              {/* Título */}
              <div className="flex items-center justify-between lg:justify-start gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-400 shrink-0" />
                  <h2 className="text-xs sm:text-sm font-black uppercase text-amber-300 tracking-wide whitespace-nowrap">
                    Horários livres nas próximas horas · Arenas próximas
                  </h2>
                </div>

                {/* Botão de Localização no Mobile */}
                <button
                  type="button"
                  disabled={location.status === 'locating'}
                  onClick={() => void location.request()}
                  className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cyan-500/40 bg-[#052445]/90 hover:bg-[#083566] text-white font-bold text-[11px] shadow-sm transition-all active:scale-[0.98] cursor-pointer shrink-0"
                  title="Usar minha localização"
                >
                  <MapPin size={12} className="text-cyan-300" />
                  <span>{location.status === 'locating' ? 'Localizando…' : 'GPS'}</span>
                </button>
              </div>

              {/* Filtros em Linha no Computador */}
              <div className="hidden lg:flex items-center gap-2 text-xs font-bold shrink-0">
                <label className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px] font-bold">Arena:</span>
                  <DropdownUI
                    aria-label="Filtrar por arena"
                    value={arenaFilter}
                    onChange={(event) => setArenaFilter(event.target.value)}
                    className="h-8 max-w-[200px] rounded-lg border border-cyan-800/60 bg-[#030D1A] px-2.5 py-1 text-xs text-white"
                  >
                    <option value="all">Todas as arenas</option>
                    {arenas.map(({ arena }) => (
                      <option key={arena.id} value={arena.id}>
                        {arena.name}
                      </option>
                    ))}
                  </DropdownUI>
                </label>

                <label className="flex items-center gap-1">
                  <span className="text-slate-400 text-[11px] font-bold">De:</span>
                  <input
                    aria-label="Hora inicial da busca"
                    type="time"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="h-8 w-24 rounded-lg border border-cyan-800/60 bg-[#030D1A] px-2 py-1 text-xs text-white [color-scheme:dark]"
                  />
                </label>

                <label className="flex items-center gap-1">
                  <span className="text-slate-400 text-[11px] font-bold">Até:</span>
                  <input
                    aria-label="Hora final da busca"
                    type="time"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="h-8 w-24 rounded-lg border border-cyan-800/60 bg-[#030D1A] px-2 py-1 text-xs text-white [color-scheme:dark]"
                  />
                </label>

                {(arenaFilter !== 'all' || from || to) && (
                  <button
                    type="button"
                    onClick={() => {
                      setArenaFilter('all');
                      setFrom('');
                      setTo('');
                    }}
                    className="h-8 px-2.5 py-1 rounded-lg border border-cyan-800/60 bg-[#05182C] hover:bg-[#072545] text-cyan-300 font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    Limpar
                  </button>
                )}

                <button
                  type="button"
                  disabled={location.status === 'locating'}
                  onClick={() => void location.request()}
                  className="h-8 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-cyan-500/40 bg-[#052445]/90 hover:bg-[#083566] text-white font-bold text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer shrink-0"
                  title="Usar minha localização GPS"
                >
                  <MapPin size={13} className="text-cyan-300" />
                  <span>{location.status === 'locating' ? 'Localizando…' : 'GPS'}</span>
                </button>
              </div>

              {/* Filtros no Celular / Tablet: Grid Compacto e Organizado */}
              <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs font-bold">
                <label className="col-span-2 sm:col-span-1 flex flex-col gap-1">
                  <span className="text-slate-400 text-[10px] font-bold">Arena:</span>
                  <DropdownUI
                    aria-label="Filtrar por arena"
                    value={arenaFilter}
                    onChange={(event) => setArenaFilter(event.target.value)}
                    className="h-8 w-full rounded-lg border border-cyan-800/60 bg-[#030D1A] px-2 py-1 text-xs text-white"
                  >
                    <option value="all">Todas as arenas</option>
                    {arenas.map(({ arena }) => (
                      <option key={arena.id} value={arena.id}>
                        {arena.name}
                      </option>
                    ))}
                  </DropdownUI>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-slate-400 text-[10px] font-bold">De:</span>
                  <input
                    aria-label="Hora inicial da busca"
                    type="time"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="h-8 w-full rounded-lg border border-cyan-800/60 bg-[#030D1A] px-2 py-1 text-xs text-white [color-scheme:dark]"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-slate-400 text-[10px] font-bold">Até:</span>
                  <input
                    aria-label="Hora final da busca"
                    type="time"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    className="h-8 w-full rounded-lg border border-cyan-800/60 bg-[#030D1A] px-2 py-1 text-xs text-white [color-scheme:dark]"
                  />
                </label>
              </div>
            </div>

            {/* Carrossel Horizontal Virtualizado de Arenas: SEM BARRA DE ROLAMENTO (no-scrollbar) */}
            {badRange ? (
              <p role="alert" className="text-amber-200 text-xs py-2">
                A hora final precisa ser posterior à hora inicial.
              </p>
            ) : (
              <VirtualizedArenaCarousel
                items={shown}
                onOpenModal={(arena, slot, distance) => handleOpenSlotModal(arena, slot, distance)}
              />
            )}
          </div>
        </section>
      )}

      {/* Popover lateral de horários (apenas fora da Home para não conflitar com dock flutuante) */}
      {homeTop && activeTab !== 'home' && selectedAlert && !dismissed && (
        <aside
          aria-label="Carrossel de horários livres próximos"
          aria-roledescription="carrossel"
          className="fixed right-3 bottom-5 z-30 w-[min(300px,calc(100vw-24px))] max-h-[65dvh] overflow-y-auto no-scrollbar rounded-2xl border border-cyan-400/60 bg-[#041529]/95 text-white shadow-2xl backdrop-blur-md"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setHovered(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setHovered(false);
          }}
        >
          <div className="flex items-center justify-between px-3 pt-2.5 gap-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              {selectedAlert.free.some((cell) => fresh[cell.id] > Date.now() - 300000)
                ? '🔥 Acabou de livrar!'
                : '⏰ Horários livres'}
            </span>
            <button
              type="button"
              aria-label="Fechar horários laterais"
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2">
            <ElegantArenaSlotItem
              arena={selectedAlert.arena}
              distance={selectedAlert.distance}
              free={selectedAlert.free}
              state={selectedAlert.state}
              onOpenModal={(slot) =>
                handleOpenSlotModal(selectedAlert.arena, slot, selectedAlert.distance)
              }
            />
          </div>
          <div className="flex justify-between items-center px-3 pb-2.5">
            <button
              type="button"
              aria-label="Arena anterior"
              onClick={() =>
                setCarouselIndex((index) => (index - 1 + alerts.length) % alerts.length)
              }
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono">
              {(carouselIndex % alerts.length) + 1} / {alerts.length}
            </span>
            <button
              type="button"
              aria-label={paused ? 'Retomar carrossel' : 'Pausar carrossel'}
              onClick={() => setPaused(!paused)}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              aria-label="Próxima arena"
              onClick={() => setCarouselIndex((index) => index + 1)}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Modal com detalhes completos da arena e agendamento instantâneo */}
      <TopBarSlotDetailsModal
        isOpen={Boolean(detailModal)}
        onClose={() => setDetailModal(null)}
        arena={detailModal?.arena || null}
        court={detailModal?.court || null}
        slot={detailModal?.slot || null}
        distanceKm={detailModal?.distanceKm}
        onGoToArena={viewArena}
      />
    </>
  );
}

function VirtualizedArenaCarousel({
  items,
  onOpenModal,
}: {
  items: Array<{
    arena: TenantConfig;
    distance: number;
    free: AvailabilityCell[];
    state?: ArenaData;
  }>;
  onOpenModal: (arena: TenantConfig, slot: AvailabilityCell, distance: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isHovered, setIsHovered] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isCarouselVisible, setIsCarouselVisible] = useState(true);
  const isScrollingRef = useRef(false);

  // Stride (card width 280px on desktop / 260px on mobile + 10px gap)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const itemStride = isMobile ? 270 : 290;

  /**
   * 1. INTERSECTION OBSERVER DO CARROSSEL:
   * Monitora se a seção do carrossel está visível no viewport da página.
   * Se o usuário rolar a página para baixo, suspende o auto-scroll e poupa CPU.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCarouselVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });

    observer.observe(el);
    setContainerWidth(el.clientWidth || 800);
    return () => observer.disconnect();
  }, []);

  // Passive high-performance scroll tracking via rAF guard
  const onScroll = useCallback(() => {
    if (isScrollingRef.current) return;
    isScrollingRef.current = true;
    requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollLeft(containerRef.current.scrollLeft);
      }
      isScrollingRef.current = false;
    });
  }, []);

  // Auto-scrolling mechanism: rotates smoothly across arena cards every 3.0 seconds
  useEffect(() => {
    if (!isCarouselVisible || isHovered || isUserInteracting || items.length <= 1) return;

    const interval = window.setInterval(() => {
      const el = containerRef.current;
      if (!el || document.hidden) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 20) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: itemStride, behavior: 'smooth' });
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isCarouselVisible, isHovered, isUserInteracting, items.length, itemStride]);

  /**
   * 2. VIRTUALIZAÇÃO / WINDOWING VIA useMemo:
   * Processa estritamente os cartões visíveis na tela + 1 buffer para rolagem fluida.
   */
  const total = items.length;
  const overscan = 1;

  const { visibleItems, leftSpacerWidth, rightSpacerWidth } = useMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollLeft / itemStride) - overscan);
    const endIdx = Math.min(total - 1, Math.ceil((scrollLeft + containerWidth) / itemStride) + overscan);

    const leftSpacer = startIdx * itemStride;
    const rightSpacer = Math.max(0, (total - 1 - endIdx) * itemStride);
    const slice = items.slice(startIdx, endIdx + 1);

    return {
      visibleItems: slice,
      leftSpacerWidth: leftSpacer,
      rightSpacerWidth: rightSpacer,
    };
  }, [items, scrollLeft, itemStride, total, containerWidth, overscan]);

  const handleScrollPrev = () => {
    containerRef.current?.scrollBy({ left: -itemStride, behavior: 'smooth' });
  };

  const handleScrollNext = () => {
    containerRef.current?.scrollBy({ left: itemStride, behavior: 'smooth' });
  };

  if (!items.length) {
    return (
      <p className="text-xs text-slate-300 p-3">
        Nenhum horário livre no intervalo e na região selecionados.
      </p>
    );
  }

  return (
    <div
      className="relative group/carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsUserInteracting(true)}
      onTouchEnd={() => setTimeout(() => setIsUserInteracting(false), 2000)}
    >
      {/* Scrollable Container with Virtualization & No Scrollbar (Centralizado no meio da tela) */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex justify-start lg:justify-center items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar scrollbar-none pb-1 pt-2.5 snap-x snap-mandatory w-full"
      >
        {/* Left Spacer for virtual windowing */}
        {leftSpacerWidth > 0 && (
          <div style={{ width: `${leftSpacerWidth}px`, flexShrink: 0 }} aria-hidden="true" />
        )}

        {/* Visible / Windowed Arena Cards */}
        {visibleItems.map((group) => (
          <ElegantArenaSlotItem
            key={group.arena.id}
            arena={group.arena}
            distance={group.distance}
            free={group.free}
            state={group.state}
            onOpenModal={(slot) => onOpenModal(group.arena, slot, group.distance)}
          />
        ))}

        {/* Right Spacer for virtual windowing */}
        {rightSpacerWidth > 0 && (
          <div style={{ width: `${rightSpacerWidth}px`, flexShrink: 0 }} aria-hidden="true" />
        )}
      </div>

      {/* Manual Navigation Controls (desktop hover) */}
      {total > 1 && (
        <div className="hidden sm:flex items-center gap-1 absolute -top-9 right-0 text-slate-300">
          <button
            type="button"
            onClick={handleScrollPrev}
            className="p-1 rounded-md bg-[#030D1A] border border-cyan-500/30 hover:border-cyan-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Rolar para a esquerda"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={handleScrollNext}
            className="p-1 rounded-md bg-[#030D1A] border border-cyan-500/30 hover:border-cyan-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Rolar para a direita"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function ArenaSubscription({
  arena,
  date,
  receive,
}: {
  arena: TenantConfig;
  date: string;
  receive: (key: string, state: ArenaData) => void;
}) {
  const { cells, loading, error } = useArenaAvailability(arena, date);
  useEffect(() => {
    receive(arena.id + ':' + date, { cells, loading, error });
  }, [arena.id, date, cells, loading, error, receive]);
  return null;
}

/**
 * Item Elegante de Carrossel:
 * Exibe de forma limpa e elegante APENAS:
 * 1. Nome da arena
 * 2. Horário disponível
 * 3. Nome da quadra
 * Otimizado com Intersection Observer individual e useMemo para evitar repaints desnecessários
 * e transição suave sem piscar a tela ou desmontar elementos bruscamente.
 */
function ElegantArenaSlotItem({
  arena,
  distance,
  free,
  state,
  onOpenModal,
}: {
  arena: TenantConfig;
  distance: number;
  free: AvailabilityCell[];
  state?: ArenaData;
  onOpenModal: (slot: AvailabilityCell) => void;
}) {
  const [slotIndex, setSlotIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const cardRef = useRef<HTMLElement>(null);

  /**
   * 1. INTERSECTION OBSERVER DO CARTÃO:
   * Monitora se este cartão individual está no campo de visão do usuário.
   * Se for rolado para fora da visão horizontal, seu temporizador de rotação é pausado imediatamente.
   */
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCardVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * 2. MEMOIZAÇÃO DE QUADRAS E HORÁRIOS (useMemo):
   * Mapeamento direto de quadras em O(1) e pré-formatação de strings de horários.
   */
  const courtMap = useMemo(() => {
    const map = new Map<string, Court>();
    for (const c of arena.courts) {
      map.set(c.id, c);
    }
    return map;
  }, [arena.courts]);

  const formattedSlots = useMemo(() => {
    return free.map((slot) => ({
      slot,
      courtName: courtMap.get(slot.courtId)?.name || 'Quadra Livre',
      shortHour: formatShortHour(slot.startTime),
    }));
  }, [free, courtMap]);

  const totalSlots = formattedSlots.length;

  /**
   * 3. ROTAÇÃO SUAVE CONDICIONAL:
   * Só roda se o cartão estiver no viewport do usuário, não hovereado e tiver mais de 1 horário.
   */
  useEffect(() => {
    if (!isCardVisible || isHovered || totalSlots <= 1) return;

    const interval = window.setInterval(() => {
      setSlotIndex((prev) => (prev + 1) % totalSlots);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isCardVisible, isHovered, totalSlots]);

  useEffect(() => {
    if (slotIndex >= totalSlots && totalSlots > 0) {
      setSlotIndex(0);
    }
  }, [totalSlots, slotIndex]);

  const currentFormatted = totalSlots > 0 ? formattedSlots[slotIndex % totalSlots] : null;
  const currentSlot = currentFormatted?.slot || null;

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => currentSlot && onOpenModal(currentSlot)}
      className="w-[260px] sm:w-[280px] shrink-0 snap-start rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#041529]/95 to-slate-900/95 p-3 flex flex-col justify-between shadow-lg hover:border-cyan-400/70 hover:shadow-cyan-500/20 transition-all cursor-pointer group active:scale-[0.99] select-none"
      title={currentSlot ? `Clique para agendar ${currentSlot.startTime}–${currentSlot.endTime} na ${currentFormatted?.courtName} (${arena.name})` : undefined}
    >
      {/* 1. Nome da Arena (Topo limpo) */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
        <strong className="text-xs sm:text-sm font-black text-white group-hover:text-cyan-300 transition-colors truncate block">
          {arena.name}
        </strong>

        {totalSlots > 1 && (
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 px-1.5 py-0.5 rounded-md border border-cyan-500/30 shrink-0">
            {slotIndex + 1}/{totalSlots}
          </span>
        )}
      </div>

      {/* 2 e 3. Horário Disponível e Nome da Quadra (Corpo elegante com transição suave sem piscar) */}
      <div className="py-2.5">
        {!state || state.loading ? (
          <div className="h-14 flex items-center justify-center text-xs text-slate-400 gap-1.5 animate-pulse">
            <Clock size={13} className="text-cyan-400" />
            <span>Consultando horários…</span>
          </div>
        ) : state.error ? (
          <div className="h-14 flex items-center justify-center text-xs text-amber-300 text-center">
            <span>{state.error}</span>
          </div>
        ) : totalSlots === 0 || !currentSlot || !currentFormatted ? (
          <div className="h-14 flex items-center justify-center text-xs text-slate-400 text-center">
            <span>Sem horários livres no período</span>
          </div>
        ) : (
          <div className="flex flex-col justify-center space-y-1">
            {/* Horário Disponível e Botão de Agendar Grande, Evidenciado e Chamativo */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-base sm:text-lg font-black font-mono text-emerald-300 tracking-tight flex items-center gap-1.5 transition-colors duration-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="inline-block transition-transform duration-300 ease-out">
                  {currentFormatted.shortHour}
                </span>
              </span>

              {/* Botão de Agendar 3D Flutuante: Somente o botão com um RAIO no meio, sem escrita */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(currentSlot);
                }}
                className="btn-3d-zap animate-float-gentle w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-950 border border-amber-300/80 cursor-pointer shrink-0 select-none"
                title="Agendar este horário agora"
                aria-label="Agendar horário"
              >
                <Zap size={18} className="fill-slate-950 text-slate-950 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]" />
              </button>
            </div>

            {/* Nome da Quadra */}
            <span className="text-xs font-bold text-cyan-200 truncate block transition-colors duration-200">
              {currentFormatted.courtName}
            </span>
          </div>
        )}
      </div>

      {/* Indicadores sutis de carrossel se houver múltiplos horários */}
      {totalSlots > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1 border-t border-white/5">
          {Array.from({ length: Math.min(6, totalSlots) }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                slotIndex === i ? 'w-3.5 bg-emerald-400' : 'w-1 bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}
    </article>
  );
}
