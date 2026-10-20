import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useSharkStore } from '../store/useSharkStore';
import { generateWeeklySlots } from '../services/courtSlotPricing';
import type { Court, TenantConfig, TimeSlot } from '../types';
import {
  buildBooking15MinReminderNotification,
  buildBracketResultPublishedNotification,
  buildMatch10PointsRemainingNotification,
  buildTournamentStartedNotification,
  buildTuitionDueTodayNotification,
  buildVacantSlot2hNotification,
  buildWaitlistFreedPushNotification,
  findBookingsStartingSoon,
  findStudentsWithTuitionDueToday,
  findVacantSlotsInNext2Hours,
  timeStrToMinutes,
} from '../services/smartAlertEngine';
import {
  Bell,
  BellRing,
  Clock,
  Flame,
  MessageSquare,
  Sparkles,
  Trophy,
  Users,
  X,
  CheckCheck,
  Cloud,
  Swords,
} from 'lucide-react';
import { signInWithGooglePopup, signOutFirebase } from '../lib/firebase';

interface NearbyAvailableSlotItem {
  arena: TenantConfig;
  court: Court;
  slot: TimeSlot;
  minutesUntilStart: number;
  isWithinNext2h: boolean;
}

export const SmartNotificationBanner: React.FC = () => {
  const {
    tenant,
    setTenantId,
    availableTenants,
    slots,
    bookings,
    waitlist,
    tournaments,
    activeTournamentId,
    setActiveTournamentId,
    tournamentMatches,
    classStudents,
    setActiveTab,
    setArenaSubTab,
    userProfile,
  } = useApp();

  const activeTournament = useMemo(
    () => tournaments.find((t) => t.id === activeTournamentId) || tournaments[0],
    [tournaments, activeTournamentId]
  );

  const {
    smartNotifications,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    pushPermission,
    enablePushNotifications,
    pushSmartNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    dismissSmartNotification,
    referenceClockTime,
    firebaseUserEmail,
  } = useSharkStore();

  const [selectedArenaFilter] = useState<string>('all');
  const [rotatingIndex, setRotatingIndex] = useState<number>(0);
  const [isPaused] = useState<boolean>(false);

  const vacantSlotsNext2h = React.useMemo(
    () => findVacantSlotsInNext2Hours(slots, tenant.courts, referenceClockTime),
    [slots, tenant.courts, referenceClockTime]
  );

  // Gather ALL available slots across ALL nearby arenas in the upcoming hours (and fallback to all available slots if none in next 2h)
  const nearbyArenaSlots = React.useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const nowMinutes = timeStrToMinutes(referenceClockTime);
    const sortedArenas = [...availableTenants].sort((a, b) => a.distanceKm - b.distanceKm);

    const nextHoursItems: NearbyAvailableSlotItem[] = [];
    const fallbackItems: NearbyAvailableSlotItem[] = [];

    for (const arena of sortedArenas) {
      const rawArenaSlots =
        arena.id === tenant.id ? slots : generateWeeklySlots(arena.courts);

      const courtMap = new Map<string, Court>(arena.courts.map((c) => [c.id, c]));

      for (const s of rawArenaSlots) {
        if (s.slotType === 'class') continue;
        const isBooked = bookings.some(
          (b) =>
            b.status === 'confirmed' &&
            b.courtId === s.courtId &&
            b.date === s.date &&
            b.startTime === s.startTime
        );
        if (!s.isAvailable || isBooked) continue;
        const court = courtMap.get(s.courtId);
        if (!court) continue;

        const slotMin = timeStrToMinutes(s.startTime);
        const diff = slotMin - nowMinutes;

        if (s.date === todayIso && diff > 0 && diff <= 240) {
          nextHoursItems.push({
            arena,
            court,
            slot: s,
            minutesUntilStart: diff,
            isWithinNext2h: diff <= 120,
          });
        } else if (s.date === todayIso && diff > 240) {
          fallbackItems.push({
            arena,
            court,
            slot: s,
            minutesUntilStart: diff,
            isWithinNext2h: false,
          });
        } else if (s.date >= todayIso) {
          fallbackItems.push({
            arena,
            court,
            slot: s,
            minutesUntilStart: diff > 0 ? diff : 1440 + diff,
            isWithinNext2h: false,
          });
        }
      }
    }

    const sourceList = nextHoursItems.length > 0 ? nextHoursItems : fallbackItems;
    sourceList.sort((a, b) => a.minutesUntilStart - b.minutesUntilStart || a.arena.distanceKm - b.arena.distanceKm);
    return {
      allItems: sourceList,
      hasImmediateNextHours: nextHoursItems.length > 0,
      sortedArenas,
    };
  }, [availableTenants, tenant.id, slots, bookings, referenceClockTime]);

  const filteredRotatingItems = React.useMemo(() => {
    if (selectedArenaFilter === 'all') return nearbyArenaSlots.allItems;
    return nearbyArenaSlots.allItems.filter((item) => item.arena.id === selectedArenaFilter);
  }, [nearbyArenaSlots.allItems, selectedArenaFilter]);

  const carouselRef = useRef<HTMLDivElement>(null);

  // Group available slots by arena for clean horizontal carousel without expanding downwards
  const slotsGroupedByArena = useMemo(() => {
    const map = new Map<
      string,
      {
        arena: TenantConfig;
        slots: typeof nearbyArenaSlots.allItems;
      }
    >();

    for (const item of filteredRotatingItems) {
      if (!map.has(item.arena.id)) {
        map.set(item.arena.id, {
          arena: item.arena,
          slots: [],
        });
      }
      map.get(item.arena.id)!.slots.push(item);
    }

    return Array.from(map.values());
  }, [filteredRotatingItems]);

  useEffect(() => {
    setRotatingIndex(0);
  }, [selectedArenaFilter, referenceClockTime]);

  useEffect(() => {
    if (isPaused || filteredRotatingItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % filteredRotatingItems.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [isPaused, filteredRotatingItems.length]);

  useEffect(() => {
    if (isPaused || slotsGroupedByArena.length <= 1) return;
    const interval = window.setInterval(() => {
      if (!carouselRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        carouselRef.current.scrollBy({ left: 280, behavior: 'smooth' });
      }
    }, 4200);
    return () => window.clearInterval(interval);
  }, [isPaused, slotsGroupedByArena.length]);

  const bookingsStartingIn15m = React.useMemo(
    () => findBookingsStartingSoon(bookings, referenceClockTime),
    [bookings, referenceClockTime]
  );

  const studentsDueToday = React.useMemo(
    () => findStudentsWithTuitionDueToday(classStudents),
    [classStudents]
  );

  const primaryVacant = vacantSlotsNext2h[0];

  // Unread tournament / bracket alerts that should appear as an automatic top banner
  const activeTournamentBannerAlerts = useMemo(
    () =>
      smartNotifications.filter(
        (n) =>
          !n.read &&
          (n.type === 'tournament_started' || n.type === 'bracket_result_published')
      ),
    [smartNotifications]
  );

  const handleOpenNotificationTarget = (item: (typeof smartNotifications)[number]) => {
    markNotificationAsRead(item.id);
    if (item.tournamentId) {
      setActiveTournamentId(item.tournamentId);
    }
    if (item.actionTargetTab) {
      if (item.actionTargetTab === 'scheduler') setArenaSubTab('agenda');
      setActiveTab(item.actionTargetTab);
    } else if (item.tournamentId) {
      setActiveTab('tournaments');
    }
    setNotificationDrawerOpen(false);
  };

  const handleTriggerVacant2hPush = () => {
    if (!primaryVacant) return;
    const notif = buildVacantSlot2hNotification(primaryVacant, tenant.name);
    pushSmartNotification(notif);
  };

  const handleTriggerWaitlistPush = () => {
    const candidate = waitlist[0] || {
      id: 'wl-demo',
      tenantId: tenant.id,
      slotId: slots[0]?.id || 'slot-1',
      courtId: tenant.courts[0]?.id || 'c1',
      courtName: tenant.courts[0]?.name || 'Quadra 1 - Central SHARK SET',
      date: new Date().toISOString().split('T')[0],
      startTime: '19:00',
      endTime: '20:00',
      sport: 'futevolei',
      customerName: userProfile.name,
      customerPhone: userProfile.phone,
      position: 1,
      status: 'notified',
      createdAt: '17:30',
    };
    const notif = buildWaitlistFreedPushNotification(candidate);
    pushSmartNotification(notif);
  };

  const handleTrigger10PtsMatchPush = () => {
    const activeMatch =
      tournamentMatches.find((m) => m.status !== 'completed' && m.team1 && m.team2) ||
      tournamentMatches[0];
    if (!activeMatch) return;

    const nextMatch = tournamentMatches.find(
      (m) => m.id === activeMatch.nextMatchWinnerId || m.matchNumber === activeMatch.matchNumber + 1
    );

    const notif = buildMatch10PointsRemainingNotification(
      activeMatch,
      nextMatch,
      10,
      8,
      8,
      tenant.name
    );
    pushSmartNotification(notif);
  };

  const handleTrigger15MinBookingPush = () => {
    const targetBooking = bookingsStartingIn15m[0] ||
      bookings.find((b) => b.status === 'confirmed') || {
        id: 'bk-15m',
        tenantId: tenant.id,
        slotId: 'slot-18',
        courtId: tenant.courts[0]?.id || 'c1',
        courtName: tenant.courts[0]?.name || 'Quadra 1 - Central SHARK SET',
        date: new Date().toISOString().split('T')[0],
        startTime: '18:00',
        endTime: '19:00',
        sport: 'futevolei',
        customerName: userProfile.name,
        customerPhone: userProfile.phone,
        price: 90,
        status: 'confirmed',
        whatsappSent: true,
      };
    const notif = buildBooking15MinReminderNotification(targetBooking, tenant.name);
    pushSmartNotification(notif);
  };

  const handleTriggerTuitionDuePush = () => {
    const targetStudent =
      studentsDueToday[0] ||
      classStudents[0] || {
        id: 'stu-demo',
        tenantId: tenant.id,
        courtId: tenant.courts[0]?.id || 'c1',
        courtName: tenant.courts[0]?.name || 'Quadra 1 - Central SHARK SET',
        classId: 'cls-1',
        classTitle: 'CT SHARK SET Futevôlei Manhã',
        classTime: '07:00 às 08:00',
        coachName: 'Prof. Tavinho',
        sport: 'futevolei',
        studentName: userProfile.name,
        studentPhone: userProfile.phone,
        billingType: 'mensal',
        amount: 220,
        paymentStatus: 'pendente',
        enrolledAt: new Date().toISOString().split('T')[0],
      };
    const notif = buildTuitionDueTodayNotification(targetStudent, tenant.name);
    pushSmartNotification(notif);
  };

  const handleTriggerTournamentStartedPush = () => {
    const targetTournament = activeTournament || tournaments[0];
    const notif = buildTournamentStartedNotification({
      tournamentId: targetTournament?.id || 'trn-live',
      tournamentName: targetTournament?.name || 'Copa Shark Set Futevôlei',
      arenaName: tenant.name,
      pairsCount: 8,
      isUserEnrolled: true,
      userPairLabel: userProfile?.name || 'Atleta Inscrito',
      recipientPhone: userProfile?.phone,
    });
    pushSmartNotification(notif);
  };

  const handleTriggerBracketResultPush = () => {
    const targetTournament = activeTournament || tournaments[0];
    const completedMatch =
      tournamentMatches.find((m) => m.status === 'completed' && m.winnerId) ||
      tournamentMatches[0] || {
        id: `m-${Date.now()}`,
        tournamentId: targetTournament?.id || 'trn-live',
        matchNumber: 1,
        round: 1,
        stage: 'winners' as const,
        stageName: 'Chave dos Vencedores · Rodada 1',
        status: 'completed' as const,
        score1: 18,
        score2: 15,
      };
    const formatPair = (p?: { player1: string; player2: string }) =>
      p ? `${p.player1} & ${p.player2}` : undefined;
    const winnerName =
      completedMatch?.winnerId && completedMatch?.winnerId === completedMatch?.team2?.id
        ? formatPair(completedMatch?.team2)
        : formatPair(completedMatch?.team1);
    const loserName =
      completedMatch?.winnerId && completedMatch?.winnerId === completedMatch?.team2?.id
        ? formatPair(completedMatch?.team1)
        : formatPair(completedMatch?.team2);

    const notif = buildBracketResultPublishedNotification({
      tournamentId: targetTournament?.id || 'trn-live',
      tournamentName: targetTournament?.name || 'Copa Shark Set Futevôlei',
      match: completedMatch,
      winnerName: winnerName || 'Dupla Vencedora',
      loserName: loserName || 'Dupla Adversária',
      scoreSummary: `${completedMatch?.score1 ?? 18}x${completedMatch?.score2 ?? 15}`,
      isUserEnvolved: true,
      recipientPhone: userProfile?.phone,
    });
    pushSmartNotification(notif);
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'tournament_started':
        return 'bg-amber-400 text-slate-950';
      case 'bracket_result_published':
        return 'bg-emerald-400 text-slate-950';
      case 'vacant_2h':
        return 'bg-[#0987CE] text-white';
      case 'waitlist_freed':
        return 'bg-[#12C7BB] text-slate-950';
      case 'match_10pts_left':
        return 'bg-rose-600 text-white';
      case 'tuition_due_today':
        return 'bg-[#145A9B] text-white';
      case 'booking_15min':
      default:
        return 'bg-[#5BC3FA] text-slate-950';
    }
  };

  if (!notificationDrawerOpen && activeTournamentBannerAlerts.length === 0) return null;

  return (
    <section
      className="aquarium-glass bg-[#041529] border-b border-[#145A9B]/40 text-white relative z-30"
      data-testid="smart-notification-banner-section"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
        {/* AUTOMATIC BANNER FOR TOURNAMENT START & BRACKET RESULTS */}
        {activeTournamentBannerAlerts.length > 0 && (
          <div className="space-y-2" data-testid="tournament-live-alert-banners">
            {activeTournamentBannerAlerts.slice(0, 2).map((alertItem) => {
              const isStart = alertItem.type === 'tournament_started';
              return (
                <div
                  key={alertItem.id}
                  role="status"
                  aria-live="polite"
                  data-testid={`alert-banner-${alertItem.type}`}
                  className={`rounded-2xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-lg ${
                    isStart
                      ? 'bg-gradient-to-r from-amber-500/20 via-[#071D3D] to-[#041529] border-amber-400/50'
                      : 'bg-gradient-to-r from-emerald-500/20 via-[#071D3D] to-[#041529] border-emerald-400/50'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isStart
                          ? 'bg-amber-400/20 border border-amber-400/40 text-amber-300'
                          : 'bg-emerald-400/20 border border-emerald-400/40 text-emerald-300'
                      }`}
                    >
                      {isStart ? (
                        <Trophy className="w-4 h-4 animate-bounce" />
                      ) : (
                        <Swords className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getBadgeStyle(
                            alertItem.type
                          )}`}
                        >
                          {alertItem.badgeLabel}
                        </span>
                        <span className="text-xs font-extrabold text-white truncate">
                          {alertItem.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-200 mt-0.5 line-clamp-2">
                        {alertItem.body}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleOpenNotificationTarget(alertItem)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 ${
                        isStart
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                      }`}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      {alertItem.actionLabel || 'Ver Chaveamento'}
                    </button>
                    <button
                      type="button"
                      onClick={() => markNotificationAsRead(alertItem.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                      title="Dispensar alerta"
                      aria-label="Dispensar alerta"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* EXPANDABLE SMART PUSH NOTIFICATION DRAWER */}
        {notificationDrawerOpen && (
          <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-4 space-y-4 animate-in fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#145A9B]/60">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#0987CE] text-white font-black text-[10px] uppercase">
                    SHARK SET SMART PUSH ENGINE
                  </span>
                  <span className="text-xs font-bold text-white">
                    Notificações em Tempo Real (Torneios · Chaveamento · Quadra Vaga · Fila · Aula)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Alertas automáticos de início de torneio inscrito, novos resultados publicados na tabela e lembretes de quadra.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => enablePushNotifications()}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    pushPermission === 'granted'
                      ? 'bg-[#12C7BB]/20 text-[#12C7BB] border border-[#12C7BB]/40'
                      : 'bg-[#0987CE] hover:bg-[#0772b0] text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  {pushPermission === 'granted'
                    ? 'Push Nativo Ativo ✓'
                    : 'Ativar Push Notifications'}
                </button>

                {firebaseUserEmail ? (
                  <button
                    onClick={() => signOutFirebase()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#030B17] hover:bg-[#0B254E] text-[#12C7BB] border border-[#145A9B] cursor-pointer flex items-center gap-1.5"
                    title="Sincronizado com Cloud Firestore"
                  >
                    <Cloud className="w-3.5 h-3.5 text-[#12C7BB]" />
                    Firestore: {firebaseUserEmail.split('@')[0]} (Sair)
                  </button>
                ) : (
                  <button
                    onClick={() => signInWithGooglePopup().catch(() => {})}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#030B17] hover:bg-[#0B254E] text-slate-200 border border-[#145A9B] cursor-pointer flex items-center gap-1.5"
                    title="Autenticar para gravar também no Cloud Firestore"
                  >
                    <Cloud className="w-3.5 h-3.5 text-[#0987CE]" />
                    Conectar Cloud Firestore
                  </button>
                )}

                <button
                  onClick={markAllNotificationsAsRead}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#030B17] hover:bg-[#0B254E] text-slate-300 border border-[#145A9B] cursor-pointer flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar Lidas
                </button>

                <button
                  onClick={() => setNotificationDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
              <button
                onClick={handleTriggerTournamentStartedPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-amber-400/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-amber-400 uppercase mb-1">
                  <span>Torneio Iniciado</span>
                  <Trophy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Início do Sorteio</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Alerta inscritos
                </span>
              </button>

              <button
                onClick={handleTriggerBracketResultPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-emerald-400/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-emerald-400 uppercase mb-1">
                  <span>Novo Resultado</span>
                  <Swords className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Placar na Chave</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Atualização de jogo
                </span>
              </button>

              <button
                onClick={handleTriggerVacant2hPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#0987CE]/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-[#0987CE] uppercase mb-1">
                  <span>Horário Vago (2h)</span>
                  <Flame className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Alerta de Agenda</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Preenche horário vago
                </span>
              </button>

              <button
                onClick={handleTriggerWaitlistPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#12C7BB]/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-[#12C7BB] uppercase mb-1">
                  <span>Push Fila Espera</span>
                  <Users className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Avisar Vaga Livre</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Notifica 1º da espera
                </span>
              </button>

              <button
                onClick={handleTrigger10PtsMatchPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-rose-500/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-rose-400 uppercase mb-1">
                  <span>Jogo Ao Vivo (10 Pts)</span>
                  <BellRing className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Chamar Próxima Dupla</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Jogo anterior no fim
                </span>
              </button>

              <button
                onClick={handleTrigger15MinBookingPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#5BC3FA]/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-[#5BC3FA] uppercase mb-1">
                  <span>Partida em 15 Min</span>
                  <Clock className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Lembrete 15m Antes</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Aviso antes da reserva
                </span>
              </button>

              <button
                onClick={handleTriggerTuitionDuePush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-[#0987CE] uppercase mb-1">
                  <span>Vencimento Aula</span>
                  <Bell className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Mensalidade Hoje</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Notifica no vencimento
                </span>
              </button>
            </div>

            {/* Notification Feed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {smartNotifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                    item.read
                      ? 'bg-[#030B17]/60 border-[#145A9B]/40 text-slate-300'
                      : 'bg-[#030B17] border-[#0987CE] text-white shadow-xs'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${getBadgeStyle(
                          item.type
                        )}`}
                      >
                        {item.badgeLabel}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <span>{item.createdAt}</span>
                        <button
                          onClick={() => dismissSmartNotification(item.id)}
                          className="text-slate-500 hover:text-white cursor-pointer"
                          title="Remover notificação"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <h4 className="text-xs font-extrabold text-white">{item.title}</h4>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{item.body}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#145A9B]/40">
                    {(item.actionTargetTab || item.tournamentId) && (
                      <button
                        onClick={() => handleOpenNotificationTarget(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[11px] cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        {item.actionLabel || 'Abrir Agora'}
                      </button>
                    )}

                    {item.whatsappUrl && (
                      <a
                        href={item.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[#12C7BB]/20 hover:bg-[#12C7BB]/30 text-[#12C7BB] border border-[#12C7BB]/30 font-bold text-[11px] flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Enviar Push WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

