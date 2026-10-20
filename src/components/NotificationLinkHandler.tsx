import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useBookingSelection } from '../store/useBookingSelection';
import { parseNotificationLink } from '../services/notificationLinks';
import { QuickBookingPaymentModal, type QuickBookingSlotData } from './QuickBookingPaymentModal';

export function NotificationLinkHandler() {
  const { availableTenants, tournaments, setTenantId, setActiveTab, setArenaSubTab, setActiveTournamentId } = useApp();
  const handled = useRef(false);
  const [slot, setSlot] = useState<QuickBookingSlotData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!parseNotificationLink(location.search)) return;
    const timer = window.setTimeout(() => {
      if (!handled.current) setError('Não foi possível abrir este aviso. Consulte a arena ou tente novamente.');
    }, 15000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (handled.current) return;
    const link = parseNotificationLink(location.search);
    if (!link) return;
    const arena = availableTenants.find(a => a.id === link.arenaId);
    if (!arena) return; // Public catalog may still be loading.
    if (link.tournamentId) {
      const tournament = tournaments.find(t => t.id === link.tournamentId && t.tenantId === arena.id);
      if (!tournament) return; // Wait for the server-owned public tournament catalog.
      handled.current = true; setTenantId(arena.id); setActiveTab('scheduler');
      setError('');
      setActiveTournamentId(tournament.id); setArenaSubTab('campeonatos');
    } else {
      handled.current = true; setTenantId(arena.id); setActiveTab('scheduler');
      setError('');
      useBookingSelection.getState().setDate(link.date!);
      setArenaSubTab('agendamentos');
      const court = arena.courts.find(c => c.id === link.courtId);
      if (!court) { setError('Esta quadra não está mais disponível. Consulte a agenda da arena.'); return; }
      setSlot({ arena, courtId: court.id, courtName: court.name, date: link.date!, time: link.time!, price: 0 });
    }
  }, [availableTenants, tournaments, setTenantId, setActiveTab, setArenaSubTab, setActiveTournamentId]);
  return <><QuickBookingPaymentModal slotData={slot} onClose={() => setSlot(null)} />{error && <aside role="alert" className="fixed bottom-4 left-4 z-[100] rounded-xl bg-slate-950 p-4 text-white">{error}<button className="ml-3" onClick={() => setError('')}>Fechar</button></aside>}</>;
}
