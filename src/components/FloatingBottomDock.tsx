import React, { useEffect, useState } from 'react';
import { Radio, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { UpcomingSlotItem } from '../hooks/useUpcomingFreeSlots';
import { FreeSlotsNewsTicker } from './FreeSlotsNewsTicker';
import {
  NavIconHome,
  NavIconTrophy,
  NavIconNet,
  NavIconPodium,
  NavIconBooking,
} from './icons/NavIcons';

interface Props {
  onSelectSlot: (slot: UpcomingSlotItem) => void;
}

export function FloatingBottomDock({ onSelectSlot }: Props) {
  const { activeTab, setActiveTab } = useApp();
  const [isVisible, setIsVisible] = useState(false);
  const dockRef = React.useRef<HTMLDivElement | null>(null);

  // Detecta quando o usuário rolou a página para baixo (> 90px)
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 90);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ajusta dinamicamente a margem/offset do rodapé conforme a altura real da barra flutuante
  useEffect(() => {
    const el = dockRef.current;
    if (!el || typeof window === 'undefined') return;

    const updateOffset = () => {
      const rect = el.getBoundingClientRect();
      const totalOffset = isVisible ? Math.max(112, Math.ceil(rect.height + 24)) : 0;
      document.documentElement.style.setProperty('--floating-dock-offset', `${totalOffset}px`);
    };

    updateOffset();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOffset) : null;
    observer?.observe(el);
    window.addEventListener('resize', updateOffset, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateOffset);
    };
  }, [isVisible]);

  useEffect(() => () => {
    document.documentElement.style.removeProperty('--floating-dock-offset');
  }, []);

  const goHome = () => {
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Botão da LIVE na esquerda do botão de Admin; LIVE e Admin somente com ícone
  const navItems: Array<{
    id: typeof activeTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string; isActive?: boolean }>;
    isLive?: boolean;
    isAdmin?: boolean;
  }> = [
    { id: 'home', label: 'Início', icon: NavIconHome },
    { id: 'tournaments', label: 'Torneios', icon: NavIconTrophy },
    { id: 'arenas_directory', label: 'Arenas', icon: NavIconNet },
    { id: 'ranking_athletes', label: 'Rankings', icon: NavIconPodium },
    { id: 'my_bookings', label: 'Reservas', icon: NavIconBooking },
    { id: 'live', label: 'Ao Vivo', icon: Radio, isLive: true },
    { id: 'arena_admin', label: 'Admin', icon: ShieldCheck, isAdmin: true },
  ];

  return (
    <div
      ref={dockRef}
      className={`fixed bottom-2 sm:bottom-4 inset-x-0 z-50 flex flex-col items-center pointer-events-none px-2 sm:px-4 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
      }`}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 sm:gap-2 w-full max-w-6xl">
        {/* 1. RODAPÉ DE NOTICIÁRIO DE TV: OCUPA TODA A LARGURA DA TELA, PASSANDO OS HORÁRIOS A CADA 3s */}
        <FreeSlotsNewsTicker
          onSlotClick={onSelectSlot}
          variant="floating"
          className="w-full shadow-[0_8px_30px_rgba(0,0,0,0.85)]"
        />

        {/* 2. BOTÕES FIXADOS NA PARTE DE BAIXO COM PLANO DE FUNDO COMPLETO E BOTÃO DE LOGO À ESQUERDA */}
        <nav
          aria-label="Navegação rápida flutuante"
          className="w-auto max-w-full inline-flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#030B17]/95 border border-cyan-500/40 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-x-auto no-scrollbar scrollbar-none"
        >
          {/* Botão com a logo da Sharkset na esquerda do botão de início */}
          <button
            type="button"
            onClick={goHome}
            className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0 border border-cyan-400/80 hover:border-cyan-200 shadow-[0_0_12px_rgba(0,180,255,0.6)] hover:shadow-[0_0_22px_rgba(18,199,187,0.9)] hover:scale-120 hover:-translate-y-1 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center mr-1 group bg-slate-950 relative z-10"
            title="SHARKSET — Ir para o Início"
            aria-label="SHARKSET Início"
          >
            <img
              src="/brand/sharkset-logo-transparent.png"
              alt="SHARKSET"
              className="w-full h-full object-contain rounded-full pointer-events-none drop-shadow-md transition-transform duration-300 group-hover:scale-105"
            />
          </button>

          {/* Botões de navegação */}
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            // 1. Botão LIVE: à esquerda do Admin, somente com o ícone de live pulsando (sem escrita)
            if (item.isLive) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`shrink-0 inline-flex items-center justify-center p-2 rounded-full transition-all active:translate-y-0.5 cursor-pointer shadow-sm min-w-[36px] sm:min-w-[38px] min-h-[36px] sm:min-h-[38px] ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black border border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.55)]'
                      : 'bg-red-600/90 hover:bg-red-500 text-white border border-red-400/60 shadow-[0_0_10px_rgba(239,68,68,0.35)]'
                  }`}
                  title="Partidas Ao Vivo"
                  aria-label="Partidas Ao Vivo"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                </button>
              );
            }

            // 2. Botão ADMIN: somente com o ícone (igual à TopBar) e com fundo amarelo
            if (item.isAdmin) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`shrink-0 inline-flex items-center justify-center p-2 rounded-full transition-all active:translate-y-0.5 cursor-pointer shadow-sm min-w-[36px] sm:min-w-[38px] min-h-[36px] sm:min-h-[38px] ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  }`}
                  title="Área do Administrador"
                  aria-label="Área do Administrador"
                >
                  <ShieldCheck size={18} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-amber-300'} />
                </button>
              );
            }

            // 3. Demais botões (Início, Torneios, Arenas, Rankings, Reservas)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all active:translate-y-0.5 cursor-pointer whitespace-nowrap shadow-sm min-h-[36px] sm:min-h-[38px] ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-600 text-slate-950 font-black border border-cyan-300 shadow-[0_0_15px_rgba(18,199,187,0.4)]'
                    : 'bg-[#052445]/80 hover:bg-[#083566] text-white border border-cyan-500/30'
                }`}
                title={item.label}
              >
                <Icon size={16} isActive={isActive} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                <span className="hidden sm:inline text-[11px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
