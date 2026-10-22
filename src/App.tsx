import { ConnectionStatus } from './components/ConnectionStatus';
﻿import { LiveDirectory } from './components/LiveDirectory';
import { useBroadcastNavigation } from './store/useBroadcastNavigation';
import { FreeSlotsDateTimeFilter } from './components/FreeSlotsDateTimeFilter';
import React, { lazy, Suspense } from 'react';
import { routeModules } from './services/routeModules';
import { recordMetric } from './services/performanceMetrics';
import { useNavigationHistory } from './hooks/useNavigationHistory';
const ArenaAdmin = lazy(routeModules.arena_admin);
const CourtScheduler = lazy(routeModules.scheduler);
const DoubleEliminationBracket = lazy(routeModules.tournaments);
const DoublesRegistration = lazy(routeModules.register_dupla);
const RankingBoard = lazy(routeModules.ranking_athletes);
const MyBookings = lazy(routeModules.my_bookings);
const SaaSConversionHub = lazy(routeModules.saas_hub);
const SharkAcademyCommunity = lazy(routeModules.shark_academy);
const ArenasDirectory = lazy(routeModules.arenas_directory);
const LiveBookingBroadcastModal = lazy(() => import('./components/LiveBookingBroadcastModal').then(m => ({ default: m.LiveBookingBroadcastModal })));
const BroadcastWatchScreen = lazy(() => import('./components/BroadcastWatchScreen').then(m => ({ default: m.BroadcastWatchScreen })));
const PageLoading = () => <div role="status" aria-label="Carregando" className="min-h-64 max-w-7xl mx-auto px-6 py-8"><div className="h-8 w-48 rounded bg-cyan-100/10 mb-6" /><div className="h-40 rounded-2xl bg-cyan-100/5" /></div>;
import { AquariumBackground } from './components/AquariumBackground';
import { SportBallIcon } from './components/icons/SportBallIcon';
import { TournamentResultNotifications } from './components/TournamentResultNotifications';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { SmartNotificationBanner } from './components/SmartNotificationBanner';
import { PinnedCouponBanner } from './components/PinnedCouponBanner';
import { PersistentLiveStreamDock } from './components/PersistentLiveStreamDock';
import { HomeHighlights } from './components/HomeHighlights';
import { CommandPalette } from './components/CommandPalette';
import { TenantSelectorModal } from './components/TenantSelectorModal';
import { SharksetLogo } from './components/SharksetLogo';
import { AthleteOnboardingModal } from './components/AthleteOnboardingModal';
import { auth, listenToBroadcastTournamentId } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Maximize2,
  Minimize2,
  Home,
  Trophy,
  MapPin,
  TrendingUp,
  Radio,
  CalendarCheck,
  Shield,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingBottomDock } from './components/FloatingBottomDock';
import { TopBarSlotDetailsModal } from './components/TopBarSlotDetailsModal';
import { GlobalToast } from './components/GlobalToast';
import type { UpcomingSlotItem } from './hooks/useUpcomingFreeSlots';
import { reportUnexpectedError } from './services/errorReporter';

const MainContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeTournamentId,
    setActiveTournamentId,
    tournamentMatches,
    tenant,
    setTenantId,
    setArenaSubTab,
    activeLiveBroadcastBookingId,
    setActiveLiveBroadcastBookingId,
    userProfile,
    setUserProfile,
    focusMode,
    toggleFocusMode,
  } = useApp();
  useNavigationHistory();
  const navigationStart = React.useRef({ tab: activeTab, at: performance.now() });
  if (navigationStart.current.tab !== activeTab) navigationStart.current = { tab: activeTab, at: performance.now() };
  const watchSource = useBroadcastNavigation((state) => state.source);
  const [publishedWatchTournamentId, setPublishedWatchTournamentId] = React.useState<string | null>(null);
  const [unexpectedError, setUnexpectedError] = React.useState(false);
  React.useEffect(() => {
    const showError = (error: unknown, context: string) => {
      setUnexpectedError(true);
      reportUnexpectedError(error, context);
    };
    const onError = (event: ErrorEvent) => showError(event.error || event.message, 'erro não tratado');
    const onRejection = (event: PromiseRejectionEvent) => showError(event.reason, 'falha assíncrona');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  React.useEffect(() => {
    if (watchSource?.kind !== 'published') {
      setPublishedWatchTournamentId(null);
      return;
    }
    return listenToBroadcastTournamentId(watchSource.id, setPublishedWatchTournamentId, () => setPublishedWatchTournamentId(null));
  }, [watchSource?.kind, watchSource?.id]);
  const linkedWatchMatch = tournamentMatches.find((match) =>
    (watchSource?.kind === 'match' && match.id === watchSource.id) || match.linkedBroadcastId === watchSource?.id
  );
  const watchTournamentId = watchSource?.tournamentId || linkedWatchMatch?.tournamentId || publishedWatchTournamentId;
  const resultNotificationTournamentIds = React.useMemo(() => {
    const ids = activeTab === 'tournaments' ? [activeTournamentId, watchTournamentId] : [watchTournamentId];
    return ids.filter((id): id is string => Boolean(id));
  }, [activeTab, activeTournamentId, watchTournamentId]);

  const openResultMatch = (event: import('./lib/firebase').TournamentResultEvent) => {
    useBroadcastNavigation.getState().close();
    setActiveTournamentId(event.tournamentId);
    setActiveTab('tournaments');
    window.setTimeout(() => {
      document.querySelector(`[data-match-id="${event.matchId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  };

  const [floatingSlotModal, setFloatingSlotModal] = React.useState<UpcomingSlotItem | null>(null);

  // Onboarding state: triggers if user has not yet completed initial technical category setup
  const [showOnboarding, setShowOnboarding] = React.useState<boolean>(false);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setShowOnboarding(Boolean(user && !userProfile.level));
    });
    return () => unsub();
  }, [userProfile.level]);

  const handleCompleteOnboarding = (level: typeof userProfile.level) => {
    setUserProfile({ ...userProfile, level });
    setShowOnboarding(false);
  };

  const isArenaWhiteLabel =
    Boolean(tenant.whiteLabelEnabled && tenant.logoUrl && tenant.brandPalette) &&
    activeTab === 'scheduler';

  const arenaPalette = tenant.brandPalette;
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('broadcast');
    if (id && /^[\w-]{1,64}$/.test(id)) useBroadcastNavigation.getState().open({ kind: 'published', id });
  }, []);

  return (
    <div
      className={`shark-site-background min-h-screen flex flex-col text-slate-900 transition-colors ${
        isArenaWhiteLabel ? 'arena-whitelabel-mode' : ''
      } ${focusMode ? 'shark-focus-mode' : ''}`}
      style={
        isArenaWhiteLabel && arenaPalette
          ? ({
              '--arena-primary': arenaPalette.primary,
              '--arena-secondary': arenaPalette.secondary,
              '--arena-accent': arenaPalette.accent,
              '--arena-header-bg': arenaPalette.headerBg,
              '--arena-surface-bg': arenaPalette.surfaceBg,
              '--arena-text': arenaPalette.textOnPrimary,
              backgroundColor: arenaPalette.headerBg,
            } as React.CSSProperties)
          : undefined
      }
    >
      <AquariumBackground />
      <GlobalToast /><ConnectionStatus />
      {unexpectedError && <div role="alert" className="fixed bottom-4 left-1/2 z-[2000] -translate-x-1/2 max-w-lg rounded-xl border border-amber-300/40 bg-slate-950/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl">Ocorreu algo inesperado. O erro foi registrado para suporte. <button type="button" onClick={() => setUnexpectedError(false)} className="ml-3 underline">Fechar</button></div>}
      <TournamentResultNotifications tournamentIds={resultNotificationTournamentIds} onOpenMatch={openResultMatch} />

      {/* Floating Focus Mode Bar when active */}
      {focusMode && (
        <aside
          aria-label="Controle do Modo Foco"
          className="fixed top-3 right-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-400/50 shadow-2xl backdrop-blur-md text-xs text-white"
        >
          <span className="w-2 h-2 rounded-full bg-[#12C7BB] animate-ping" />
          <span className="font-bold text-[11px] text-cyan-200">Modo Foco Ativo</span>
          <button
            type="button"
            onClick={toggleFocusMode}
            className="ml-1 px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
            title="Sair do Modo Foco e restaurar navegação"
          >
            <Minimize2 size={12} />
            <span>Sair</span>
          </button>
        </aside>
      )}

      {/* Primary Navigation and Banners: Hidden in Focus Mode for clean uninterrupted operation */}
      {!focusMode && (
        <>
          <Navbar />
          <PinnedCouponBanner />
          {activeTab === 'home' && <SmartNotificationBanner />}
          {activeTab === 'home' && <FreeSlotsDateTimeFilter homeTop />}
        </>
      )}

      {/* Uninterrupted Live Broadcast Hub (Full on Home, Picture-in-Picture Floating Dock on other tabs) */}
      {!focusMode && !['home', 'tournaments', 'arenas_directory', 'register_dupla'].includes(activeTab) && <PersistentLiveStreamDock />}

      <main className={`site-content relative flex-1 min-w-0 w-full ${focusMode ? 'pt-4 px-2 sm:px-4' : 'pb-6 sm:pb-10'}`}>
        <Suspense fallback={<PageLoading />}>
        {activeTab === 'arena_admin' && <ArenaAdmin />}
        {activeTab === 'home' && <HomeHighlights />}
        {activeTab === 'live' && <LiveDirectory />}
        {activeTab === 'tournaments' && <DoubleEliminationBracket />}
        {activeTab === 'scheduler' && <CourtScheduler />}
        {activeTab === 'ranking_athletes' && <RankingBoard />}
        {activeTab === 'shark_academy' && <SharkAcademyCommunity />}
        {activeTab === 'register_dupla' && <DoublesRegistration />}
        {activeTab === 'arenas_directory' && <ArenasDirectory />}
        {activeTab === 'saas_hub' && <SaaSConversionHub />}
        {activeTab === 'my_bookings' && <MyBookings />}
        <PageReady startedAt={navigationStart.current.at} route={activeTab} />
        </Suspense>
      </main>

      {!focusMode && (
        <footer
          className="relative z-10 w-full mt-auto border-t border-b border-cyan-300/20 bg-[#03172b]/75 backdrop-blur-md text-slate-300 transition-all mb-[var(--floating-dock-offset,0px)]"
          style={
            isArenaWhiteLabel && arenaPalette
              ? {
                  backgroundColor: arenaPalette.headerBg,
                  borderColor: `${arenaPalette.primary}40`,
                }
              : undefined
          }
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
            {/* Top Row: Brand & Sports & Badges */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-cyan-100/10">
              {/* Brand Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3.5">
                <div className="box-border flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-[#062b45]/75 p-1 shadow-md sm:self-center">
                  <SharksetLogo size="custom" customPx={56} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-black text-white text-base tracking-wider">
                      SHARK<span className="text-[#FF6B00]">SET</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest">
                      PLATAFORMA OFICIAL
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300/90 mt-1 max-w-sm">
                    Gestão esportiva inteligente, rankings automatizados, chaveamento de torneios e transmissões ao vivo.
                  </p>
                </div>
              </div>

              {/* Sports Modalities Pills */}
              <div className="flex flex-wrap justify-center items-center gap-2.5">
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/30 bg-gradient-to-br from-[#0b3555]/95 to-[#04182c]/95 px-3 py-1 text-xs font-extrabold text-white shadow-md shadow-black/20 transition-all hover:border-cyan-200/60 hover:brightness-110">
                  <SportBallIcon sport="futevolei" size={30} />
                  Futevôlei
                </span>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/30 bg-gradient-to-br from-[#0b3555]/95 to-[#04182c]/95 px-3 py-1 text-xs font-extrabold text-white shadow-md shadow-black/20 transition-all hover:border-cyan-200/60 hover:brightness-110">
                  <SportBallIcon sport="volei-praia" size={30} />
                  Vôlei de Praia
                </span>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/30 bg-gradient-to-br from-[#0b3555]/95 to-[#04182c]/95 px-3 py-1 text-xs font-extrabold text-white shadow-md shadow-black/20 transition-all hover:border-cyan-200/60 hover:brightness-110">
                  <SportBallIcon sport="beach-tennis" size={30} />
                  Beach Tennis
                </span>
              </div>
            </div>

            {/* Bottom Row: Legal Copyright & Badges */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 text-[11px] text-slate-400 text-center sm:text-left">
              <p>
                &copy; {new Date().getFullYear()} SHARK SET — Todos os direitos reservados. Orgulhosamente desenvolvido para o esporte de areia.
              </p>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Conexão Segura SSL
                </span>
                <span>·</span>
                <span className="text-slate-400">Powered by Google Cloud Firestore</span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Floating Bottom Navigation & Featured Slots Carousel (Visible on Scroll Down) */}
      {!focusMode && !['tournaments', 'arenas_directory', 'register_dupla'].includes(activeTab) && (
        <FloatingBottomDock onSelectSlot={(slot) => setFloatingSlotModal(slot)} />
      )}

      {/* Modal Completo de Detalhes da Arena e Agendamento Instantâneo */}
      <TopBarSlotDetailsModal
        isOpen={Boolean(floatingSlotModal)}
        onClose={() => setFloatingSlotModal(null)}
        arena={floatingSlotModal?.arena || null}
        court={floatingSlotModal?.court || null}
        slot={floatingSlotModal?.slot || null}
        distanceKm={floatingSlotModal?.distanceKm}
        onGoToArena={(arena) => {
          setFloatingSlotModal(null);
          setTenantId(arena.id);
          setArenaSubTab('agendamentos');
          setActiveTab('scheduler');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {activeLiveBroadcastBookingId && (
        <Suspense fallback={<PageLoading />}><LiveBookingBroadcastModal
          bookingId={activeLiveBroadcastBookingId}
          onClose={() => setActiveLiveBroadcastBookingId(null)}
        /></Suspense>
      )}

      <AthleteOnboardingModal
        isOpen={showOnboarding}
        playerName={userProfile.name}
        onComplete={handleCompleteOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      <CommandPalette />
      <TenantSelectorModal />
    </div>
  );
};

function PageReady({ startedAt, route }: { startedAt: number; route: string }) {
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => recordMetric('route-ready-ms', performance.now() - startedAt));
    return () => cancelAnimationFrame(frame);
  }, [startedAt, route]);
  return null;
}

function WatchLayer() {
  const source = useBroadcastNavigation(state => state.source);
  return source ? <Suspense fallback={<PageLoading />}><BroadcastWatchScreen /></Suspense> : null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
      <MainContent />
      <WatchLayer />
    </AppProvider>
    </ErrorBoundary>
  );
}

