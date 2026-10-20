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
  Shield,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    tenant,
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
  const liveActions = (
    <div className="navbar-live-actions flex items-center gap-2">
      <button
        type="button"
        onClick={() => setActiveTab('live')}
        aria-current={activeTab === 'live' ? 'page' : undefined}
        className="navbar-live-action relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-red-700/30 border border-red-400/50 active:translate-y-0.5 transition-all cursor-pointer"
        title="Assistir partidas ao vivo agora"
      >
        <Radio size={18} className="navbar-live-icon" aria-hidden="true" />
        <span>LIVE</span>
      </button>
      <button
        type="button"
        onClick={openBroadcastStudio}
        className="navbar-live-action navbar-live-studio inline-flex items-center gap-2 px-4 py-2 rounded-full font-black text-xs uppercase tracking-wider active:translate-y-0.5 transition-all cursor-pointer"
        title="Abrir estúdio de transmissão ao vivo"
      >
        <Radio size={16} className="text-white" aria-hidden="true" />
        <span>INICIAR TRANSMISSÃO</span>
      </button>
    </div>
  );

  const adminAction = (
    <button
      type="button"
      onClick={() => { setActiveTab('arena_admin'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      aria-label="Área do administrador da arena"
      aria-current={activeTab === 'arena_admin' ? 'page' : undefined}
      title="Área do administrador da arena"
      className={`navbar-admin-action inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-md transition-all active:scale-95 cursor-pointer ${
        activeTab === 'arena_admin'
          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.45)]'
          : 'bg-[#150f04]/90 hover:bg-[#241a06] text-amber-300 hover:text-white border-amber-500/40 hover:border-amber-300'
      }`}
    >
      <Shield size={18} className={activeTab === 'arena_admin' ? 'text-slate-950 stroke-[2.5]' : 'text-amber-400'} aria-hidden="true" />
    </button>
  );

  // General Platform Navigation Items with unified pill standard
  const navItems: {
    id: typeof activeTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    isArena?: boolean;
  }[] = [
    { id: 'home', label: 'INÍCIO', icon: Home },
    { id: 'tournaments', label: 'CAMPEONATOS', icon: Trophy },
    { id: 'arenas_directory', label: 'ARENAS', icon: MapPin, isArena: true },
    { id: 'ranking_athletes', label: 'RANKINGS', icon: TrendingUp },
    { id: 'shark_academy', label: 'COMUNIDADE', icon: Users },
    { id: 'register_dupla', label: 'INSCRIÇÕES', icon: UserCheck },
  ];

  // Dedicated Arena Page Navigation Items with unified pill standard
  const arenaNavItems: {
    id: ArenaSubTab;
    label: string;
    icon: React.FC<{ size?: number; className?: string }>;
    isLive?: boolean;
  }[] = [
    { id: 'agendamentos', label: 'AGENDAMENTOS', icon: Calendar },
    { id: 'ranking', label: 'RANKING', icon: Trophy },
    { id: 'campeonatos', label: 'CAMPEONATOS', icon: Award },
    { id: 'transmissoes', label: 'AO VIVO', icon: Radio, isLive: true },
    { id: 'comunidade', label: 'COMUNIDADE', icon: Users },
    { id: 'info_historico', label: 'INFORMAÇÕES', icon: Info },
  ];

  const activeAccentHex =
    isArenaWhiteLabelSite && arenaPalette ? arenaPalette.accent || arenaPalette.primary : '#FF6B00';

  const effectiveArenaSubTab = arenaSubTab || 'agendamentos';

  return (
    <header
      className="site-navbar aquarium-glass sticky top-0 z-40 w-full bg-[#030B17]/95 backdrop-blur-md text-white border-b border-cyan-500/20 shadow-md transition-colors"
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

          {/* Logo Column (Desktop) */}
          <div className="shrink-0 flex items-center justify-center pt-0.5">
            {isArenaWhiteLabelSite && tenant.logoUrl ? (
              <button
                type="button"
                onClick={() => setActiveTab('scheduler')}
                className={`group cursor-pointer rounded-full overflow-hidden border-2 border-white/80 shadow-xl transition-all duration-300 ${
                  isScrolled
                    ? 'w-16 h-16' : 'w-16 h-16'
                }`}
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
                className={`navbar-coin-anchor block cursor-pointer transition-all duration-300 ease-out z-30 ${
                  isScrolled
                    ? '' : ''
                }`}
                title="SHARKSET Oficial"
              >
                <SharksetLogo
                  variant="coin3d"
                  customPx={64}
                  className="transition-all duration-300"
                />
              </a>
            )}
          </div>

          {/* Content Column: Linha 1 (Navegação + Ações) e Linha 2 (Busca) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">

            {/* Linha 1: Botões de navegação + Ações */}
            <div className="header-navigation-row flex flex-wrap items-center justify-between gap-2">
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
                            <Radio size={18} className="navbar-live-icon" aria-hidden="true" />
                          ) : (
                            <Icon size={14} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
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
                        <Icon size={14} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })
                )}
              </nav>

              {/* Ações Desktop */}
              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                {liveActions}

                <button
                  type="button"
                  onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
                  className="relative inline-flex items-center justify-center p-2 rounded-full bg-[#052445]/90 hover:bg-[#083566] text-slate-200 hover:text-white border border-cyan-500/40 hover:border-cyan-300 transition-all cursor-pointer shadow-md active:translate-y-0.5"
                  title="Alertas e Notificações"
                >
                  <Bell className="w-4 h-4 text-cyan-300" />
                  {(unreadSmartCount > 0 || notifiedWaitlistCount > 0) && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs bg-red-500 animate-pulse"
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
                {adminAction}
              </div>
            </div>

            {/* Linha 2: Campo de Busca Desktop */}
            <div className="w-full pb-1">
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2.5 w-full px-4 py-2 rounded-2xl border border-cyan-500/30 bg-[#071526]/90 hover:bg-[#071526] text-cyan-200 text-xs sm:text-sm text-left shadow-inner transition-colors cursor-pointer"
                title="Buscar atletas, arenas ou torneios (Ctrl+K)"
              >
                <Search className="w-4 h-4 shrink-0 text-cyan-400" />
                <span className="truncate text-slate-300">Buscar atletas, arenas ou torneios...</span>
                <span className="ml-auto text-[11px] opacity-60 font-mono">Ctrl + K</span>
              </button>
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

          {/* ESQUERDA: LOGO (elevada com profundidade parecida com os botões, sem borda) */}
          <div className="flex items-center shrink-0">
            {isArenaWhiteLabelSite && tenant.logoUrl ? (
              <button
                type="button"
                onClick={() => setActiveTab('scheduler')}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer active:translate-y-0.5 transition-all"
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
                {/* Logo 2D elevada com profundidade estilo botão, sem borda */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-transparent active:translate-y-0.5 transition-all">
                  <img
                    src="/brand/sharkset-logo-transparent.png"
                    alt="SHARKSET"
                    width={40}
                    height={40}
                    className="w-full h-full rounded-full object-contain shark-logo-elevated"
                  />
                </div>
              </button>
            )}
          </div>

          {/* DIREITA: BOTÃO DE NOTIFICAÇÃO AO LADO DA FOTO DO USUÁRIO + BOLINHA ONLINE À FRENTE DA FOTO E DO ENTORNO */}
          <div className="flex items-center gap-2 shrink-0">
            {/* BOTÃO DE NOTIFICAÇÃO */}
            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
              className="relative p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
              title="Alertas e Notificações"
              aria-label="Notificações"
            >
              <Bell className="w-4 h-4 text-slate-200" />
              {(unreadSmartCount > 0 || notifiedWaitlistCount > 0) && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-black text-white bg-[#FF6B00] border border-[#030B17] flex items-center justify-center shadow-xs"
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
            {adminAction}
          </div>

        </div>

        <div className="flex justify-center w-full">{liveActions}</div>

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
                      <Radio size={18} className="navbar-live-icon" aria-hidden="true" />
                    ) : (
                      <Icon size={13} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
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
                    <Icon size={13} className={isActive ? 'text-slate-950 stroke-[2.5]' : 'text-[#12C7BB]'} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            )}
          </nav>
        </div>

        {/* LINHA 3: CAMPO DE BUSCA CENTRALIZADO */}
        <div className="w-full">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 w-full px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-[#071526]/90 hover:bg-[#071526] text-cyan-200 text-xs text-left shadow-inner transition-colors cursor-pointer"
            title="Buscar atletas, arenas ou torneios (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span className="truncate text-slate-300">Buscar atletas, arenas ou torneios...</span>
            <span className="ml-auto text-[10px] opacity-60 font-mono">Buscar</span>
          </button>
        </div>

      </div>

      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </header>
  );
};
