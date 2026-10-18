import React from 'react';
import { useApp } from '../context/AppContext';
import { useSharkStore } from '../store/useSharkStore';
import {
  buildBooking15MinReminderNotification,
  buildMatch10PointsRemainingNotification,
  buildTuitionDueTodayNotification,
  buildVacantSlot2hNotification,
  buildWaitlistFreedPushNotification,
  findBookingsStartingSoon,
  findStudentsWithTuitionDueToday,
  findVacantSlotsInNext2Hours,
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
  Zap,
  CheckCheck,
  Cloud,
} from 'lucide-react';
import { signInWithGooglePopup, signOutFirebase } from '../lib/firebase';

export const SmartNotificationBanner: React.FC = () => {
  const {
    tenant,
    slots,
    bookings,
    waitlist,
    tournamentMatches,
    classStudents,
    setActiveTab,
    setArenaSubTab,
    userProfile,
  } = useApp();

  const {
    smartNotifications,
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    pushPermission,
    enablePushNotifications,
    pushSmartNotification,
    markAllNotificationsAsRead,
    dismissSmartNotification,
    referenceClockTime,
    setReferenceClockTime,
    firebaseUserEmail,
  } = useSharkStore();

  const vacantSlotsNext2h = React.useMemo(
    () => findVacantSlotsInNext2Hours(slots, tenant.courts, referenceClockTime),
    [slots, tenant.courts, referenceClockTime]
  );

  const bookingsStartingIn15m = React.useMemo(
    () => findBookingsStartingSoon(bookings, referenceClockTime),
    [bookings, referenceClockTime]
  );

  const studentsDueToday = React.useMemo(
    () => findStudentsWithTuitionDueToday(classStudents),
    [classStudents]
  );

  const unreadCount = smartNotifications.filter((n) => !n.read).length;
  const primaryVacant = vacantSlotsNext2h[0];

  const handleQuickFillVacantSlot = () => {
    setArenaSubTab('agenda');
    setActiveTab('scheduler');
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

  const getBadgeStyle = (type: string) => {
    switch (type) {
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

  return (
    <section className="bg-[#030B17] border-b border-[#145A9B]/60 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 space-y-2.5">
        {/* TOP VISUAL BADGE & CALLOUT: Vacant Court Slot in the Next 2 Hours */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-gradient-to-r from-[#071D3D] via-[#0B254E]/80 to-[#030B17] border border-[#145A9B] rounded-xl px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0987CE] text-white font-black uppercase tracking-tight text-[11px] shadow-xs">
              <Flame className="w-3.5 h-3.5" />
              {vacantSlotsNext2h.length > 0
                ? `${vacantSlotsNext2h.length} HORÁRIO(S) VAGO(S) NAS PRÓXIMAS 2H`
                : 'AGENDA NAS PRÓXIMAS 2H'}
            </span>

            {primaryVacant ? (
              <div className="flex flex-wrap items-center gap-1.5 text-slate-200">
                <span className="font-extrabold text-white">
                  {primaryVacant.court.name.split(' - ')[0]}
                </span>
                <span className="text-[#5BC3FA] font-mono font-bold">
                  às {primaryVacant.slot.startTime} (em {primaryVacant.minutesUntilStart} min)
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-[#12C7BB] font-mono font-bold">
                  R$ {primaryVacant.slot.price.toFixed(2)}
                </span>
                <span className="hidden sm:inline text-slate-300">
                  — Preencha a agenda agora com 1 clique!
                </span>
              </div>
            ) : (
              <span className="text-slate-300 font-medium">
                Todas as quadras das próximas 2h estão ocupadas. Use o relógio de referência ao lado para inspecionar outros horários.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-[#030B17] border border-[#145A9B] rounded-lg px-2 py-1 text-[11px]">
              <Clock className="w-3 h-3 text-[#0987CE]" />
              <span className="text-slate-400">Agora:</span>
              <select
                value={referenceClockTime}
                onChange={(e) => setReferenceClockTime(e.target.value)}
                className="bg-transparent text-white font-mono font-bold focus:outline-none cursor-pointer"
                title="Horário de referência para radar de 2h e alerta de 15 min"
              >
                <option value="16:45" className="bg-[#030B17]">16:45</option>
                <option value="17:45" className="bg-[#030B17]">17:45</option>
                <option value="18:45" className="bg-[#030B17]">18:45</option>
                <option value="19:45" className="bg-[#030B17]">19:45</option>
              </select>
            </div>

            {primaryVacant && (
              <button
                onClick={handleQuickFillVacantSlot}
                className="px-3 py-1.5 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Zap className="w-3.5 h-3.5" />
                Preencher Horário ({primaryVacant.slot.startTime})
              </button>
            )}

            <button
              onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                notificationDrawerOpen
                  ? 'bg-[#0987CE] text-white border-[#0987CE]'
                  : 'bg-[#030B17] hover:bg-[#0B254E] text-white border-[#145A9B]'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 text-[#12C7BB]" />
              Central Push ({unreadCount})
            </button>
          </div>
        </div>

        {/* EXPANDABLE SMART PUSH NOTIFICATION DRAWER */}
        {notificationDrawerOpen && (
          <div className="bg-[#071D3D] border border-[#145A9B] rounded-2xl p-4 space-y-4 animate-in fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#145A9B]/60">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#0987CE] text-white font-black text-[10px] uppercase">
                    SHARK SET SMART PUSH ENGINE
                  </span>
                  <span className="text-xs font-bold text-white">
                    Notificações em Tempo Real (Quadra Vaga 2h · Fila de Espera · Jogo Faltando 10 Pts · Partida em 15 Min)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Disparo integrado via Push Notification do navegador, Cloud Firestore e WhatsApp 1-clique.
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <button
                onClick={handleTriggerVacant2hPush}
                className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#0987CE]/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[10px] font-black text-[#0987CE] uppercase mb-1">
                  <span>1. Horário Vago (2h)</span>
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
                  <span>2. Push Fila Espera</span>
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
                  <span>3. Jogo Ao Vivo (10 Pts)</span>
                  <Trophy className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
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
                  <span>4. Partida em 15 Min</span>
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
                  <span>5. Vencimento Aula</span>
                  <Bell className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-xs font-bold text-white">Mensalidade Vence Hoje</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Notifica aluno no vencimento
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
                    {item.actionTargetTab && (
                      <button
                        onClick={() => {
                          if (item.actionTargetTab === 'scheduler') setArenaSubTab('agenda');
                          setActiveTab(item.actionTargetTab!);
                          setNotificationDrawerOpen(false);
                        }}
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
