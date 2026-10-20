import React, { useState, useEffect } from 'react';
import { useApp, ArenaSubTab } from '../context/AppContext';
import { useSharkStore } from '../store/useSharkStore';
import { SharksetLogo } from './SharksetLogo';
import { UserProfileModal } from './UserProfileModal';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  Search,
  Bell,
  Radio,
  MapPin,
  ArrowLeft,
  PlusCircle,
  LogIn,
  Home,
  Trophy,
  TrendingUp,
  Users,
  UserCheck,
  Calendar,
  Award,
  Info,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { FreeSlotsNewsTicker } from './FreeSlotsNewsTicker';
import { TopBarSlotDetailsModal } from './TopBarSlotDetailsModal';
import { QuickBookingPaymentModal, type QuickBookingSlotData } from './QuickBookingPaymentModal';
import { TopBarSearchBox } from './TopBarSearchBox';
import {
  NavIconHome,
  NavIconTrophy,
  NavIconNet,
  NavIconPodium,
  NavIconBooking,
  NavIconReader,
} from './icons/NavIcons';
import type { UpcomingSlotItem } from '../hooks/useUpcomingFreeSlots';
import type { AvailabilityCell } from '../services/bookingAvailability';
import type { Court, TenantConfig } from '../types';

export const Navbar: React.FC = () => {
  const {
    tenant,
    setTenantId,
    activeTab,
    setActiveTab,
    arenaSubTab,
    setArenaSubTab,
    setCommandPaletteOpen,
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

  const [scrollY, setScrollY] = useState<number>(0);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [selectedSlotModal, setSelectedSlotModal] = useState<UpcomingSlotItem | null>(null);
  const [checkoutSlotData, setCheckoutSlotData] = useState<QuickBookingSlotData | null>(null);

  const handleSelectBookingFromModal = (arena: TenantConfig, slot: AvailabilityCell, court: Court) => {
    setSelectedSlotModal(null);
    setCheckoutSlotData({
      arena,
      courtId: court.id,
      courtName: court.name,
      date: slot.date,
      time: slot.startTime,
      endTime: slot.endTime,
      price: slot.price,
      sport: court.sports[0] || 'futevolei',
    });
  };

  const handleGoToArenaFromModal = (arena: TenantConfig) => {
    setSelectedSlotModal(null);
    setTenantId(arena.id);
    setArenaSubTab('agendamentos');
    setActiveTab('scheduler');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isScrolled = scrollY > 25;
  const goHome = () => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;
  const notifiedWaitlistCount =
    waitlist.filter((w) => w.status === 'notified').length + waitlistNotifications.length;
  const unreadSmartCount = smartNotifications.filter((n) => !n.read).length;

  // Is viewing a dedicated Arena Page ('scheduler')
  const isArenaPage = Boolean(tenant.id) && activeTab === 'scheduler';

  // Strictly scope White-Label Arena Branding to the Arena page ('scheduler') only
  const isArenaWhiteLabelSite =
    isArenaPage &&
    Boolean(tenant.whiteLabelEnabled && tenant.logoUrl && tenant.brandPalette);

  const arenaPalette = tenant.brandPalette;

  const openBroadcastStudio = () => {
    const booking = bookings.find(item => item.status === 'confirmed');
    if (booking) setActiveLiveBroadcastBookingId(booking.id);
    else if (tenant.id) { setActiveTab('scheduler'); setArenaSubTab('transmissoes'); } else setActiveTab('live');
  };
  const liveButtons = (
    <div className="navbar-live-actions flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => setActiveTab('live')}
        aria-current={activeTab === 'live' ? 'page' : undefined}
        className="navbar-live-action relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-red-700/30 border border-red-400/50 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
        title="Assistir partidas ao vivo agora"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <span>LIVE</span>
      </button>

      <button
        type="button"
        onClick={openBroadcastStudio}
        className="navbar-live-action inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF6B00] via-[#FF8533] to-[#E65100] hover:from-[#FF781F] hover:to-[#FF6B00] text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,107,0,0.45)] border border-amber-300 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
        title="Abrir estúdio de transmissão ao vivo"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <Radio size={14} className="text-slate-950 stroke-[2.5]" />
        <span>INICIAR TRANSMISSÃO</span>
      </button>
    </div>
  );

  // General Platform Navigation Items with unified pill standard
  const navItems: {
    id: typeof activeTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string; isActive?: boolean }>;
    isArena?: boolean;
  }[] = [
    { id: 'home', label: 'INÍCIO', icon: NavIconHome },
    { id: 'tournaments', label: 'CAMPEONATOS', icon: NavIconTrophy },
    { id: 'arenas_directory', label: 'ARENAS', icon: NavIconNet, isArena: true },
    { id: 'ranking_athletes', label: 'RANKINGS', icon: NavIconPodium },
    { id: 'shark_academy', label: 'COMUNIDADE', icon: NavIconReader },
    { id: 'register_dupla', label: 'INSCRIÇÕES', icon: NavIconBooking },
  ];

  // Dedicated Arena Page Navigation Items with unified pill standard
  const arenaNavItems: {
    id: ArenaSubTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string; isActive?: boolean }>;
    isLive?: boolean;
  }[] = [
    { id: 'agendamentos', label: 'AGENDAMENTOS', icon: NavIconBooking },
    { id: 'ranking', label: 'RANKING', icon: NavIconPodium },
    { id: 'campeonatos', label: 'CAMPEONATOS', icon: NavIconTrophy },
    { id: 'transmissoes', label: 'AO VIVO', icon: Radio, isLive: true },
    { id: 'comunidade', label: 'COMUNIDADE', icon: NavIconReader },
    { id: 'info_historico', label: 'INFORMAÇÕES', icon: Info },
  ];

  const activeAccentHex =
    isArenaWhiteLabelSite && arenaPalette ? arenaPalette.accent || arenaPalette.primary : '#FF6B00';

  const effectiveArenaSubTab = arenaSubTab || 'agendamentos';

  return (
    <header
      className={`site-navbar aquarium-glass sticky top-0 z-40 w-full bg-[#030B17]/95 backdrop-blur-md text-white border-b border-cyan-500/20 shadow-md transition-all duration-300 ${
        scrollY > 90 ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={
        isArenaWhiteLabelSite && arenaPalette
          ? {
              backgroundColor: arenaPalette.headerBg,
              borderBottomColor: `${arenaPalette.primary}66`,
            }
          : undefined
      }
    >
      {/* Top Banner Ribbon for Arena Page */}
      {isArenaPage && (
        <div
          className="w-full px-3 sm:px-6 py-1 text-[11px] font-black tracking-wider uppercase flex items-center justify-between border-b transition-colors"
          style={{
            backgroundColor: arenaPalette?.primary || '#052342',
            borderColor: arenaPalette ? `${arenaPalette.accent}44` : '#38bdf844',
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="truncate">
              PÁGINA OFICIAL DA ARENA: <strong>{tenant.name}</strong> ({tenant.city}/{tenant.state})
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('arenas_directory')}
              className="px-2.5 py-0.5 rounded-md bg-white/20 hover:bg-white/30 text-white font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Ver Outras Arenas</span>
            </button>
            <span className="hidden sm:inline px-2 py-0.5 rounded bg-black/25 text-[10px] font-black tracking-widest text-cyan-200 border border-cyan-400/20">
              SHARKSET
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          1. TELAS GRANDES (DESKTOP >= 1024px)
          - Logo na esquerda: grande 3D (124px) no topo, diminuindo suavemente
            até 36px (tamanho do avatar) ao rolar o site para baixo
          - À direita: Linha 1 de botões e ações + Linha 2 com campo de busca
          ===================================================================== */}
      <div className="header-desktop hidden lg:block max-w-[1600px] mx-auto px-4 sm:px-6 py-2 transition-all duration-300">
        <div className="header-layout flex items-center gap-4 lg:gap-5">

          {/* Logo Column (Desktop) - Aumentada ocupando o círculo branco de ~124px */}
          <div className="shrink-0 flex items-center justify-center self-stretch pr-2">
            {isArenaWhiteLabelSite && tenant.logoUrl ? (
              <button
                type="button"
                onClick={() => setActiveTab('scheduler')}
                className="group cursor-pointer rounded-full overflow-hidden border-2 border-white/80 shadow-2xl transition-all duration-300 w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center bg-slate-900"
                style={{ borderColor: arenaPalette?.accent || '#FF6B00' }}
                title={tenant.name}
              >
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <a
                href="#sharkset"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('home');
                }}
                className="navbar-coin-anchor flex items-center justify-center cursor-pointer transition-all duration-300 ease-out z-30 p-1 hover:scale-105"
                title="SHARKSET Oficial"
              >
                <SharksetLogo
                  variant="coin3d"
                  customPx={124}
                  className="transition-all duration-300 drop-shadow-[0_10px_28px_rgba(0,180,255,0.45)]"
                />
              </a>
            )}
          </div>

          {/* Content Column: Linha 1 (Abas), Linha 2 (Ticker no Retângulo Vermelho + Ações LIVE), Linha 3 (Busca) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">

            {/* Linha 1: Botões de navegação das abas */}
            <div className="header-navigation-row flex items-center justify-between gap-2">
              <nav aria-label="Navegação desktop" className="flex flex-wrap items-center gap-2 py-0.5">
                {isArenaPage ? (
                  <>
                    <button
                      type="button"
                      onClick={goHome}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 hover:border-cyan-300 font-bold text-xs uppercase tracking-wider shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Home size={14} className="text-[#12C7BB]" />
                      <span>INÍCIO</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('arenas_directory')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 hover:border-cyan-300 font-bold text-xs uppercase tracking-wider shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                      title="Voltar para todas as arenas"
                    >
                      <ArrowLeft size={14} className="text-[#12C7BB]" />
                      <span>Todas as Arenas</span>
                    </button>

                    {arenaNavItems.map((item) => {
                      const isActive = effectiveArenaSubTab === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setArenaSubTab(item.id)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all active:translate-y-0.5 cursor-pointer whitespace-nowrap shadow-md ${
                            isActive
                              ? 'bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-600 text-slate-950 font-black border border-cyan-300 shadow-[0_0_15px_rgba(18,199,187,0.45)]'
                              : 'bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 hover:border-cyan-300'
                          }`}
                        >
                          {item.isLive ? (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                            </span>
                          ) : (
                            <Icon size={20} isActive={isActive} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                          )}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => item.id === 'home' ? goHome() : setActiveTab(item.id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider transition-all active:translate-y-0.5 cursor-pointer whitespace-nowrap shadow-md ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-600 text-slate-950 font-black border border-cyan-300 shadow-[0_0_15px_rgba(18,199,187,0.45)]'
                            : 'bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 hover:border-cyan-300'
                        }`}
                      >
                        <Icon size={20} isActive={isActive} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })
                )}
              </nav>
            </div>

            {/* Linha 2: ONDE O USUÁRIO DESENHOU O QUADRADO VERMELHO (Carrossel na esquerda ocupando todo o espaço restante) + Ações à direita (LIVE, INICIAR TRANSMISSÃO, etc) */}
            <div className="flex items-center justify-between gap-3 w-full">
              {/* O Quadrado Vermelho: Carrossel de Horários Livres esticado até o botão de LIVE */}
              <div className="flex-1 min-w-0">
                <FreeSlotsNewsTicker
                  onSlotClick={(item) => setSelectedSlotModal(item)}
                  variant="topbar"
                />
              </div>

              {/* Botões de Ação na Direita: LIVE, INICIAR TRANSMISSÃO, Notificação, Usuário, Admin */}
              <div className="flex items-center gap-2 shrink-0">
                {liveButtons}

                {/* Botão de Notificações com cor bem chamativa (Gradiente Fuchsia/Roxo vibrante com brilho neon) */}
                <button
                  type="button"
                  onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
                  className="relative inline-flex items-center justify-center p-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white border border-fuchsia-300/80 hover:border-white transition-all cursor-pointer shadow-[0_0_18px_rgba(217,70,239,0.55)] active:translate-y-0.5 active:scale-95 shrink-0"
                  title="Alertas e Notificações"
                  aria-label="Alertas e Notificações"
                >
                  <Bell className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                  {(unreadSmartCount > 0 || notifiedWaitlistCount > 0) && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs bg-red-500 animate-pulse border border-white"
                    >
                      {unreadSmartCount + notifiedWaitlistCount}
                    </span>
                  )}
                </button>

                {!firebaseUser ? (
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 hover:border-cyan-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:translate-y-0.5"
                    title="Entrar com Google"
                  >
                    <LogIn className="w-3.5 h-3.5 text-[#12C7BB]" />
                    <span>Entrar com Google</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="relative inline-flex items-center gap-2.5 pl-1 pr-4 py-1 rounded-full bg-[#052445]/90 hover:bg-[#083566] border border-cyan-500/40 hover:border-cyan-300 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:translate-y-0.5 cursor-pointer shrink-0"
                    title={`Perfil de ${firebaseUser.displayName || userProfile.name || 'Atleta'}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-900 text-white font-black text-xs flex items-center justify-center border border-cyan-400 shadow-xs">
                        {firebaseUser.photoURL ? (
                          <img
                            src={firebaseUser.photoURL}
                            alt={firebaseUser.displayName || userProfile.name || 'Atleta'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{(firebaseUser.displayName || userProfile.name || 'A').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#052445] shadow-[0_0_8px_rgba(16,185,129,0.95)] z-20 pointer-events-none" />
                    </div>
                    <span className="text-xs font-black text-white max-w-[80px] truncate">
                      {(firebaseUser.displayName || userProfile.name || 'Atleta').split(' ')[0]}
                    </span>
                  </button>
                )}

                {/* Botão de Área do Administrador com fundo amarelo igual ao botão flutuante */}
                <button
                  type="button"
                  onClick={() => setActiveTab('arena_admin')}
                  aria-current={activeTab === 'arena_admin' ? 'page' : undefined}
                  className={`inline-flex items-center justify-center p-2 rounded-full font-bold transition-all active:translate-y-0.5 cursor-pointer shadow-md shrink-0 ${
                    activeTab === 'arena_admin'
                      ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  }`}
                  title="Área do Administrador"
                  aria-label="Área do Administrador"
                >
                  <ShieldCheck size={18} className={activeTab === 'arena_admin' ? 'text-slate-950 stroke-[2.5]' : 'text-amber-300'} />
                </button>
              </div>
            </div>

            {/* Linha 3: Campo de Busca Desktop com Dropdown de Pesquisas Recentes & Arenas Populares */}
            <div className="w-full pb-1">
              <TopBarSearchBox />
            </div>

          </div>
        </div>
      </div>

      {/* =====================================================================
          2. TELAS PEQUENAS E CELULAR (< 1024px)
          - Tudo centralizado
          - Logo um pouco maior (~54px)
          - Botões SEMPRE A MOSTRA em grid fácil de clicar (zero rolagem de aba!)
          - Fáceis de usar em qualquer lugar do site
          ===================================================================== */}
      {/* =====================================================================
          2. TELAS PEQUENAS E CELULAR (< 1024px)
          - Mesmo padrão do PC: Logo na esquerda, Perfil na direita
          - Entre os dois: Botão de AO VIVO bem destacado (vermelho pulsando) + Notificação
          - Linha 2: Botões SEMPRE A MOSTRA em grid de fácil clique (zero rolagem de aba!)
          - Linha 3: Campo de busca centralizado
          ===================================================================== */}
      <div className="lg:hidden max-w-2xl mx-auto px-3 sm:px-4 py-2 flex flex-col items-center gap-2">

        {/* LINHA 1 (Topo Mobile):
            ESQUERDA: Logo
            ENTRE OS DOIS: Botão AO VIVO pulsante vermelho bem destacado + Botão de Notificação
            DIREITA: Perfil do usuário */}
        <div className="w-full flex items-center justify-between gap-2">

          {/* ESQUERDA: LOGO AUMENTADA (ocupando o espaço com presença forte) */}
          <div className="flex items-center shrink-0">
            {isArenaWhiteLabelSite && tenant.logoUrl ? (
              <button
                type="button"
                onClick={() => setActiveTab('scheduler')}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer active:translate-y-0.5 transition-all"
                title={tenant.name}
              >
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="cursor-pointer group flex items-center justify-center shrink-0 transition-transform active:scale-95"
                title="SHARKSET Início"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-transparent active:translate-y-0.5 transition-all">
                  <SharksetLogo variant="coin3d" customPx={54} />
                </div>
              </button>
            )}
          </div>

          {/* DIREITA: BOTÃO DE NOTIFICAÇÃO AO LADO DA FOTO DO USUÁRIO + BOLINHA ONLINE À FRENTE DA FOTO E DO ENTORNO */}
          <div className="flex items-center gap-2 shrink-0">
            {/* BOTÃO DA ÁREA DO ADMINISTRADOR COM FUNDO AMARELO */}
            <button
              type="button"
              onClick={() => setActiveTab('arena_admin')}
              aria-current={activeTab === 'arena_admin' ? 'page' : undefined}
              className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 shrink-0 shadow-xs border ${
                activeTab === 'arena_admin'
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
              }`}
              title="Área do Administrador"
              aria-label="Área do Administrador"
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'arena_admin' ? 'text-slate-950 stroke-[2.5]' : 'text-amber-300'}`} />
            </button>

            {/* BOTÃO DE NOTIFICAÇÃO COM COR BEM CHAMATIVA (FUCHSIA/ROXO VIBRANTE) */}
            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
              className="relative p-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white border border-fuchsia-300/80 shadow-[0_0_14px_rgba(217,70,239,0.55)] cursor-pointer transition-all active:scale-95 shrink-0"
              title="Alertas e Notificações"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              {(unreadSmartCount > 0 || notifiedWaitlistCount > 0) && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-black text-white bg-red-500 border border-white flex items-center justify-center shadow-xs animate-pulse"
                >
                  {unreadSmartCount + notifiedWaitlistCount}
                </span>
              )}
            </button>

            {/* BOTÃO DO USUÁRIO OU LOGIN COM GOOGLE */}
            {!firebaseUser ? (
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 text-xs font-black cursor-pointer active:scale-95 transition-all shrink-0"
                title="Entrar com Google"
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                <span>Entrar</span>
              </button>
            ) : (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-slate-900 border-2 border-white/90 shadow-md block cursor-pointer active:scale-95 transition-transform"
                  title={`Perfil de ${firebaseUser.displayName || userProfile.name || 'Atleta'}`}
                >
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt={firebaseUser.displayName || userProfile.name || 'Atleta'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs bg-slate-800">
                      {(firebaseUser.displayName || userProfile.name || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                {/* Bolinha de usuário online NA FRENTE da foto e do entorno */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#030B17] shadow-[0_0_8px_rgba(16,185,129,0.95)] z-20 pointer-events-none"
                  aria-label="Usuário online"
                />
              </div>
            )}
          </div>

        </div>

        <div className="w-full flex flex-col gap-2">
          <FreeSlotsNewsTicker onSlotClick={(item) => setSelectedSlotModal(item)} variant="topbar" />
          <div className="flex justify-center w-full">{liveButtons}</div>
        </div>

        {/* LINHA 2: BOTÕES SEMPRE A MOSTRA (SEM ROLAR!)
            Grid responsivo: 3 colunas x 2 linhas em celulares / 6 colunas em tablets.
            Cada botão é largo, alto (py-2.5) e super fácil de tocar no dedo! */}
        <div className="w-full">
          <nav
            aria-label="Navegação móvel com botões sempre à mostra"
            className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 w-full"
          >
            {isArenaPage && (
              <button
                type="button"
                onClick={goHome}
                className="lg:hidden min-h-10 px-3 py-2 rounded-full border border-cyan-500/40 bg-[#052445]/90 text-white text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-md active:scale-95"
              >
                <Home size={13} className="text-[#12C7BB]" />
                <span>INÍCIO</span>
              </button>
            )}
            {isArenaPage ? (
              arenaNavItems.map((item) => {
                const isActive = effectiveArenaSubTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setArenaSubTab(item.id)}
                    className={`min-h-10 py-2 px-1.5 text-[11px] font-bold tracking-wider uppercase transition-all rounded-full text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-md border ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-600 text-slate-950 font-black border-cyan-300 shadow-[0_0_12px_rgba(18,199,187,0.4)]'
                        : 'text-white bg-[#052445]/90 hover:bg-[#083566] border-cyan-500/30'
                    }`}
                  >
                    {item.isLive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                    ) : (
                      <Icon size={18} isActive={isActive} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                    )}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            ) : (
              navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => item.id === 'home' ? goHome() : setActiveTab(item.id)}
                    className={`min-h-10 py-2 px-1.5 text-[11px] font-bold tracking-wider uppercase transition-all rounded-full text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-md border ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 via-[#12C7BB] to-blue-600 text-slate-950 font-black border-cyan-300 shadow-[0_0_12px_rgba(18,199,187,0.4)]'
                        : 'text-white bg-[#052445]/90 hover:bg-[#083566] border-cyan-500/30'
                    }`}
                  >
                    <Icon size={18} isActive={isActive} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>

        {/* LINHA 3: CAMPO DE BUSCA CENTRALIZADO COM DROPDOWN DE PESQUISAS RECENTES & ARENAS POPULARES */}
        <div className="w-full">
          <TopBarSearchBox compact />
        </div>

      </div>

      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      <TopBarSlotDetailsModal
        isOpen={Boolean(selectedSlotModal)}
        onClose={() => setSelectedSlotModal(null)}
        arena={selectedSlotModal?.arena || null}
        court={selectedSlotModal?.court || null}
        slot={selectedSlotModal?.slot || null}
        distanceKm={selectedSlotModal?.distanceKm}
        onSelectBooking={handleSelectBookingFromModal}
        onGoToArena={handleGoToArenaFromModal}
      />

      <QuickBookingPaymentModal
        slotData={checkoutSlotData}
        onClose={() => setCheckoutSlotData(null)}
      />
    </header>
  );
};
