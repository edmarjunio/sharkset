import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useUpcomingFreeSlots, type UpcomingSlotItem } from '../hooks/useUpcomingFreeSlots';

interface Props {
  onSlotClick: (item: UpcomingSlotItem) => void;
  variant?: 'topbar' | 'floating';
  className?: string;
}

export interface ProcessedSlotItem extends UpcomingSlotItem {
  shortHour: string;
  key: string;
}

/**
 * Converte horário de início para formato curto:
 * Ex: "13:00" -> "13h", "14:00" -> "14h", "13:30" -> "13h30"
 */
export function formatShortHour(startTime: string): string {
  if (!startTime) return '';
  const [hour, minute] = startTime.split(':');
  if (!minute || minute === '00') {
    return `${parseInt(hour, 10)}h`;
  }
  return `${parseInt(hour, 10)}h${minute}`;
}

/**
 * Card individual do Ticker memoizado via React.memo
 * Evita repaints e re-renders desnecessários de cartões já calculados.
 */
const MemoizedTickerCard = React.memo(function MemoizedTickerCard({
  item,
  style,
  isFloating,
  onClick,
}: {
  item: ProcessedSlotItem;
  style: React.CSSProperties;
  isFloating: boolean;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`absolute top-0 flex items-center justify-between gap-1.5 rounded-xl border text-left cursor-pointer active:scale-[0.98] group/card select-none ${
        isFloating
          ? 'h-9 px-2.5 py-1 bg-slate-900/85 hover:bg-[#072445] border-cyan-500/30 hover:border-cyan-300 shadow-sm'
          : 'h-[30px] px-2 py-0.5 bg-[#051c36]/85 hover:bg-[#07264a] border-cyan-500/30 hover:border-cyan-400 shadow-xs'
      }`}
      title={`Clique para agendar às ${item.shortHour} na ${item.court.name} (${item.arena.name})`}
    >
      {/* Arena Logo & Detalhes */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-950 border border-cyan-400 shrink-0 flex items-center justify-center">
          {item.arena.logoUrl && !imgError ? (
            <img
              src={item.arena.logoUrl}
              alt={item.arena.name}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-[9px] font-black text-cyan-300">
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

      {/* Horário Curto (Ex: 13h) e Ícone com Raio de Agendamento */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono font-black text-[11px] text-emerald-300 bg-emerald-950/70 px-1.5 py-0.2 rounded-md border border-emerald-500/30 whitespace-nowrap">
          {item.shortHour}
        </span>

        {/* Ícone 3D com Raio de Agendamento */}
        <div
          className="w-5 h-5 rounded-full btn-3d-zap flex items-center justify-center shrink-0 border border-amber-300/80 shadow-xs"
          title="Agendar horário"
        >
          <Zap size={10} className="fill-slate-950 text-slate-950 stroke-[2.5]" />
        </div>
      </div>
    </button>
  );
});

export function FreeSlotsNewsTicker({ onSlotClick, variant = 'topbar', className = '' }: Props) {
  const { upcomingSlots } = useUpcomingFreeSlots();
  const [scrollIndex, setScrollIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [containerWidth, setContainerWidth] = useState(600);

  const containerRef = useRef<HTMLDivElement>(null);
  const isFloating = variant === 'floating';

  /**
   * 1. MEMOIZAÇÃO DE DADOS (useMemo):
   * Pré-processa horários curtos e chaves estáveis uma única vez por atualização de upcomingSlots.
   */
  const processedSlots: ProcessedSlotItem[] = useMemo(() => {
    return upcomingSlots.map((item) => ({
      ...item,
      shortHour: formatShortHour(item.slot.startTime),
      key: `${item.arena.id}-${item.court.id}-${item.slot.startTime}`,
    }));
  }, [upcomingSlots]);

  const total = processedSlots.length;

  /**
   * 2. INTERSECTION OBSERVER DO CARROSSEL:
   * Monitora a visibilidade na tela. Se o componente sair do viewport (ex: rolagem da tela
   * ou tela em segundo plano), suspende o temporizador e poupa 100% de CPU/bateria em dispositivos antigos.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * Medição responsiva da largura do container com ResizeObserver
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });

    ro.observe(el);
    setContainerWidth(el.clientWidth || (isFloating ? 800 : 500));
    return () => ro.disconnect();
  }, [isFloating]);

  /**
   * 3. MEMOIZAÇÃO DO LAYOUT (useMemo):
   * Calcula exatamente a largura dos cards e o stride para 3 cards (topbar) ou 4 cards (floating).
   */
  const layout = useMemo(() => {
    const gap = 8;
    let visible = isFloating ? (containerWidth < 640 ? 2 : 4) : 3;
    if (containerWidth < 360) visible = 1;
    else if (containerWidth < 520 && visible > 2) visible = 2;

    const calculatedWidth = Math.max(
      110,
      Math.floor((containerWidth - (visible - 1) * gap) / visible)
    );

    return {
      cardsVisible: visible,
      cardWidth: calculatedWidth,
      gap,
      stride: calculatedWidth + gap,
    };
  }, [containerWidth, isFloating]);

  const { cardsVisible, cardWidth, stride } = layout;

  /**
   * 4. TEMPORIZADOR ULTRA-FLUIDO:
   * Auto-scroll contínuo e suave a cada 3.0s, condicionado à visibilidade na tela e sem hover.
   */
  useEffect(() => {
    if (!isIntersecting || isHovered || total <= cardsVisible) return;

    const timer = window.setInterval(() => {
      setScrollIndex((prev) => prev + 1);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isIntersecting, isHovered, total, cardsVisible]);

  /**
   * 5. JANELA VIRTUALIZADA MEMOIZADA (useMemo):
   * Processa APENAS os itens estritamente visíveis no viewport mais 1 buffer de cada lado.
   * Em vez de montar 50 ou 100 cards no DOM, renderiza apenas 5 a 6 elementos simultâneos.
   * Elimina completamente qualquer travamento, flickering ou recarregamento visual.
   */
  const visibleWindow = useMemo(() => {
    if (total === 0) return [];
    const items = [];
    const overscan = 1; // 1 card de buffer à esquerda e à direita para transição perfeitamente fluida
    const start = scrollIndex - overscan;
    const end = scrollIndex + cardsVisible + overscan;

    for (let i = start; i <= end; i++) {
      const dataIndex = ((i % total) + total) % total;
      items.push({
        virtualIndex: i,
        item: processedSlots[dataIndex],
      });
    }
    return items;
  }, [processedSlots, scrollIndex, cardsVisible, total]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScrollIndex((prev) => prev - 1);
  }, []);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScrollIndex((prev) => prev + 1);
  }, []);

  if (total === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Carrossel de horários livres nas arenas"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group/ticker relative flex items-center select-none transition-all duration-300 ${
        isFloating
          ? 'w-full rounded-2xl bg-gradient-to-r from-[#031122]/95 via-[#06294d]/95 to-[#031122]/95 border border-cyan-400/50 shadow-[0_6px_28px_rgba(0,0,0,0.85)] backdrop-blur-xl px-2.5 sm:px-3 py-1.5'
          : 'flex-1 min-w-[240px] max-w-full rounded-full bg-gradient-to-r from-[#031427]/90 via-[#062444]/80 to-[#031427]/90 border border-cyan-500/35 backdrop-blur-md px-2 py-1 min-h-[38px] shadow-inner'
      } ${className}`}
    >
      {/* Badge de Destaque estilo Noticiário de TV */}
      <div
        className={`shrink-0 flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider mr-2 ${
          isFloating
            ? 'px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] sm:text-[11px] shadow-sm'
            : 'px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px]'
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

      {/* Janela de Ticker Virtualizada com Rolagem Acelerada por Hardware (GPU) */}
      <div
        ref={containerRef}
        className={`flex-1 min-w-0 overflow-hidden relative ${
          isFloating ? 'h-9' : 'h-[30px]'
        }`}
      >
        {visibleWindow.map(({ virtualIndex, item }) => {
          // Deslocamento horizontal exato com translate3d para fluidez a 60fps sem recalcular layout
          const offset = (virtualIndex - scrollIndex) * stride;
          const style: React.CSSProperties = {
            width: `${cardWidth}px`,
            transform: `translate3d(${offset}px, 0px, 0px)`,
            transition: 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          };

          return (
            <MemoizedTickerCard
              key={`${item.key}-${virtualIndex}`}
              item={item}
              style={style}
              isFloating={isFloating}
              onClick={() => onSlotClick(item)}
            />
          );
        })}
      </div>

      {/* Controles Manuais Discretos (Anterior / Próximo) */}
      {total > cardsVisible && (
        <div className="shrink-0 flex items-center gap-0.5 ml-1 text-slate-400">
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
