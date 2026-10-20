import React, { useEffect, useState } from 'react';
import {
  Home,
  Trophy,
  MapPin,
  TrendingUp,
  Radio,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { UpcomingSlotItem } from '../hooks/useUpcomingFreeSlots';
import { FreeSlotsNewsTicker } from './FreeSlotsNewsTicker';
import { SharksetLogo } from './SharksetLogo';

interface Props {
  onSelectSlot: (slot: UpcomingSlotItem) => void;
}

export function FloatingBottomDock({ onSelectSlot }: Props) {
  const { activeTab, setActiveTab } = useApp();
  const [isVisible, setIsVisible] = useState(false);

  // Detecta quando o usuário rolou a página para baixo (> 90px)
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 90);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goHome = () => {
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: Array<{
    id: typeof activeTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    isLive?: boolean;
    isAdmin?: boolean;
  }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'tournaments', label: 'Torneios', icon: Trophy },
    { id: 'arenas_directory', label: 'Arenas', icon: MapPin },
    { id: 'ranking_athletes', label: 'Rankings', icon: TrendingUp },
    { id: 'live', label: 'Ao Vivo', icon: Radio, isLive: true },
    { id: 'my_bookings', label: 'Reservas', icon: CalendarCheck },
    { id: 'arena_admin', label: 'Admin', icon: ShieldCheck, isAdmin: true },
  ];

  return (
    <div
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
          {/* Botão com a logo da Sharkset na esquerda do botão de início: Clicar nele também vai pro início */}
          <button
            type="button"
            onClick={goHome}
            className="shrink-0 p-1 sm:p-1.5 rounded-full bg-[#052445]/90 hover:bg-[#083566] border border-cyan-400/50 hover:border-cyan-300 shadow-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center mr-0.5 group"
            title="SHARKSET — Ir para o Início"
            aria-label="SHARKSET Início"
          >
            <SharksetLogo variant="coin3d" customPx={24} className="group-hover:scale-105 transition-transform" />
          </button>

          {/* Botões de navegação */}
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

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
                    : item.isLive
                    ? 'bg-red-600/90 hover:bg-red-500 text-white border border-red-400/50'
                    : item.isAdmin
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-[#052445]/80 hover:bg-[#083566] text-white border border-cyan-500/30'
                }`}
                title={item.label}
              >
                {item.isLive ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                ) : (
                  <Icon size={14} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                )}
                <span className="hidden sm:inline text-[11px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
