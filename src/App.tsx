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
import { MyBookings } from './components/MyBookings';
import { SaaSConversionHub } from './components/SaaSConversionHub';
import { CommandPalette } from './components/CommandPalette';
import { TenantSelectorModal } from './components/TenantSelectorModal';

const MainContent: React.FC = () => {
  const { activeTab, tenant } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/80 text-slate-900 pb-16 md:pb-8">
      <Navbar />

      {/* Top Dashboard Visual Notification / Badge for Vacant Court in Next 2h + Smart Push Center (D-2 Tuition) */}
      <SmartNotificationBanner />

      {/* Uninterrupted Live Broadcast Hub (Full on Home, Picture-in-Picture Floating Dock on other tabs) */}
      <PersistentLiveStreamDock />

      <main className="flex-1">
        {activeTab === 'home' && <HomeHighlights />}
        {activeTab === 'tournaments' && <DoubleEliminationBracket />}
        {activeTab === 'scheduler' && <CourtScheduler />}
        {activeTab === 'register_dupla' && <DoublesRegistration />}
        {activeTab === 'arenas_directory' && <ArenasDirectory />}
        {activeTab === 'saas_hub' && <SaaSConversionHub />}
        {activeTab === 'my_bookings' && <MyBookings />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 tracking-tight">SHARK SET</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-700">{tenant.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              {tenant.city}, {tenant.state}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span>⚽ Futevôlei · 🎾 Beach Tennis · 🏐 Vôlei de Praia</span>
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
