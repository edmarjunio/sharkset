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
    <section className="aquarium-glass bg-[#041529] border-b border-[#145A9B]/40 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-2.5">
        {/* TOP VISUAL BANNER: Vacant Court Slot in the Next 2 Hours */}
        <div className="vacancy-promo flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-5 sm:p-6 rounded-3xl border border-cyan-300/60">
          <div className="flex flex-col items-start gap-3 text-sm sm:text-base">
            <span className="inline-flex items-center gap-2 font-black uppercase tracking-wide text-amber-300 text-base sm:text-xl">
              <Zap className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" />
              {vacantSlotsNext2h.length > 0
                ? `${vacantSlotsNext2h.length} HORÁRIOS LIVRES · PRÓXIMAS 2H`
                : 'AGENDA NAS PRÓXIMAS 2H:'}
            </span>
            <p className="text-white font-bold text-lg sm:text-2xl">Chame sua dupla. A próxima partida é aqui!</p>
            <p className="text-cyan-100 text-sm">{tenant.name} · {tenant.city}</p>

            {primaryVacant ? (
              <div className="flex flex-wrap items-center gap-1.5 text-slate-100">
                <span className="font-extrabold text-white">
                  {primaryVacant.court.name.split(' - ')[0]}
                </span>
                <span className="text-amber-300 font-extrabold">
                  às {primaryVacant.slot.startTime}
                </span>
                <span className="text-[#12C7BB] font-extrabold">
                  (R$ {primaryVacant.slot.price.toFixed(0)})
                </span>
                <span className="text-slate-300 text-xs hidden md:inline">
                  · em {primaryVacant.minutesUntilStart} min
                </span>
              </div>
            ) : (
              <span className="text-slate-200 font-semibold">
                Todas as quadras das próximas 2h estão ocupadas. Ajuste o horário ao lado para consultar.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {primaryVacant && (
              <button
                type="button"
                onClick={handleQuickFillVacantSlot}
                className="px-6 py-4 rounded-2xl bg-[#FF6B00] hover:bg-[#e66000] text-white font-extrabold text-base transition-all cursor-pointer flex items-center gap-2 shadow-lg"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                Reservar Agora
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-[#030B17]/80 border border-slate-700/70 rounded-lg px-2.5 py-1 text-[11px]">
              <Clock className="w-3 h-3 text-[#12C7BB]" />
              <span className="text-slate-300 font-medium">Ref:</span>
              <select
                value={referenceClockTime}
                onChange={(e) => setReferenceClockTime(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer border-none p-0"
                title="Horário de referência para radar de 2h e alerta de 15 min"
              >
                <option value="16:45" className="bg-[#030B17]">16:45</option>
                <option value="17:45" className="bg-[#030B17]">17:45</option>
                <option value="18:45" className="bg-[#030B17]">18:45</option>
                <option value="19:45" className="bg-[#030B17]">19:45</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setNotificationDrawerOpen(!notificationDrawerOpen)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                notificationDrawerOpen
                  ? 'bg-[#0987CE] text-white border-[#0987CE]'
                  : 'bg-[#030B17]/80 hover:bg-[#0B254E] text-slate-200 border-slate-700/70'
              }`}
            >
              <BellRing className="w-3.5 h-3.5 text-[#12C7BB]" />
              <span>Alertas ({unreadCount})</span>
            </button>
          </div>
        </div>

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
