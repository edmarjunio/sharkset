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
  const isArenaPage = activeTab === 'scheduler';

  // Strictly scope White-Label Arena Branding to the Arena page ('scheduler') only
  const isArenaWhiteLabelSite =
    isArenaPage &&
    Boolean(tenant.whiteLabelEnabled && tenant.logoUrl && tenant.brandPalette);

  const arenaPalette = tenant.brandPalette;

  const openBroadcastStudio = () => {
    const booking = bookings.find(item => item.status === 'confirmed');
    if (booking) setActiveLiveBroadcastBookingId(booking.id);
    else { setActiveTab('scheduler'); setArenaSubTab('transmissoes'); }
  };
  const liveActions = (
    <div className="navbar-live-actions flex items-center gap-2">
      <button
        type="button"
        onClick={() => setActiveTab('live')}
        aria-current={activeTab === 'live' ? 'page' : undefined}
        className="navbar-live-action relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-md shadow-red-700/30 border border-red-400/40 active:translate-y-0.5 transition-all cursor-pointer"
        title="Assistir partidas ao vivo agora"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <span>LIVE</span>
      </button>
      <button
        type="button"
        onClick={openBroadcastStudio}
        className="navbar-live-action inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#052445]/90 hover:bg-[#083566] text-white border border-cyan-500/40 font-bold text-xs shadow-md active:translate-y-0.5 transition-all cursor-pointer"
        title="Abrir estúdio de transmissão ao vivo"
      >
        <Radio size={14} className="text-[#12C7BB]" />
        <span>INICIAR TRANSMISSÃO</span>
      </button>
    </div>
  );

  // General Platform Navigation Items
  const navItems: { id: typeof activeTab; label: string; isArena?: boolean }[] = [
    { id: 'home', label: 'INÍCIO' },
    { id: 'tournaments', label: 'CAMPEONATOS' },
    { id: 'arenas_directory', label: 'ARENAS', isArena: true },
    { id: 'ranking_athletes', label: 'RANKINGS' },
    { id: 'shark_academy', label: 'COMUNIDADE' },
    { id: 'register_dupla', label: 'INSCRIÇÕES' },
  ];

  // Dedicated Arena Page Navigation Items
  const arenaNavItems: { id: ArenaSubTab; label: string; isLive?: boolean }[] = [
    { id: 'agendamentos', label: 'AGENDAMENTOS' },
    { id: 'ranking', label: 'RANKING' },
    { id: 'campeonatos', label: 'CAMPEONATOS' },
    { id: 'transmissoes', label: 'AO VIVO', isLive: true },
    { id: 'comunidade', label: 'COMUNIDADE' },
    { id: 'info_historico', label: 'INFORMAÇÕES' },
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
      <div className="hidden lg:block max-w-[1600px] mx-auto px-4 sm:px-6 py-2 transition-all duration-300">
        <div className="flex items-start gap-4 lg:gap-5">

          {/* Logo Column (Desktop) */}
          <div className="shrink-0 flex items-center justify-center pt-0.5">
            {isArenaWhiteLabelSite && tenant.logoUrl ? (
              <button
                type="button"
                onClick={() => setActiveTab('scheduler')}
                className={`group cursor-pointer rounded-full overflow-hidden border-2 border-white/80 shadow-xl transition-all duration-300 ${
                  isScrolled
                    ? 'w-9 h-9 translate-y-0'
                    : 'w-28 h-28 xl:w-32 xl:h-32 translate-y-2'
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
                    ? 'translate-y-0'
                    : 'translate-y-2 lg:translate-y-3'
                }`}
                title="SHARKSET Oficial"
              >
                <SharksetLogo
                  variant={isScrolled ? 'default' : 'coin3d'}
                  customPx={isScrolled ? 36 : 124}
                  className="transition-all duration-300"
                />
              </a>
            )}
          </div>

          {/* Content Column: Linha 1 (Navegação + Ações) e Linha 2 (Busca) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">

            {/* Linha 1: Botões de navegação + Ações */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <nav aria-label="Navegação desktop" className="flex flex-wrap items-center gap-1.5 py-0.5">
            {isArenaPage ? (
                  <>
                    <button type="button" onClick={goHome} className="min-h-9 px-3 py-2 rounded-xl text-xs font-black hover:bg-white/10 whitespace-nowrap">INÍCIO</button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('arenas_directory')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black text-slate-200 hover:text-white border border-white/15 transition-all cursor-pointer whitespace-nowrap mr-1"
                      title="Voltar para todas as arenas"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Todas as Arenas</span>
                    </button>

                    {arenaNavItems.map((item) => {
                      const isActive = effectiveArenaSubTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setArenaSubTab(item.id)}
                          className={`relative min-h-9 px-3 py-2 text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer rounded-xl ${
                            isActive
                              ? 'text-white bg-white/15 shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                          }`}
                          style={isActive ? { color: activeAccentHex } : undefined}
                        >
                          <span className="flex items-center gap-1.5">
                            {item.isLive && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                            {item.label}
                          </span>
                          {isActive && (
                            <span
                              className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full transition-all"
                              style={{ backgroundColor: activeAccentHex }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  navItems.map((item) => {
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => item.id === 'home' ? goHome() : setActiveTab(item.id)}
                        className={`relative min-h-9 px-3 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors whitespace-nowrap cursor-pointer rounded-xl ${
                          isActive
                            ? 'text-white bg-white/10'
                            : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                        style={isActive ? { color: activeAccentHex } : undefined}
                      >
                        <span className="flex items-center gap-1.5">

                          {item.label}
                        </span>
                        {isActive && (
                          <span
                            className="absolute bottom-0 left-2 right-2 h-[2.5px] rounded-full transition-all"
                            style={{ backgroundColor: activeAccentHex }}
                          />
                        )}
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
                  onClick={() => {
                    if (isArenaPage) {
                      setArenaSubTab('campeonatos');
                    } else {
                      setActiveTab('tournaments');
                    }
                  }}
                  className="px-4 py-1.5 rounded-full text-white text-xs font-black transition-all whitespace-nowrap cursor-pointer shadow-sm hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: activeAccentHex }}
                >
                  Criar Torneio
                </button>

                <button
                  type="button"
                  onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
                  className="relative p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="Alertas e Notificações"
                >
                  <Bell className="w-4 h-4" />
                  {(unreadSmartCount > 0 || notifiedWaitlistCount > 0) && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: activeAccentHex }}
                    >
                      {unreadSmartCount + notifiedWaitlistCount}
                    </span>
                  )}
                </button>

                {!firebaseUser ? (
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Entrar com Google"
                  >
                    <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Entrar com Google</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="relative flex items-center gap-2 pl-0.5 pr-3 py-0.5 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-all cursor-pointer shrink-0"
                    title={`Perfil de ${firebaseUser.displayName || userProfile.name || 'Atleta'}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-900 text-white font-black text-xs flex items-center justify-center border-2 border-white/80 shadow-xs">
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
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.95)] z-20 pointer-events-none" />
                    </div>
                    <span className="text-xs font-black text-white max-w-[80px] truncate">
                      {(firebaseUser.displayName || userProfile.name || 'Atleta').split(' ')[0]}
                    </span>
                  </button>
                )}
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
          </div>

        </div>

        <div className="flex justify-center w-full">{liveActions}</div>

        {/* LINHA 2: BOTÕES SEMPRE A MOSTRA (SEM ROLAR!)
            Grid responsivo: 3 colunas x 2 linhas em celulares / 6 colunas em tablets.
            Cada botão é largo, alto (py-2.5) e super fácil de tocar no dedo! */}
        <div className="w-full">
          <nav
            aria-label="Navegação móvel com botões sempre à mostra"
            className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 w-full"
          >
            {isArenaPage && <button type="button" onClick={goHome} className="lg:hidden min-h-10 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-[11px] font-black">INÍCIO</button>}
            {isArenaPage ? (
              arenaNavItems.map((item) => {
                const isActive = effectiveArenaSubTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setArenaSubTab(item.id)}
                    className={`min-h-10 py-2.5 px-2 text-[11px] font-black tracking-wide uppercase transition-all rounded-xl text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-xs border ${
                      isActive
                        ? 'text-white border-transparent shadow-md font-black'
                        : 'text-slate-200 bg-slate-900/90 hover:bg-slate-800 border-slate-800'
                    }`}
                    style={isActive ? { backgroundColor: activeAccentHex } : undefined}
                  >
                    {item.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })
            ) : (
              navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => item.id === 'home' ? goHome() : setActiveTab(item.id)}
                    className={`min-h-10 py-2 px-1 text-[11px] font-black tracking-wide uppercase transition-all rounded-xl text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-xs border ${
                      isActive
                        ? 'text-white border-white/20 shadow-md font-black'
                        : 'text-slate-200 bg-slate-900/90 hover:bg-slate-800 border-slate-800'
                    }`}
                    style={isActive ? { backgroundColor: activeAccentHex } : undefined}
                  >

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
