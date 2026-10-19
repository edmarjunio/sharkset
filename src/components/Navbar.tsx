import React from 'react';
import { useApp } from '../context/AppContext';
import { useSharkStore } from '../store/useSharkStore';
import { SharksetLogo } from './SharksetLogo';
import {
  Search,
  Video,
  Bell,
  Palette,
  Radio,
  MapPin,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    tenant,
    activeTab,
    setActiveTab,
    setCommandPaletteOpen,
    setTenantModalOpen,
    bookings,
    waitlist,
    waitlistNotifications,
    setActiveLiveBroadcastBookingId,
    userProfile,
  } = useApp();

  const {
    smartNotifications,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
  } = useSharkStore();

  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;
  const notifiedWaitlistCount =
    waitlist.filter((w) => w.status === 'notified').length + waitlistNotifications.length;
  const unreadSmartCount = smartNotifications.filter((n) => !n.read).length;

  // Strictly scope White-Label Arena Branding to the Arena page ('scheduler') only
  const isArenaWhiteLabelSite =
    activeTab === 'scheduler' &&
    Boolean(tenant.whiteLabelEnabled && tenant.logoUrl && tenant.brandPalette);

  const arenaPalette = tenant.brandPalette;

  const handleOpenLiveBroadcastStudio = () => {
    const firstActive = bookings.find((b) => b.status === 'confirmed');
    if (firstActive) {
      setActiveLiveBroadcastBookingId(firstActive.id);
    } else {
      setActiveTab('scheduler');
    }
  };

  const navItems: { id: typeof activeTab; label: string; isArena?: boolean }[] = [
    { id: 'tournaments', label: 'CAMPEONATOS' },
    { id: 'arenas_directory', label: 'ARENAS', isArena: true },
    { id: 'ranking_athletes', label: 'RANKINGS' },
    { id: 'shark_academy', label: 'COMUNIDADE' },
    { id: 'home', label: 'AO VIVO' },
    { id: 'register_dupla', label: 'INSCRIÇÕES' },
  ];

  const activeAccentHex =
    isArenaWhiteLabelSite && arenaPalette ? arenaPalette.accent || arenaPalette.primary : '#FF6B00';

  return (
    <header
      className="site-navbar aquarium-glass sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md text-slate-900 border-b border-slate-200 shadow-xs transition-colors"
      style={
        isArenaWhiteLabelSite && arenaPalette
          ? {
              backgroundColor: arenaPalette.headerBg,
              borderBottomColor: `${arenaPalette.primary}66`,
            }
          : undefined
      }
    >
      {/* Top White-Label Ribbon when Arena Custom Site Mode is Active */}
      {isArenaWhiteLabelSite && arenaPalette && (
        <div
          className="w-full px-4 py-1 text-[11px] font-black tracking-wider uppercase flex items-center justify-between border-b border-white/10"
          style={{
            backgroundColor: arenaPalette.primary,
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-3 h-3 shrink-0" style={{ color: arenaPalette.accent }} />
            <span className="truncate">
              SITE OFICIAL EXCLUSIVO DA ARENA: {tenant.name} ({tenant.city}/{tenant.state})
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-[10px] font-bold text-white/90">
              ⚽ Foco: Futevôlei · Em breve abas p/ outros esportes
            </span>
            <span className="px-2 py-0.5 rounded bg-black/25 text-[10px] font-black tracking-widest text-white border border-white/20">
              DESENVOLVIDO POR SHARKSET
            </span>
          </div>
        </div>
      )}

      <div className="navbar-top w-full px-3 sm:px-6 flex flex-wrap items-center justify-between gap-4 py-3">
        {/* LEFT: Super Large Brand Logo (Either Arena's White-Label Logo on Arena Page OR Extra-Large SHARKSET 3D Coin Logo) */}
        <div className="flex items-center gap-3 shrink-0">
          {isArenaWhiteLabelSite && tenant.logoUrl ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('scheduler')}
                className="flex items-center gap-3 group cursor-pointer text-left"
                title={`Site Oficial ${tenant.name}`}
              >
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-slate-950 p-1 border-2 shadow-xl transition-transform group-hover:scale-105 shrink-0"
                  style={{ borderColor: arenaPalette?.accent || arenaPalette?.primary || '#FF6B00' }}
                />
                <div className="hidden xl:block">
                  <div className="text-lg font-black tracking-tight leading-tight text-white drop-shadow-xs">
                    {tenant.name}
                  </div>
                  <div
                    className="text-[10px] font-extrabold uppercase tracking-widest mt-0.5"
                    style={{ color: arenaPalette?.accent || '#FBBF24' }}
                  >
                    DESENVOLVIDO POR SHARKSET
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <a
              href="#sharkset"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('home');
              }}
              className="navbar-coin-anchor flex items-center gap-2.5 group cursor-pointer shrink-0"
              title="SHARKSET Oficial"
            >
              <SharksetLogo size="2xl" variant="coin3d" />
            </a>
          )}
        </div>

        {/* CENTER: Clean Descontraído Uppercase Navigation matching the attached print + ARENAS */}
        <nav aria-label="Navegação principal" className="desktop-navigation hidden lg:flex flex-1 flex-wrap justify-center items-center gap-4 xl:gap-6">
          {navItems.map((item) => {
            const isActive =
              activeTab === item.id ||
              (item.isArena && (activeTab === 'arenas_directory' || activeTab === 'scheduler'));

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                className={`relative py-3 text-xs xl:text-[13px] font-extrabold tracking-wider uppercase transition-colors whitespace-nowrap cursor-pointer ${
                  isActive ? 'text-slate-950' : 'text-slate-600 hover:text-slate-950'
                }`}
                style={isActive ? { color: activeAccentHex } : undefined}
              >
                <span className="flex items-center gap-1.5">
                  {item.id === 'home' && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  {item.label}
                </span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full transition-all"
                    style={{ backgroundColor: activeAccentHex }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* RIGHT: Pill Search Bar + Transmitir Ao Vivo / Criar Torneio Orange Pill Button + User Avatar */}
        <div className="navbar-actions flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Search Input Pill (Matches screenshot "Buscar atletas ou torneios...") */}

          {/* Direct Live Broadcast Button ("fazer uma transmissão live ao vivo direto pelo site") */}
          <button
            type="button"
            onClick={handleOpenLiveBroadcastStudio}
            className="px-3.5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all whitespace-nowrap"
            title="Iniciar ou abrir transmissão ao vivo de agendamento na Arena"
            aria-label="Transmitir ao vivo"
          >
            <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Transmitir Live</span>
          </button>

          {/* Primary Orange Pill CTA Button (Matches screenshot "Criar Torneio") */}
          <button
            type="button"
            onClick={() => setActiveTab('tournaments')}
            className="px-4 sm:px-5 py-2.5 rounded-full text-white text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer shadow-sm hover:brightness-105 active:scale-[0.99]"
            style={{ backgroundColor: activeAccentHex }}
          >
            Criar Torneio
          </button>

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
            className="relative p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Alertas e Notificações"
            aria-label="Alertas e notificações"
            aria-expanded={notificationDrawerOpen}
          >
            <Bell className="w-4 h-4" />
            {(unreadSmartCount > 0 || notifiedWaitlistCount > 0) && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-black text-white flex items-center justify-center"
                style={{ backgroundColor: activeAccentHex }}
              >
                {unreadSmartCount + notifiedWaitlistCount}
              </span>
            )}
          </button>

          {/* User Avatar Circle matching the screenshot */}
          <button
            type="button"
            onClick={() => setActiveTab('my_bookings')}
            className="relative flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
            title={`Perfil de ${userProfile.name} (${activeBookingsCount} reservas)`}
          >
            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-slate-900 text-white font-black text-xs flex items-center justify-center border-2 border-white shadow-xs">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                alt={userProfile.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <span className="hidden xl:inline text-xs font-extrabold text-slate-800 max-w-[90px] truncate">
              {userProfile.name.split(' ')[0]}
            </span>
          </button>
        </div>
      {/* Mobile & Tablet Horizontal Navigation Bar */}
      <nav aria-label="Navegação principal no celular" className="mobile-navigation lg:hidden flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 overflow-x-auto gap-2">
        {navItems.map((item) => {
          const isActive =
            activeTab === item.id ||
            (item.isArena && (activeTab === 'arenas_directory' || activeTab === 'scheduler'));
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-[11px] font-extrabold rounded-full whitespace-nowrap cursor-pointer transition-all ${
                isActive
                  ? 'text-white shadow-xs'
                  : 'text-slate-600 bg-white border border-slate-200'
              }`}
              style={isActive ? { backgroundColor: activeAccentHex } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="navbar-search px-4 sm:px-6 pb-4">
        <button type="button" onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-3 w-full max-w-2xl mx-auto px-5 py-3 rounded-2xl border border-cyan-300/30 bg-slate-900 text-cyan-100 text-sm text-left"
          title="Buscar atletas, arenas ou torneios (Ctrl+K)">
          <Search className="w-4 h-4 shrink-0" /><span>Buscar atletas, arenas ou torneios...</span>
          <span className="ml-auto hidden sm:inline text-xs opacity-60">Ctrl + K</span>
        </button>
      </div>
      </div>
    </header>
  );
};
