import React from 'react';
import { useApp } from '../context/AppContext';
import { useSharkStore } from '../store/useSharkStore';
import { findVacantSlotsInNext2Hours } from '../services/smartAlertEngine';
import { SharksetLogo } from './SharksetLogo';
import { useI18n } from '../hooks/useI18n';
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
  Globe,
  GraduationCap,
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

  const { t, isPortuguese, toggleLocale } = useI18n();

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
    <header className="sticky top-0 z-40 bg-[#030B17] text-[#F7FAFD] border-b border-[#145A9B] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 h-16">
        {/* Zone 1: SHARK SET Official Logo & É O TUBA Subtitle + Arena Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="#sharkset"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            className="flex flex-col items-center justify-center group cursor-pointer transition-transform hover:scale-[1.02]"
            title="SHARKSET · É O TUBA"
          >
            <SharksetLogo size="sm" showSubtitle={true} />
          </a>

          <div className="hidden sm:block h-7 w-px bg-[#145A9B]/60 mx-1" />

          <button
            onClick={() => setTenantModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            title="Alternar Arena ativa"
          >
            <MapPin className="w-3.5 h-3.5 text-[#0987CE] shrink-0" />
            <span className="truncate max-w-[130px]">{tenant.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Zone 2: Clean Navigation with Translations */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#071D3D]/90 p-1.5 rounded-2xl border border-[#145A9B]">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'home'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/25'
                : 'text-slate-300 hover:text-white hover:bg-[#0B254E]'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            {'home_live'.tr}
          </button>

          <button
            onClick={() => setActiveTab('arenas_directory')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'arenas_directory' || activeTab === 'scheduler'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/25'
                : 'text-slate-300 hover:text-white hover:bg-[#0B254E]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            {'arenas_classes'.tr}
            {vacantInNext2h.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-[#12C7BB] text-slate-950 rounded-md">
                {vacantInNext2h.length} LIVRE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tournaments')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tournaments'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/25'
                : 'text-slate-300 hover:text-white hover:bg-[#0B254E]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            {'tournaments_bracket'.tr}
          </button>

          <button
            onClick={() => setActiveTab('ranking_athletes')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ranking_athletes'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/25'
                : 'text-slate-300 hover:text-white hover:bg-[#0B254E]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#12C7BB]" />
            {'ranking_board'.tr}
          </button>

          <button
            onClick={() => setActiveTab('shark_academy')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'shark_academy'
                ? 'bg-[#12C7BB] text-slate-950 shadow-md shadow-[#12C7BB]/25'
                : 'text-[#12C7BB] hover:text-white hover:bg-[#0B254E]'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            {'shark_academy'.tr}
          </button>

          <button
            onClick={() => setActiveTab('register_dupla')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'register_dupla'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/25'
                : 'text-slate-300 hover:text-white hover:bg-[#0B254E]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {'doubles_registration'.tr}
          </button>
        </nav>

        {/* Zone 3: Language Toggle, Quick Conversion & Notifications */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language Switcher (PT / EN) */}
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-black text-slate-200 bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-all cursor-pointer shadow-xs"
            title={isPortuguese ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
          >
            <Globe className="w-3.5 h-3.5 text-[#0987CE]" />
            <span className="text-[11px] font-mono">{isPortuguese ? '🇧🇷 PT' : '🇺🇸 EN'}</span>
          </button>

          <button
            onClick={() => setActiveTab('saas_hub')}
            className={`hidden xl:flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl transition-all cursor-pointer border ${
              activeTab === 'saas_hub'
                ? 'bg-[#0987CE] text-white border-[#0987CE]'
                : 'bg-[#071D3D] hover:bg-[#0B254E] text-[#12C7BB] border-[#145A9B]'
            }`}
            title="Planos: R$ 20 por Tabela ou R$ 99/mês para Arenas"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{'pricing_saas'.tr}</span>
          </button>

          <button
            onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
            className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer"
            title={t('smart_alerts')}
          >
            <Bell className="w-3.5 h-3.5 text-[#0987CE]" />
            {unreadSmartCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#0987CE] text-white font-black text-[10px]">
                {unreadSmartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('my_bookings')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTab === 'my_bookings'
                ? 'bg-[#0987CE] text-white border-[#0987CE]'
                : 'bg-[#071D3D] hover:bg-[#0B254E] text-slate-200 border-[#145A9B]'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#0987CE]" />
            <span className="hidden sm:inline">{'profile'.tr} ({activeBookingsCount})</span>
            {notifiedWaitlistCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-[#12C7BB] text-slate-950 rounded animate-pulse">
                VAGA
              </span>
            )}
          </button>

          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-2 text-xs text-slate-300 bg-[#071D3D] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl transition-colors cursor-pointer"
            title="Busca rápida (Ctrl+K / Cmd+K)"
          >
            <Command className="w-3.5 h-3.5 text-[#0987CE]" />
          </button>

          <button
            onClick={() => {
              setArenaSubTab('agenda');
              setActiveTab('scheduler');
            }}
            className="px-3.5 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 active:scale-[0.98] rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <Flame className="w-3.5 h-3.5 fill-slate-950" />
            {'reserve_now'.tr}
          </button>
        </div>
      </div>

      {/* Mobile Clean Navigation Bar */}
      <div className="lg:hidden flex items-center justify-between border-t border-[#145A9B]/60 bg-[#030B17] px-2 py-2 overflow-x-auto gap-1.5">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'home' ? 'bg-[#0987CE] text-white shadow-xs' : 'text-slate-300 bg-[#071D3D]'
          }`}
        >
          {'home_live'.tr}
        </button>
        <button
          onClick={() => setActiveTab('arenas_directory')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'arenas_directory' || activeTab === 'scheduler'
              ? 'bg-[#0987CE] text-white shadow-xs'
              : 'text-slate-300 bg-[#071D3D]'
          }`}
        >
          {'arenas_classes'.tr}
        </button>
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'tournaments' ? 'bg-[#0987CE] text-white shadow-xs' : 'text-slate-300 bg-[#071D3D]'
          }`}
        >
          {'tournaments_bracket'.tr.split(' ')[1] || 'Torneios'}
        </button>
        <button
          onClick={() => setActiveTab('ranking_athletes')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'ranking_athletes' ? 'bg-[#0987CE] text-white shadow-xs' : 'text-slate-300 bg-[#071D3D]'
          }`}
        >
          {'ranking_board'.tr}
        </button>
        <button
          onClick={() => setActiveTab('shark_academy')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'shark_academy'
              ? 'bg-[#12C7BB] text-slate-950 shadow-xs'
              : 'text-[#12C7BB] bg-[#071D3D]'
          }`}
        >
          {'shark_academy'.tr}
        </button>
        <button
          onClick={() => setActiveTab('register_dupla')}
          className={`flex-1 px-2.5 py-2 text-xs font-extrabold rounded-lg whitespace-nowrap cursor-pointer text-center transition-all ${
            activeTab === 'register_dupla' ? 'bg-[#0987CE] text-white shadow-xs' : 'text-slate-300 bg-[#071D3D]'
          }`}
        >
          {'doubles_registration'.tr.split(' ')[0] || 'Inscrição'}
        </button>
      </div>
    </header>
  );
};
