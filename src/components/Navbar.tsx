import React from 'react';
import { useApp } from '../context/AppContext';
import { useSharkStore } from '../store/useSharkStore';
import { findVacantSlotsInNext2Hours } from '../services/smartAlertEngine';
import {
  MapPin,
  Command,
  Trophy,
  Users,
  User,
  ChevronDown,
  Bell,
  Zap,
  Flame,
  Tv,
  Building2,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    tenant,
    slots,
    activeTab,
    setActiveTab,
    setArenaSubTab,
    setCommandPaletteOpen,
    setTenantModalOpen,
    bookings,
    waitlist,
    waitlistNotifications,
  } = useApp();

  const {
    smartNotifications,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    referenceClockTime,
  } = useSharkStore();

  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;
  const notifiedWaitlistCount =
    waitlist.filter((w) => w.status === 'notified').length + waitlistNotifications.length;
  const unreadSmartCount = smartNotifications.filter((n) => !n.read).length;

  const vacantInNext2h = React.useMemo(
    () => findVacantSlotsInNext2Hours(slots, tenant.courts, referenceClockTime),
    [slots, tenant.courts, referenceClockTime]
  );

  return (
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        {/* Zone 1: SHARK SET Brand Identity + Quick Arena Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#sharkset"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-base tracking-tighter shadow-xs group-hover:bg-amber-300 transition-colors">
              SS
            </div>
            <div className="leading-none">
              <span className="block text-lg font-black tracking-tight text-white group-hover:text-amber-400 transition-colors">
                SHARK SET
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Beach Sports & Ranking
              </span>
            </div>
          </a>

          <div className="hidden sm:block h-5 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setTenantModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            title="Alternar Arena ativa"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate max-w-[150px]">{tenant.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Zone 2: Clean 4-Tab Navigation requested by User (Início · Ver Arenas · Ver Torneios · Ranking) */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'home'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Início & Ao Vivo
          </button>

          <button
            onClick={() => setActiveTab('arenas_directory')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'arenas_directory' || activeTab === 'scheduler'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Ver Arenas & Aulas
            {vacantInNext2h.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-emerald-400 text-slate-950 rounded-md">
                {vacantInNext2h.length} LIVRE(S)
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tournaments')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tournaments'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Ver Torneios (Tabela)
          </button>

          <button
            onClick={() => setActiveTab('register_dupla')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'register_dupla'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Ranking & Inscrição
          </button>
        </nav>

        {/* Zone 3: Quick Conversion & Notifications */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('saas_hub')}
            className={`hidden xl:flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl transition-all cursor-pointer border ${
              activeTab === 'saas_hub'
                ? 'bg-amber-400 text-slate-950 border-amber-400'
                : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-slate-700'
            }`}
            title="Planos: R$ 20 por Tabela ou R$ 99/mês para Arenas"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>R$ 20 Tabela / R$ 99 Arena</span>
          </button>

          <button
            onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
            className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Central de Push Notifications & Alertas Automáticos (D-2 Mensalidade)"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            {unreadSmartCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                {unreadSmartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('my_bookings')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTab === 'my_bookings'
                ? 'bg-amber-400 text-slate-950 border-amber-400'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Perfil ({activeBookingsCount})</span>
            {notifiedWaitlistCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-400 text-slate-950 rounded animate-pulse">
                VAGA
              </span>
            )}
          </button>

          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-2 text-xs text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Busca rápida (Ctrl+K / Cmd+K)"
          >
            <Command className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <button
            onClick={() => {
              setArenaSubTab('agenda');
              setActiveTab('scheduler');
            }}
            className="px-3.5 py-2 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Flame className="w-3.5 h-3.5 fill-slate-950" />
            Agendar Agora
          </button>
        </div>
      </div>

      {/* Mobile Clean 4-Tab Navigation Bar */}
      <div className="lg:hidden flex items-center justify-between border-t border-slate-800 bg-slate-900 px-2 py-2 overflow-x-auto gap-1.5">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'home' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-300 bg-slate-950/60'
          }`}
        >
          Início & Ao Vivo
        </button>
        <button
          onClick={() => setActiveTab('arenas_directory')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'arenas_directory' || activeTab === 'scheduler'
              ? 'bg-amber-400 text-slate-950 shadow-xs'
              : 'text-slate-300 bg-slate-950/60'
          }`}
        >
          Ver Arenas
        </button>
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'tournaments' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-300 bg-slate-950/60'
          }`}
        >
          Ver Torneios
        </button>
        <button
          onClick={() => setActiveTab('register_dupla')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'register_dupla' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-slate-300 bg-slate-950/60'
          }`}
        >
          Ranking
        </button>
      </div>
    </header>
  );
};
