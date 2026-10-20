import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Zap, Clock, ArrowRight } from 'lucide-react';
import { useUpcomingFreeSlots, type UpcomingSlotItem } from '../hooks/useUpcomingFreeSlots';

interface Props {
  onSlotClick: (item: UpcomingSlotItem) => void;
  variant?: 'topbar' | 'floating';
  className?: string;
}

export function FreeSlotsNewsTicker({ onSlotClick, variant = 'topbar', className = '' }: Props) {
  const { upcomingSlots } = useUpcomingFreeSlots();
  const [scrollIndex, setScrollIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const total = upcomingSlots.length;

  // Auto-scroll a cada 3 segundos exatos (conforme solicitado pelo usuário), com pausa no hover
  useEffect(() => {
    if (isHovered || total <= 1) return;
    const timer = window.setInterval(() => {
      setScrollIndex((prev) => (prev + 1) % total);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isHovered, total]);

  useEffect(() => {
    if (scrollIndex >= total && total > 0) {
      setScrollIndex(0);
    }
  }, [total, scrollIndex]);

  if (total === 0) {
    return null;
  }

  // Multiplicamos a lista para criar um fluxo contínuo e infinito de rodapé estilo TV News
  const displayItems = total < 6 ? [...upcomingSlots, ...upcomingSlots, ...upcomingSlots] : [...upcomingSlots, ...upcomingSlots];

  // Largura de cada card no ticker (240px no mobile / 270px no desktop)
  const cardWidth = variant === 'floating' ? 280 : 250;
  const gap = 10;
  const stride = cardWidth + gap;
  const offsetPx = (scrollIndex % total) * stride;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScrollIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScrollIndex((prev) => (prev + 1) % total);
  };

  const isFloating = variant === 'floating';

  return (
    <aside
      aria-label="Rodapé de horários livres nas arenas"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group/ticker relative flex items-center select-none transition-all duration-300 ${
        isFloating
          ? 'w-full rounded-2xl bg-gradient-to-r from-[#031122]/95 via-[#06294d]/95 to-[#031122]/95 border border-cyan-400/50 shadow-[0_6px_28px_rgba(0,0,0,0.85)] backdrop-blur-xl px-2.5 sm:px-3 py-1.5'
          : 'flex-1 min-w-[260px] max-w-full rounded-full bg-gradient-to-r from-[#031427]/90 via-[#062444]/80 to-[#031427]/90 border border-cyan-500/35 backdrop-blur-md px-2.5 py-1 min-h-[38px] shadow-inner'
      } ${className}`}
    >
      {/* Badge de Destaque estilo Noticiário de TV */}
      <div
        className={`shrink-0 flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider mr-2 ${
          isFloating
            ? 'px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] sm:text-[11px] shadow-sm'
            : 'px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px]'
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-90" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="whitespace-nowrap font-black">
          {isFloating ? '⚡ Quadras Vagas' : '⚡ Livres'}
        </span>
      </div>

      {/* Janela de Ticker com Rolagem Contínua estilo Rodapé de TV */}
      <div ref={containerRef} className="flex-1 min-w-0 overflow-hidden relative">
        <div
          className="flex items-center gap-2.5 transition-transform duration-700 ease-out will-change-transform"
          style={{ transform: `translateX(-${offsetPx}px)` }}
        >
          {displayItems.map((item, index) => {
            const hasLogoError = imageError[item.arena.id];

            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => onSlotClick(item)}
                style={{ width: `${cardWidth}px` }}
                className={`shrink-0 flex items-center justify-between gap-2 rounded-xl border text-left cursor-pointer transition-all active:scale-[0.98] group/card ${
                  isFloating
                    ? 'px-2.5 py-1 bg-slate-900/80 hover:bg-[#072445] border-cyan-500/30 hover:border-cyan-300 shadow-sm'
                    : 'px-2 py-0.5 bg-[#051c36]/70 hover:bg-[#07264a] border-cyan-500/30 hover:border-cyan-400 shadow-xs'
                }`}
                title={`Clique para agendar ${item.slot.startTime}–${item.slot.endTime} na ${item.court.name} (${item.arena.name})`}
              >
                {/* Arena Logo & Detalhes */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-950 border border-cyan-400 shrink-0 flex items-center justify-center">
                    {item.arena.logoUrl && !hasLogoError ? (
                      <img
                        src={item.arena.logoUrl}
                        alt={item.arena.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setImageError((prev) => ({ ...prev, [item.arena.id]: true }))}
                      />
                    ) : (
                      <span className="text-[10px] font-black text-cyan-300">
                        {item.arena.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-white truncate group-hover/card:text-cyan-300 transition-colors">
                      {item.arena.name}
                    </span>
                    <span className="text-[9px] text-cyan-200/90 truncate">
                      {item.court.name}
                    </span>
                  </div>
                </div>

                {/* Horário & Ação Rápida */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono font-black text-[11px] text-emerald-300 bg-emerald-950/70 px-1.5 py-0.5 rounded-md border border-emerald-500/30 whitespace-nowrap">
                    {item.slot.startTime}–{item.slot.endTime}
                  </span>
                  <span className="hidden sm:inline-flex items-center text-[9px] font-black uppercase text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-400/30 group-hover/card:bg-amber-400 group-hover/card:text-slate-950 transition-colors">
                    Agendar
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles Manuais Discretos (Anterior / Próximo) */}
      {total > 1 && (
        <div className="shrink-0 flex items-center gap-0.5 ml-1.5 text-slate-400">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            aria-label="Horário anterior"
            title="Horário anterior"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="p-1 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            aria-label="Próximo horário"
            title="Próximo horário"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </aside>
  );
}
