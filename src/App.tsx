import { LiveDirectory } from './components/LiveDirectory';
import { BroadcastWatchScreen } from './components/BroadcastWatchScreen';
import { useBroadcastNavigation } from './store/useBroadcastNavigation';
import { FreeSlotsDateTimeFilter } from './components/FreeSlotsDateTimeFilter';
import React from 'react';
import { AquariumBackground } from './components/AquariumBackground';
import { AppProvider, useApp } from './context/AppContext';
import { ArenaAdmin } from './components/ArenaAdmin';
import { Navbar } from './components/Navbar';
import { SmartNotificationBanner } from './components/SmartNotificationBanner';
import { PersistentLiveStreamDock } from './components/PersistentLiveStreamDock';
import { HomeHighlights } from './components/HomeHighlights';
import { ArenasDirectory } from './components/ArenasDirectory';
import { CourtScheduler } from './components/CourtScheduler';
import { DoubleEliminationBracket } from './components/DoubleEliminationBracket';
import { DoublesRegistration } from './components/DoublesRegistration';
import { RankingBoard } from './components/RankingBoard';
import { MyBookings } from './components/MyBookings';
import { SaaSConversionHub } from './components/SaaSConversionHub';
import { CommandPalette } from './components/CommandPalette';
import { TenantSelectorModal } from './components/TenantSelectorModal';
import { SharksetLogo } from './components/SharksetLogo';
import { SharkAcademyCommunity } from './components/SharkAcademyCommunity';
import { LiveBookingBroadcastModal } from './components/LiveBookingBroadcastModal';
import { AthleteOnboardingModal } from './components/AthleteOnboardingModal';
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
import type { UpcomingSlotItem } from './hooks/useUpcomingFreeSlots';

const MainContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
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

  const [floatingSlotModal, setFloatingSlotModal] = React.useState<UpcomingSlotItem | null>(null);

  // Onboarding state: triggers if user has not yet completed initial technical category setup
  const [showOnboarding, setShowOnboarding] = React.useState<boolean>(() => {
    try {
      return !localStorage.getItem('sharkset_onboarding_completed');
    } catch {
      return false;
    }
  });

  const handleCompleteOnboarding = (level: typeof userProfile.level) => {
    setUserProfile({ ...userProfile, level });
    try {
      localStorage.setItem('sharkset_onboarding_completed', 'true');
    } catch {
      // ignore
    }
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
      {!isArenaWhiteLabel && <AquariumBackground />}

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
          <SmartNotificationBanner />
          <FreeSlotsDateTimeFilter homeTop />
        </>
      )}

      {/* Uninterrupted Live Broadcast Hub (Full on Home, Picture-in-Picture Floating Dock on other tabs) */}
      {!focusMode && activeTab !== 'home' && <PersistentLiveStreamDock />}

      <main className={`site-content flex-1 min-w-0 ${focusMode ? 'pt-4 px-2 sm:px-4' : ''}`}>
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
      </main>

      {!focusMode && (
        <footer
          className="w-full mt-auto border-t border-cyan-500/20 bg-[#020B17]/95 backdrop-blur-xl text-slate-300 transition-colors"
          style={
            isArenaWhiteLabel && arenaPalette
              ? {
                  backgroundColor: arenaPalette.headerBg,
                  borderColor: `${arenaPalette.primary}40`,
                }
              : undefined
          }
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            {/* Top Row: Brand & Sports & Badges */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/10">
              {/* Brand Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3.5">
                <div className="p-1.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-md">
                  <SharksetLogo size="sm" />
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-black text-white text-base tracking-wider">
                      SHARK<span className="text-[#FF6B00]">SET</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest">
                      PLATAFORMA OFICIAL
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Gestão esportiva inteligente, rankings automatizados, chaveamento de torneios e transmissões ao vivo.
                  </p>
                </div>
              </div>

              {/* Sports Modalities Pills */}
              <div className="flex flex-wrap justify-center items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-cyan-200 border border-cyan-500/20 text-xs font-bold shadow-xs">
                  ⚽ Futevôlei
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-cyan-200 border border-cyan-500/20 text-xs font-bold shadow-xs">
                  🎾 Beach Tennis
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-cyan-200 border border-cyan-500/20 text-xs font-bold shadow-xs">
                  🏐 Vôlei de Praia
                </span>
              </div>
            </div>

            {/* Bottom Row: Legal Copyright & Badges */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-[11px] text-slate-400 text-center sm:text-left">
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
      {!focusMode && (
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
        <LiveBookingBroadcastModal
          bookingId={activeLiveBroadcastBookingId}
          onClose={() => setActiveLiveBroadcastBookingId(null)}
        />
      )}

      <AthleteOnboardingModal
        isOpen={showOnboarding}
        playerName={userProfile.name}
        onComplete={handleCompleteOnboarding}
      />

      <CommandPalette />
      <TenantSelectorModal />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
      <MainContent />
      <BroadcastWatchScreen />
    </AppProvider>
    </ErrorBoundary>
  );
}

