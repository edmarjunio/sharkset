import { LiveDirectory } from './components/LiveDirectory';
import { BroadcastWatchScreen } from './components/BroadcastWatchScreen';
import { useBroadcastNavigation } from './store/useBroadcastNavigation';
import { FreeSlotsDateTimeFilter } from './components/FreeSlotsDateTimeFilter';
import React from 'react';
import { AquariumBackground } from './components/AquariumBackground';
import { AppProvider, useApp } from './context/AppContext';
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
import { Maximize2, Minimize2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const {
    activeTab,
    tenant,
    activeLiveBroadcastBookingId,
    setActiveLiveBroadcastBookingId,
    userProfile,
    setUserProfile,
    focusMode,
    toggleFocusMode,
  } = useApp();

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
      className={`shark-site-background min-h-screen flex flex-col text-slate-900 pb-16 md:pb-8 transition-colors ${
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
          className="aquarium-glass border-t border-slate-200 bg-white py-6 mt-12 text-slate-700"
          style={
            isArenaWhiteLabel && arenaPalette
              ? {
                  backgroundColor: arenaPalette.headerBg,
                  borderColor: `${arenaPalette.primary}40`,
                  color: '#FFFFFF',
                }
              : undefined
          }
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            {isArenaWhiteLabel && tenant.logoUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-white/20"
                />
                <div>
                  <span className="font-black text-sm tracking-tight block">{tenant.name}</span>
                  <span className="text-[11px] opacity-80">
                    {tenant.address} · {tenant.city}/{tenant.state}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-black uppercase tracking-widest">
                  DESENVOLVIDO POR SHARKSET
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-3">
                <SharksetLogo size="sm" />
                <span className="font-black text-slate-900 tracking-tight text-sm">
                  SHARK<span className="text-[#FF6B00]">SET</span>
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-semibold text-slate-700">{tenant.name}</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-500">
                  {tenant.city}, {tenant.state}
                </span>
              </div>
            )}

            <div className="flex items-center gap-4 font-bold">
              <span className={isArenaWhiteLabel ? 'text-white/90' : 'text-slate-600'}>
                ⚽ Futevôlei · 🎾 Beach Tennis · 🏐 Vôlei de Praia
              </span>
            </div>
          </div>
        </footer>
      )}

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
    <AppProvider>
      <MainContent />
      <BroadcastWatchScreen />
    </AppProvider>
  );
}
