import React from 'react';
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

const MainContent: React.FC = () => {
  const { activeTab, tenant } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-[#030B17] text-[#F7FAFD] pb-16 md:pb-8">
      <Navbar />

      {/* Top Dashboard Visual Notification / Badge for Vacant Court in Next 2h + Smart Push Center (D-2 Tuition) */}
      <SmartNotificationBanner />

      {/* Uninterrupted Live Broadcast Hub (Full on Home, Picture-in-Picture Floating Dock on other tabs) */}
      <PersistentLiveStreamDock />

      <main className="flex-1">
        {activeTab === 'home' && <HomeHighlights />}
        {activeTab === 'tournaments' && <DoubleEliminationBracket />}
        {activeTab === 'scheduler' && <CourtScheduler />}
        {activeTab === 'ranking_athletes' && <RankingBoard />}
        {activeTab === 'shark_academy' && <SharkAcademyCommunity />}
        {activeTab === 'register_dupla' && <DoublesRegistration />}
        {activeTab === 'arenas_directory' && <ArenasDirectory />}
        {activeTab === 'saas_hub' && <SaaSConversionHub />}
        {activeTab === 'my_bookings' && <MyBookings />}
      </main>

      <footer className="border-t border-[#145A9B]/60 bg-[#071D3D] py-6 mt-12 text-[#F7FAFD]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <SharksetLogo size="xs" />
            <span className="font-black text-white tracking-tight">SHARK<span className="text-[#0987CE]">SET</span></span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="font-semibold text-slate-200">{tenant.name}</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-slate-400">
              {tenant.city}, {tenant.state}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span className="text-[#12C7BB] font-bold">⚽ Futevôlei · 🎾 Beach Tennis · 🏐 Vôlei de Praia</span>
          </div>
        </div>
      </footer>

      <CommandPalette />
      <TenantSelectorModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
