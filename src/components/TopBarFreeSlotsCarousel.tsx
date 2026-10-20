import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useUpcomingFreeSlots, type UpcomingSlotItem } from '../hooks/useUpcomingFreeSlots';

interface Props {
  onSlotClick: (item: UpcomingSlotItem) => void;
  className?: string;
}

export function TopBarFreeSlotsCarousel({ onSlotClick, className = '' }: Props) {
  const { upcomingSlots } = useUpcomingFreeSlots();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  const total = upcomingSlots.length;

  // Auto-rotate every 4 seconds with smooth slide
  useEffect(() => {
    if (isHovered || total <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [isHovered, total]);

  useEffect(() => {
    if (currentIndex >= total && total > 0) {
      setCurrentIndex(0);
    }
  }, [total, currentIndex]);

  if (total === 0) return null;

  const currentItem = upcomingSlots[currentIndex % total];
  if (!currentItem) return null;

  const { arena, court, slot } = currentItem;
  const hasLogoError = imageError[arena.id];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  return (
    <div
      className={`relative inline-flex items-center gap-1 group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Horário disponível na ${arena.name}: ${slot.startTime}–${slot.endTime} (${court.name}). Clique para ver detalhes e AGENDAR AGORA.`}
    >
      <button
        type="button"
        onClick={() => onSlotClick(currentItem)}
        className="relative inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-gradient-to-r from-[#041529]/95 via-[#062444]/90 to-[#041529]/95 text-white border border-cyan-500/40 hover:border-cyan-300 shadow-md hover:shadow-cyan-500/25 active:translate-y-0.5 transition-all cursor-pointer max-w-[240px] overflow-hidden group/btn"
      >
        {/* Foto/Logo da arena com borda sutil */}
        <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-900 border border-cyan-400 shrink-0 flex items-center justify-center shadow-xs">
          {arena.logoUrl && !hasLogoError ? (
            <img
              src={arena.logoUrl}
              alt={arena.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageError((prev) => ({ ...prev, [arena.id]: true }))}
            />
          ) : (
            <span className="text-[10px] font-black text-cyan-300">
              {arena.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Informações: Horário livre e Nome da quadra com transição animada */}
        <div key={currentItem.id} className="animate-carousel-slide flex flex-col text-left leading-tight min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-black font-mono text-emerald-300 tracking-tight whitespace-nowrap">
              {slot.startTime}–{slot.endTime}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
          <span className="text-[10px] text-slate-300 truncate max-w-[115px] font-semibold">
            {court.name}
          </span>
        </div>

        {/* Ícone de raio sutil */}
        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 ml-0.5 group-hover/btn:scale-110 transition-transform" />
      </button>

      {/* Mini setas manuais quando houver mais de 1 slot em hover */}
      {total > 1 && (
        <div className="hidden group-hover:flex items-center gap-0.5 absolute -bottom-5 right-2 bg-slate-950/95 rounded-md px-1 py-0.5 border border-cyan-500/30 text-[9px] text-cyan-300 shadow-md z-30">
          <button
            type="button"
            onClick={handlePrev}
            className="p-0.5 hover:text-white cursor-pointer"
            aria-label="Horário anterior"
          >
            <ChevronLeft size={10} />
          </button>
          <span className="font-mono">
            {currentIndex + 1}/{total}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="p-0.5 hover:text-white cursor-pointer"
            aria-label="Próximo horário"
          >
            <ChevronRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
