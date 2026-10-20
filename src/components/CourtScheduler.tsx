import { BOOKING_DEMO } from '../services/bookingMode';
import { STATE_LABELS } from '../services/bookingAvailability';
import { useArenaAvailability } from '../hooks/useArenaAvailability';
import { useBookingSelection } from '../store/useBookingSelection';
import { arenaDate } from '../services/bookingAvailability';
import { QuickBookingPaymentModal } from './QuickBookingPaymentModal';
import React, { useState, useMemo, useRef } from 'react';
import { useApp, ArenaSubTab } from '../context/AppContext';
import { FreeBroadcastPanel } from './FreeBroadcastPanel';
import {
  AthleteLevel,
  ClassEnrollmentAuthorRole,
  ClassScheduleConfig,
  Court,
  SemiFormat,
  SportType,
  TimeSlot,
  TournamentCategory,
} from '../types';
import {
  buildDirectTuitionRenewalLink,
  buildTuitionDueIn2DaysNotification,
  calculateStudentTuitionCycle,
  findStudentsWithTuitionDueIn2Days,
  findStudentsWithTuitionDueToday,
  parseTimeToMinutes,
} from '../services/smartAlertEngine';
import { generateBookingWhatsAppLink, generateWaitlistWhatsAppLink } from '../services/whatsappAdapter';
import { toast } from '../store/useToastStore';
import {
  ATHLETE_LEVEL_LABELS,
  TOURNAMENT_CATEGORY_LABELS,
  validatePairCategory,
} from '../services/rankingValidator';
import {
  buildDefaultDayOfWeekPricing,
  WEEKDAY_FULL_NAMES,
} from '../services/courtSlotPricing';
import { CourtPricingAdminPanel } from './CourtPricingAdminPanel';
import { RegionalAvailabilityFinder } from './RegionalAvailabilityFinder';
import { ArenaWhiteLabelCustomizerModal } from './ArenaWhiteLabelCustomizerModal';
import { ArenaHighlightCard } from './ArenaHighlightCard';
import { ArenaCommunityLearning } from './ArenaCommunityLearning';
import { ArenaInfoHistory } from './ArenaInfoHistory';
import { DoubleEliminationBracket } from './DoubleEliminationBracket';
import { RankingBoard } from './RankingBoard';
import { AthleteEmailSelector } from './AthleteEmailSelector';
import { useSharkStore } from '../store/useSharkStore';
import {
  Check,
  Clock,
  MessageSquare,
  Calendar,
  GraduationCap,
  Trophy,
  Settings,
  Plus,
  Users,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Trash2,
  QrCode,
  CreditCard,
  BellRing,
  UserCheck,
  Video,
  Palette,
  Radio,
  Crown,
  Zap,
  History,
} from 'lucide-react';

export const CourtScheduler: React.FC<{ administration?: boolean }> = ({ administration = false }) => {
  const {
    tenant,
    slots,
    bookings,
    waitlist,
    waitlistNotifications,
    joinWaitlist,
    leaveWaitlist,
    claimWaitlistSlot,
    dismissWaitlistNotification,
    cancelBooking,
    selectedSport,
    setSelectedSport,
    createBooking,
    userProfile,
    setUserProfile,
    setActiveTab,
    arenaSubTab,
    setArenaSubTab,
    classStudents,
    enrollStudentInClass,
    toggleClassStudentPayment,
    notifyStudentTuitionDue,
    removeStudentFromClass,
    updateCourtConfig,
    addClassScheduleToCourt,
    removeClassScheduleFromCourt,
    tournaments,
    createTournament,
    setActiveTournamentId,
    registeredPairs,
    registerDouble,
    athletes,
    setActiveLiveBroadcastBookingId,
  } = useApp();


  const [showWhiteLabelModal, setShowWhiteLabelModal] = useState(false);

  // Filter by specific court inside the arena agenda
  const [selectedCourtId, setSelectedCourtId] = useState<string>('all');

  // Date selection
  const todayStr = arenaDate();
  const { date: selectedDate, setDate: setSelectedDate } = useBookingSelection();

  // Quick booking modal state (Available Slot)
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [customerName, setCustomerName] = useState(userProfile.name);
  const [customerPhone, setCustomerPhone] = useState(userProfile.phone);
  const [chosenSport, setChosenSport] = useState<SportType>('futevolei');
  const [bookingPayMethod, setBookingPayMethod] = useState<'pix' | 'cartao'>('pix');
  const [bookingSuccessUrl, setBookingSuccessUrl] = useState<string | null>(null);
  const pushSmartNotification = useSharkStore((s) => s.pushSmartNotification);

  // Waitlist modal state (Sold-Out / Occupied Slot)
  const [waitlistSlot, setWaitlistSlot] = useState<{ slot: TimeSlot; court: Court } | null>(null);
  const [waitlistName, setWaitlistName] = useState(userProfile.name);
  const [waitlistPhone, setWaitlistPhone] = useState(userProfile.phone);
  const [waitlistSport, setWaitlistSport] = useState<SportType>('futevolei');

  // Class enrollment modal / form state (Supports Aluno, Professor, Dono + Tuition starting on enrollment date)
  const [selectedClassForEnroll, setSelectedClassForEnroll] = useState<{
    courtId: string;
    classConfig: ClassScheduleConfig;
  } | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [billingType, setBillingType] = useState<'mensal' | 'diaria'>('mensal');
  const [enrollAuthorRole, setEnrollAuthorRole] = useState<ClassEnrollmentAuthorRole>('aluno');
  const [enrollDateStr, setEnrollDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [classManagementRoleFilter, setClassManagementRoleFilter] = useState<'todos' | 'professor' | 'dono' | 'vencendo_hoje'>('todos');
  const [selectedCoachFilter, setSelectedCoachFilter] = useState<string>('all');

  // Owner: New Class Schedule Form state
  const [newClassCourtId, setNewClassCourtId] = useState<string>(tenant.courts[0]?.id || '');
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassCoach, setNewClassCoach] = useState('');
  const [newClassStart, setNewClassStart] = useState('07:00');
  const [newClassEnd, setNewClassEnd] = useState('08:00');
  const [newClassSport, setNewClassSport] = useState<SportType>('futevolei');
  const [newClassMonthly, setNewClassMonthly] = useState(220);
  const [newClassDaily, setNewClassDaily] = useState(40);
  const [newClassMaxStudents, setNewClassMaxStudents] = useState<number>(8);
  const [selectedHourFilter, setSelectedHourFilter] = useState<string | null>(null);
  const isOwnerView = administration;
  const [selectedTournBracketId, setSelectedTournBracketId] = useState<string | null>(null);
  const [selectedClassSportFilter, setSelectedClassSportFilter] = useState<'all' | SportType>('all');

  // Tournament Creation Form state
  const [showCreateTournModal, setShowCreateTournModal] = useState(false);
  const [tournName, setTournName] = useState('');
  const [tournSport, setTournSport] = useState<SportType>('futevolei');
  const [tournCategory, setTournCategory] = useState<TournamentCategory>('iniciante_serie_c');
  const [tournSemiFormat, setTournSemiFormat] = useState<SemiFormat>('semi_direta');
  const [tournDate, setTournDate] = useState('');
  const [tournFee, setTournFee] = useState<number | ''>('');
  const [tournResponsible, setTournResponsible] = useState('');
  const [tournResponsiblePhone, setTournResponsiblePhone] = useState('');

  // Quick Online Tournament Registration & Payment Modal inside Arena
  const [registeringTournId, setRegisteringTournId] = useState<string | null>(null);
  const [regPlayer1Email, setRegPlayer1Email] = useState('');
  const [regPlayer2Email, setRegPlayer2Email] = useState('');
  const [isSubmittingTournReg, setIsSubmittingTournReg] = useState(false);
  const tournRegLock = useRef(false);
  const [regPhone, setRegPhone] = useState(userProfile.phone);
  const [regPaymentMethod, setRegPaymentMethod] = useState<'pix' | 'cartao'>('pix');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Generate 7 days for horizontal scroller
  const daysList = useMemo(() => {
    const list = [];
    const base = new Date();
    const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dateStr = arenaDate(d);
      list.push({
        dateStr,
        dayNum: d.getDate(),
        weekDay: weekDays[d.getDay()],
        isToday: i === 0,
      });
    }
    return list;
  }, []);

  const sportNames: Record<SportType, string> = {
    futevolei: 'Futevôlei',
    beach_tennis: 'Beach Tennis',
    volei_praia: 'Vôlei de Praia',
  };

  const uniqueArenaSports = useMemo(() => {
    return Array.from(new Set(tenant.courts.flatMap((c) => c.sports)));
  }, [tenant.courts]);

  // Filter courts for Agenda
  const filteredCourts = useMemo(() => {
    return tenant.courts.filter((c) => {
      if (selectedCourtId !== 'all' && c.id !== selectedCourtId) return false;
      if (selectedSport !== 'all' && !c.sports.includes(selectedSport)) return false;
      return true;
    });
  }, [tenant.courts, selectedCourtId, selectedSport]);

  const availability = useArenaAvailability(tenant, selectedDate);
  const slotsForDate = availability.cells.map(cell => ({ ...cell, classConfig: cell.state === 'class' ? tenant.courts.find(c => c.id === cell.courtId)?.classSchedules?.find(c => c.startTime === cell.startTime) : undefined }));

  // Arena classes & students
  const arenaClasses = useMemo(() => {
    const list: { court: Court; cls: ClassScheduleConfig }[] = [];
    tenant.courts.forEach((court) => {
      (court.classSchedules || []).forEach((cls) => {
        list.push({ court, cls });
      });
    });
    return list;
  }, [tenant.courts]);

  const arenaStudents = useMemo(() => {
    return classStudents.filter((s) => s.tenantId === tenant.id);
  }, [classStudents, tenant.id]);

  const arenaTournaments = useMemo(() => {
    return tournaments.filter((t) => t.tenantId === tenant.id);
  }, [tournaments, tenant.id]);

  // Effective active subtab
  const effectiveSubTab: ArenaSubTab =
    arenaSubTab === 'aulas'
      ? 'aulas'
      : arenaSubTab === 'campeonatos'
      ? 'campeonatos'
      : arenaSubTab === 'transmissoes'
      ? 'transmissoes'
      : arenaSubTab === 'ranking'
      ? 'ranking'
      : arenaSubTab === 'comunidade'
      ? 'comunidade'
      : arenaSubTab === 'info_historico'
      ? 'info_historico'
      : arenaSubTab === 'dono' || arenaSubTab === 'config_dono'
      ? (isOwnerView ? 'dono' : 'agendamentos')
      : 'agendamentos';

  const effectiveNowStr = useMemo(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }, []);

  const currentMinutes = useMemo(() => {
    return parseTimeToMinutes(effectiveNowStr);
  }, [effectiveNowStr]);

  const arenaHoursList = useMemo(() => {
    const hours = new Set<string>();
    slotsForDate.forEach((s) => hours.add(s.startTime));
    if (hours.size === 0) {
      for (let h = 6; h <= 22; h++) {
        hours.add(`${String(h).padStart(2, '0')}:00`);
      }
    }
    return Array.from(hours).sort();
  }, [slotsForDate]);

  const upcomingAvailableSlots = useMemo(() => {
    if (selectedDate !== todayStr) return [];
    return slotsForDate
      .filter((s) => {
        if (!s.isAvailable) return false;
        const slotMins = parseTimeToMinutes(s.startTime);
        return slotMins >= currentMinutes - 30 && slotMins <= currentMinutes + 210;
      })
      .slice(0, 4);
  }, [slotsForDate, selectedDate, todayStr, currentMinutes]);

  const classesWithSpotsInfo = useMemo(() => {
    return arenaClasses.map(({ court, cls }) => {
      const maxStudents = cls.maxStudents || 8;
      const enrolled = arenaStudents.filter((s) => s.classId === cls.id).length;
      const spotsRemaining = Math.max(0, maxStudents - enrolled);
      const isAvailable = spotsRemaining > 0;
      return {
        court,
        cls,
        maxStudents,
        enrolled,
        spotsRemaining,
        isAvailable,
      };
    });
  }, [arenaClasses, arenaStudents]);

  const todayAvailableSlotsCount = useMemo(() => {
    return slotsForDate.filter((s) => s.isAvailable).length;
  }, [slotsForDate]);

  const classesWithSpotsCount = useMemo(() => {
    return classesWithSpotsInfo.filter((c) => c.isAvailable).length;
  }, [classesWithSpotsInfo]);

  const totalClassSpotsRemaining = useMemo(() => {
    return classesWithSpotsInfo.reduce((acc, c) => acc + c.spotsRemaining, 0);
  }, [classesWithSpotsInfo]);

  // Handle clicking on a slot in the court agenda
  const handleSlotClick = (slot: TimeSlot, court: Court) => {
    if (slot.slotType === 'class' && slot.classConfig) {
      setSelectedClassForEnroll({ courtId: court.id, classConfig: slot.classConfig });
      return;
    }

    if (!slot.isAvailable && ('state' in slot && slot.state !== 'reserved')) return;
    if (!slot.isAvailable) {
      // Occupied / Sold-out court -> Open Waitlist Modal!
      setWaitlistName(userProfile.name);
      setWaitlistPhone(userProfile.phone);
      setWaitlistSport(court.sports[0] || 'futevolei');
      setWaitlistSlot({ slot, court });
      return;
    }

    setActiveSlot(slot);
    setBookingSuccessUrl(null);
    if (selectedSport !== 'all' && court.sports.includes(selectedSport)) {
      setChosenSport(selectedSport);
    } else {
      setChosenSport(court.sports[0]);
    }
  };

  // Reservations use the shared review dialog; online payment is not configured.

  // Join Waitlist on sold-out slot
  const handleJoinWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistSlot || !waitlistName.trim() || !waitlistPhone.trim()) return;

    const entry = joinWaitlist(
      waitlistSlot.slot.id,
      waitlistSport,
      waitlistName.trim(),
      waitlistPhone.trim()
    );

    triggerToast(
      `${entry.customerName} entrou na Lista de Espera (${entry.position}º da fila) para ${waitlistSlot.court.name.split(' - ')[0]} às ${waitlistSlot.slot.startTime}!`
    );
  };

  // Online cancellation is unavailable until the arena confirmation API exists.
  const handleCancelCurrentSlotBooking = (bookingId: string) => {
    if (!BOOKING_DEMO) { triggerToast('Contate a arena para cancelar a reserva.'); return; }
    const notified = cancelBooking(bookingId);
    setWaitlistSlot(null);
    if (notified) {
      triggerToast(
        `🔔 Reserva cancelada! Próximo da fila (${notified.customerName} - 1º da lista) foi notificado automaticamente!`
      );
    } else {
      triggerToast('Reserva cancelada! O horário voltou a ficar livre na agenda.');
    }
  };

  // Confirm Student Class Enrollment (Aluno, Professor or Dono + Monthly Cycle Starting on Enrollment Date)
  const handleEnrollStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForEnroll || !studentName.trim() || !studentPhone.trim()) return;

    const enrolled = enrollStudentInClass({
      courtId: selectedClassForEnroll.courtId,
      classConfig: selectedClassForEnroll.classConfig,
      studentName: studentName.trim(),
      studentPhone: studentPhone.trim(),
      billingType,
      enrolledAt: enrollDateStr,
      enrolledByRole: enrollAuthorRole,
      enrolledByName:
        enrollAuthorRole === 'professor'
          ? selectedClassForEnroll.classConfig.coachName
          : enrollAuthorRole === 'dono'
          ? `Dono (${tenant.name})`
          : 'Auto-Matrícula do Aluno',
    });

    setStudentName('');
    setStudentPhone('');
    setSelectedClassForEnroll(null);
    setArenaSubTab('agendamentos');
    triggerToast(
      `✅ ${enrolled.studentName} vinculado à turma "${enrolled.classTitle}" (${
        enrollAuthorRole === 'aluno'
          ? 'Inscrição pelo Aluno'
          : enrollAuthorRole === 'professor'
          ? 'Inscrição pelo Professor'
          : 'Inscrição pelo Dono'
      })! Mensalidade iniciada em ${enrolled.enrolledAt} (Vencimento todo dia ${enrolled.dueDayOfMonth}).`
    );
  };

  // Owner: Add new class schedule to court
  const handleAddClassSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassTitle.trim() || !newClassCoach.trim()) return;

    addClassScheduleToCourt(newClassCourtId, {
      title: newClassTitle.trim(),
      coachName: newClassCoach.trim(),
      startTime: newClassStart,
      endTime: newClassEnd,
      sport: newClassSport,
      monthlyPrice: newClassMonthly,
      dailyPrice: newClassDaily,
      maxStudents: newClassMaxStudents || 8,
    });

    setNewClassTitle('');
    setNewClassCoach('');
    triggerToast('Novo horário fixo de aula adicionado à agenda da quadra!');
  };

  // Owner: Create Tournament
  const handleCreateTournamentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournName.trim() || !tournDate || tournFee === '' || !tournResponsible.trim() || !tournResponsiblePhone.trim()) {
      toast.error('Informe nome, data, taxa e contato real do responsável.');
      return;
    }

    try {
      const created = await createTournament({
        name: tournName.trim(),
        sport: tournSport,
        category: tournCategory,
        semiFormat: tournSemiFormat,
        date: tournDate,
        registrationFee: Number(tournFee),
        responsibleName: tournResponsible.trim(),
        responsiblePhone: tournResponsiblePhone.trim(),
      });
      setTournName('');
      setShowCreateTournModal(false);
      toast.success(`Torneio "${created.name}" salvo no Firestore.`);
      triggerToast(`Campeonato "${created.name}" salvo no Firestore.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o torneio.');
    }
  };

  // Client: Register & Pay for Tournament inside Arena
  const activeRegisteringTourn = tournaments.find((t) => t.id === registeringTournId);
  const isSinglesReg = activeRegisteringTourn?.modalityFormat === 'simples';

  const selectedRegP1 = athletes.find(
    (a) => (a.email || '').trim().toLowerCase() === regPlayer1Email.trim().toLowerCase()
  ) || null;

  const selectedRegP2 = athletes.find(
    (a) => (a.email || '').trim().toLowerCase() === regPlayer2Email.trim().toLowerCase()
  ) || null;

  const enrolledEmailsInTourn = useMemo(() => {
    if (!registeringTournId) return new Set<string>();
    return new Set(
      registeredPairs
        .filter((p) => p.tournamentId === registeringTournId && p.enrollmentStatus !== 'rejected')
        .flatMap((p) => [p.player1Email, p.player2Email])
        .filter((e): e is string => Boolean(e))
        .map((e) => e.trim().toLowerCase())
    );
  }, [registeredPairs, registeringTournId]);

  const regValidation = useMemo(() => {
    if (!activeRegisteringTourn) return { isValid: false, reason: '', ruleSummary: '' };
    if (!selectedRegP1) return { isValid: false, reason: 'Selecione o Atleta 1 pelo e-mail.', ruleSummary: 'A categoria vem do perfil.' };
    if (isSinglesReg) {
      return { isValid: true, reason: `Inscrição individual para ${selectedRegP1.name}.`, ruleSummary: 'Modalidade 1x1.' };
    }
    if (!selectedRegP2) return { isValid: false, reason: 'Selecione o Atleta 2 pelo e-mail.', ruleSummary: 'A categoria vem do perfil.' };
    if (selectedRegP1.email?.trim().toLowerCase() === selectedRegP2.email?.trim().toLowerCase()) {
      return { isValid: false, reason: 'Os atletas da dupla precisam ter e-mails diferentes.', ruleSummary: 'Escolha dois atletas.' };
    }
    return validatePairCategory(activeRegisteringTourn.category, selectedRegP1.level, selectedRegP2.level);
  }, [activeRegisteringTourn, isSinglesReg, selectedRegP1, selectedRegP2]);

  const handleCompleteTournRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (tournRegLock.current || isSubmittingTournReg || !activeRegisteringTourn || !regValidation.isValid || !selectedRegP1) return;
    if (!isSinglesReg && !selectedRegP2) return;

    tournRegLock.current = true;
    setIsSubmittingTournReg(true);
    try {
      const newPair = registerDouble({
        tournamentId: activeRegisteringTourn.id,
        player1Id: selectedRegP1.id,
        player1Email: selectedRegP1.email,
        player1Phone: selectedRegP1.phone,
        player1: selectedRegP1.name,
        player1Level: selectedRegP1.level,
        player2Id: isSinglesReg ? undefined : selectedRegP2?.id,
        player2Email: isSinglesReg ? undefined : selectedRegP2?.email,
        player2Phone: isSinglesReg ? undefined : selectedRegP2?.phone,
        player2: isSinglesReg ? 'Individual (1x1)' : selectedRegP2!.name,
        player2Level: isSinglesReg ? selectedRegP1.level : selectedRegP2!.level,
        phone: selectedRegP1.phone || selectedRegP2?.phone || regPhone || '',
        category: activeRegisteringTourn.category,
        paymentMethod: regPaymentMethod,
      });

      setRegPlayer1Email('');
      setRegPlayer2Email('');
      setRegisteringTournId(null);
      toast.success(`Dupla (${newPair.player1} & ${newPair.player2}) inscrita com sucesso!`);
      triggerToast(
        `Pagamento confirmado e Dupla #${newPair.seed} (${newPair.player1} & ${newPair.player2}) inscrita com sucesso!`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir a inscrição.');
    } finally {
      setIsSubmittingTournReg(false);
      window.setTimeout(() => {
        tournRegLock.current = false;
      }, 500);
    }
  };

  if (!tenant.id) return <section className="max-w-3xl mx-auto p-8 text-center"><h1 className="text-xl font-bold">Nenhuma arena selecionada</h1><p className="mt-2">Encontre uma arena para consultar quadras e horários.</p><button type="button" onClick={() => setActiveTab('arenas_directory')} className="mt-4 min-h-11 rounded-xl bg-cyan-700 px-5 text-white">Buscar arenas</button></section>;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Automatic Waitlist Notification Banner (Disparo Automático ao Cancelar Reserva) */}
      {waitlistNotifications.length > 0 && (
        <div className="space-y-2.5">
          {waitlistNotifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-in fade-in"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold uppercase tracking-wider text-amber-900 text-[11px]">
                      Disparo Automático · Lista de Espera
                    </span>
                    <span className="text-amber-700 font-mono text-[11px]">às {notif.timestamp}</span>
                  </div>
                  <p className="text-slate-900 font-medium">
                    A reserva de <strong>{notif.cancelledByCustomer || 'Cliente'}</strong> em{' '}
                    <strong>{notif.waitlistEntry.courtName}</strong> ({notif.waitlistEntry.date} às{' '}
                    <strong>{notif.waitlistEntry.startTime}</strong>) foi cancelada!
                  </p>
                  <p className="text-emerald-800 font-bold">
                    ✓ Próximo da fila notificado automaticamente: {notif.waitlistEntry.customerName} (WhatsApp:{' '}
                    {notif.waitlistEntry.customerPhone})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (!BOOKING_DEMO) { triggerToast('Contate a arena para confirmar a reserva.'); return; }
                    const booked = claimWaitlistSlot(notif.waitlistEntry.id);
                    triggerToast(
                      `Reserva confirmada automaticamente para ${booked.customerName} às ${booked.startTime}!`
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Confirmar Reserva p/ {notif.waitlistEntry.customerName.split(' ')[0]} (1 Clique)
                </button>

                <a
                  href={notif.whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Abrir WhatsApp Enviado
                </a>

                <button
                  onClick={() => dismissWaitlistNotification(notif.id)}
                  className="px-2.5 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Dispensar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Arena Overview Header — Supports White-Label Arena Website Mode (Logo + Extracted Palette + DESENVOLVIDO POR SHARKSET) */}
      <div
        className="text-white border rounded-3xl overflow-hidden shadow-lg transition-all"
        style={{
          backgroundColor:
            tenant.whiteLabelEnabled && tenant.brandPalette
              ? tenant.brandPalette.headerBg
              : '#0F172A',
          borderColor:
            tenant.whiteLabelEnabled && tenant.brandPalette
              ? tenant.brandPalette.primary
              : '#1E293B',
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Arena Main Photo Banner — Uses the uploaded Arena Logo as the Main Hero Photo when active */}
          <div
            className="lg:col-span-4 relative min-h-[230px] bg-slate-950 overflow-hidden flex items-center justify-center"
            style={
              tenant.whiteLabelEnabled && tenant.brandPalette
                ? {
                    background: `radial-gradient(circle at 50% 45%, ${tenant.brandPalette.primary}66 0%, ${tenant.brandPalette.headerBg} 75%, #05070b 100%)`,
                  }
                : undefined
            }
          >
            {tenant.logoUrl ? (
              <>
                {/* Blurred ambient backdrop of the Arena Logo */}
                <img
                  src={tenant.logoUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover opacity-35 blur-xl scale-110 pointer-events-none"
                />
                {/* Main Hero Photo = Arena Logo */}
                <img
                  src={tenant.logoUrl}
                  alt={`Logo Principal ${tenant.name}`}
                  className="relative z-10 w-full h-full max-h-[250px] object-contain p-4 drop-shadow-2xl transition-transform duration-300 hover:scale-[1.03]"
                />
              </>
            ) : tenant.imageUrl ? <img
                src={tenant.imageUrl}
                alt={tenant.name}
                className="w-full h-full object-cover opacity-85"
              /> : <div className="w-full h-full flex items-center justify-center text-slate-400">Sem imagem cadastrada</div>}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40 pointer-events-none" />
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2">
              <button
                onClick={() => setActiveTab('arenas_directory')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-white text-xs font-black border border-white/15 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Todas Arenas
              </button>

              <span
                className="px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-black tracking-widest uppercase text-white border border-white/20"
                style={{
                  backgroundColor:
                    tenant.whiteLabelEnabled && tenant.brandPalette
                      ? `${tenant.brandPalette.primary}dd`
                      : 'rgba(2, 6, 23, 0.85)',
                }}
              >
                DESENVOLVIDO POR SHARKSET
              </span>
            </div>

            {/* Bottom status bar on the Hero Photo */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex items-end justify-between gap-3">
              {tenant.logoUrl ? (
                <div className="flex items-center justify-between w-full text-xs text-white bg-black/55 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
                  <span
                    className="font-black uppercase tracking-wider text-[10px]"
                    style={{ color: tenant.brandPalette?.accent || '#FBBF24' }}
                  >
                    ★ Logo Oficial · Paleta Ativa na Página
                  </span>
                  <span className="font-black text-amber-300">★ {tenant.rating.toFixed(1)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full text-xs text-white">
                  <span className="font-black text-orange-400">★ {tenant.rating.toFixed(1)} Oficial</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {tenant.distanceKm.toFixed(1)} km de você
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Arena Info, White-Label Customizer Button & Sub-Navigation */}
          <div className="lg:col-span-8 p-6 flex flex-col justify-between space-y-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold">
                    {tenant.city}, {tenant.state}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span>
                    Funcionamento:{' '}
                    <strong className="text-white">
                      {tenant.operatingHours.open} às {tenant.operatingHours.close}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="font-extrabold text-emerald-400">
                    {tenant.courts.length} Quadras Disponíveis
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {tenant.name}
                </h1>
                <p className="text-xs text-slate-300">
                  {tenant.tagline ? `${tenant.tagline} · ` : ''}
                  {tenant.address} · {tenant.amenities.join(' · ')}
                </p>
              </div>

              {/* White-Label Arena Logo & Palette Customizer Trigger */}
              {isOwnerView && <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWhiteLabelModal(true)}
                  className="px-4 py-2.5 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:brightness-110"
                  style={{
                    backgroundColor:
                      tenant.whiteLabelEnabled && tenant.brandPalette
                        ? tenant.brandPalette.primary
                        : '#FF6B00',
                  }}
                >
                  <Palette className="w-4 h-4" />
                  {tenant.whiteLabelEnabled
                    ? 'Personalizar Logo & Paleta da Arena'
                    : 'Colocar Logo da Arena (Site Próprio)'}
                </button>
                <span className="text-[10px] text-slate-300 text-center font-semibold">
                  A página fica toda na paleta da logo enviada · <strong className="text-white">DESENVOLVIDO POR SHARKSET</strong>
                </span>
              </div>}
            </div>

            {/* High-Visibility Sub-Navigation Inside the Arena */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    id: 'agendamentos',
                    icon: Calendar,
                    label: `1. AGENDAMENTOS (${tenant.courts.length} Quadras)`,
                    badge: todayAvailableSlotsCount > 0 ? `${todayAvailableSlotsCount} Livres` : 'Principal',
                    badgeBg: todayAvailableSlotsCount > 0 ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950',
                  },
                  {
                    id: 'aulas',
                    icon: GraduationCap,
                    label: `2. AULAS & TREINOS (${arenaClasses.length})`,
                    badge: classesWithSpotsCount > 0 ? `${classesWithSpotsCount} com Vaga` : undefined,
                    badgeBg: 'bg-amber-400 text-slate-950',
                  },
                  {
                    id: 'ranking',
                    icon: Crown,
                    label: '2. RANKING DA ARENA',
                  },
                  {
                    id: 'campeonatos',
                    icon: Trophy,
                    label: `3. CAMPEONATOS (${arenaTournaments.length})`,
                    badge: arenaTournaments.length > 0 ? `${arenaTournaments.length} Ativos` : undefined,
                    badgeBg: 'bg-sky-400 text-slate-950',
                  },
                  {
                    id: 'transmissoes',
                    icon: Radio,
                    label: '4. AO VIVO (TRANSMISSÃO)',
                  },
                  {
                    id: 'comunidade',
                    icon: GraduationCap,
                    label: '5. COMUNIDADE (VÍDEOS)',
                  },
                  {
                    id: 'info_historico',
                    icon: History,
                    label: '6. INFORMAÇÕES & HISTÓRICO',
                  },
                  {
                    id: 'dono',
                    icon: Settings,
                    label: '6. ÁREA DO DONO (GESTÃO)',
                  },
                ].filter(tab => tab.id !== 'dono' || isOwnerView).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = effectiveSubTab === tab.id;
                  const activeBg =
                    tenant.whiteLabelEnabled && tenant.brandPalette
                      ? tenant.brandPalette.primary
                      : '#FF6B00';
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setArenaSubTab(tab.id as ArenaSubTab);

                      }}
                      className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? 'text-white shadow-sm ring-2 ring-white/20'
                          : 'bg-white/10 text-slate-200 hover:text-white hover:bg-white/15 border border-white/10'
                      }`}
                      style={isActive ? { backgroundColor: activeBg } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${tab.badgeBg || 'bg-amber-400 text-slate-950'}`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ARENA HIGHLIGHTS & QUICK PILLARS HUB (MUITO EVIDENTE)                 */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. AGENDAMENTOS */}
        <div
          onClick={() => setArenaSubTab('agendamentos')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md ${
            effectiveSubTab === 'agendamentos'
              ? 'bg-gradient-to-br from-emerald-500/15 via-white to-white border-emerald-500 ring-2 ring-emerald-400/40'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              {todayAvailableSlotsCount > 0 ? `${todayAvailableSlotsCount} livres hoje` : 'Esgotado'}
            </span>
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
              1. Agendamentos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {tenant.courts.length} quadras · ⚽ Futevôlei foco principal, Beach e Vôlei
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-black text-emerald-700">
            <span>Ver Horários & Grade</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* 2. AULAS & TREINOS */}
        <div
          onClick={() => setArenaSubTab('aulas')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md ${
            effectiveSubTab === 'aulas'
              ? 'bg-gradient-to-br from-indigo-500/15 via-white to-white border-indigo-500 ring-2 ring-indigo-400/40'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
              <GraduationCap className="w-5 h-5" />
            </div>
            {classesWithSpotsCount > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-pulse">
                🔥 {classesWithSpotsCount} turmas com vaga
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                Turmas Lotadas
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
              2. Aulas & Treinos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Limite pré-definido pelo dono · {totalClassSpotsRemaining} vagas restantes no total
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-black text-indigo-700">
            <span>Garantir Minha Vaga</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* 3. CAMPEONATOS */}
        <div
          onClick={() => setArenaSubTab('campeonatos')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md ${
            effectiveSubTab === 'campeonatos'
              ? 'bg-gradient-to-br from-amber-500/15 via-white to-white border-amber-500 ring-2 ring-amber-400/40'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
              {arenaTournaments.length} Torneios
            </span>
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-amber-800 transition-colors">
              3. Campeonatos
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inscrições online, validação de categorias e chaves ao vivo
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-black text-amber-800">
            <span>Ver Torneios & Chaves</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>

        {/* 4. TRANSMISSÕES AO VIVO */}
        <div
          onClick={() => setArenaSubTab('transmissoes')}
          className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group shadow-xs hover:shadow-md ${
            effectiveSubTab === 'transmissoes'
              ? 'bg-gradient-to-br from-red-500/15 via-white to-white border-red-500 ring-2 ring-red-400/40'
              : 'bg-white border-slate-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-black">
              <Radio className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              AO VIVO
            </span>
          </div>

          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-red-600 transition-colors">
              4. Transmissões
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Câmeras oficiais 1080p · Placar sincronizado em tempo real
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-black text-red-600">
            <span>Assistir Agora</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </div>
      </div>
      {/* ARENA EXECUTIVE RADAR / HIGHLIGHT CARD (Campeonatos, Horários, Ranking, Clientes) */}
      {/* ===================================================================== */}
      <ArenaHighlightCard
        tenant={tenant}
        upcomingTournaments={arenaTournaments}
        upcomingAvailableSlots={upcomingAvailableSlots}
        arenaAthletes={athletes.filter((a) => a.arenaId === tenant.id || a.city.includes(tenant.city))}
        recentBookings={bookings.filter((b) => b.tenantId === tenant.id || b.courtId.includes(tenant.id))}
        onBookSlot={(slot, court) => handleSlotClick(slot, court)}
        onRegisterTournament={(tournId) => {
          setRegisteringTournId(tournId);
          setArenaSubTab('campeonatos');
        }}
        onViewAllTournaments={() => setArenaSubTab('campeonatos')}
        onViewAllSlots={() => setArenaSubTab('agendamentos')}
        onViewAllRanking={() => setArenaSubTab('ranking')}
      />

      {/* ===================================================================== */}
      {/* SUB-TAB 1: AGENDAMENTOS (O PRINCIPAL DA PÁGINA DA ARENA)              */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'agendamentos' && (
        <div className="space-y-6">
          {/* 1. HORÁRIOS PRÓXIMOS DE AGORA (HOJE) */}
          {upcomingAvailableSlots.length > 0 && !selectedHourFilter && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border-2 border-orange-400/40 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-orange-950">
                    ⚡ Horários Livres Próximos de Você (Hoje em {tenant.name})
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full">
                  Próximas Horas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {upcomingAvailableSlots.map((slot) => {
                  const court = tenant.courts.find((c) => c.id === slot.courtId);
                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleSlotClick(slot, court || tenant.courts[0])}
                      className="p-3.5 bg-white rounded-2xl border border-orange-200 hover:border-orange-500 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-extrabold text-orange-600 font-mono">
                            {slot.startTime} às {slot.endTime}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase">
                            Disponível
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                          {court?.name || 'Quadra'}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {court?.surface} · {court?.isCovered ? 'Coberta' : 'Aberta'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-black text-slate-900">
                          R$ {slot.price || court?.hourlyRate || 80}/h
                        </span>
                        <span className="px-3 py-1 rounded-xl bg-[#FF6B00] group-hover:bg-[#e55f00] text-white text-[11px] font-black transition-colors">
                          Reservar →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. CARROSSEL INTERATIVO DE HORÁRIOS */}
          <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FF6B00]" />
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                  Carrossel de Horários (Toque para filtrar por hora):
                </h3>
              </div>
              {selectedHourFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedHourFilter(null)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  ✕ Limpar Filtro ({selectedHourFilter}) · Ver Todos os Horários
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {arenaHoursList.map((hStr) => {
                const isSelected = selectedHourFilter === hStr;
                const availableCount = slotsForDate.filter((s) => s.startTime === hStr && s.isAvailable).length;
                const isNearNow = Math.abs(parseTimeToMinutes(hStr) - currentMinutes) <= 90;
                return (
                  <button
                    key={hStr}
                    type="button"
                    onClick={() => setSelectedHourFilter(isSelected ? null : hStr)}
                    className={`min-w-[96px] py-2 px-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-orange-400'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-orange-300 hover:bg-orange-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black tabular-nums">{hStr}</span>
                      {isNearNow && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" title="Próximo de agora" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-extrabold mt-1 px-2 py-0.5 rounded-full ${
                        availableCount > 0
                          ? isSelected
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {availableCount > 0 ? `${availableCount} ${availableCount === 1 ? 'vaga' : 'vagas'}` : 'Esgotado'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. AULAS COM VAGAS ABERTAS (CAPACIDADE LIMITADA PRÉ-DEFINIDA PELO DONO) */}
          {classesWithSpotsInfo.length > 0 && (
            <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      Aulas & Treinos com Vagas Abertas na Arena
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Turmas com <strong>limite máximo de alunos</strong> para maior atenção e evolução no jogo.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold shrink-0">
                  {classesWithSpotsInfo.filter((c) => c.isAvailable).length} turmas com vaga
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {classesWithSpotsInfo.map(({ court, cls, maxStudents, enrolled, spotsRemaining, isAvailable }) => (
                  <div
                    key={cls.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                          {sportNames[cls.sport]}
                        </span>
                        {isAvailable ? (
                          spotsRemaining === 1 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase animate-pulse">
                              🔥 ÚLTIMA VAGA!
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase animate-pulse">
                              🟢 TEM VAGA ({spotsRemaining} livres)
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                            🔒 Turma Lotada
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {cls.title}
                        </h4>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">
                          Prof. {cls.coachName} · {court.name.split(' - ')[0]}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {cls.startTime} às {cls.endTime}
                        </p>
                      </div>

                      {/* Capacity Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span>Capacidade da Turma:</span>
                          <span className={isAvailable ? 'text-indigo-700' : 'text-rose-600'}>
                            {enrolled}/{maxStudents} alunos inscritos
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              enrolled >= maxStudents ? 'bg-rose-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(100, (enrolled / maxStudents) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/80">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          R$ {cls.monthlyPrice}/mês
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ou R$ {cls.dailyPrice} avulsa
                        </span>
                      </div>

                      {isAvailable ? (
                        <button
                          type="button"
                          onClick={() => setSelectedClassForEnroll({ courtId: court.id, classConfig: cls })}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                        >
                          Quero Esta Vaga →
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedClassForEnroll({ courtId: court.id, classConfig: cls })}
                          className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                        >
                          Lista de Espera
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        <div className="space-y-5">
          {/* Ultra-Intuitive 2-Step Strip + Sports Focus Notice */}
          <div
            className="text-white rounded-2xl p-4 border flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            style={{
              backgroundColor:
                tenant.whiteLabelEnabled && tenant.brandPalette
                  ? tenant.brandPalette.headerBg
                  : '#022c22',
              borderColor:
                tenant.whiteLabelEnabled && tenant.brandPalette
                  ? tenant.brandPalette.primary
                  : '#047857',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-xl text-slate-950 font-black text-sm flex items-center justify-center shrink-0"
                style={{
                  backgroundColor:
                    tenant.whiteLabelEnabled && tenant.brandPalette
                      ? tenant.brandPalette.accent
                      : '#fbbf24',
                }}
              >
                1
              </span>
              <div className="text-xs space-y-0.5">
                <strong className="text-amber-300 block text-sm">
                  Toque em qualquer horário livre abaixo para agendar Futevôlei, Beach Tennis ou Vôlei
                </strong>
                <span className="text-slate-200 block">
                  ⚽ <strong>Foco Principal: Futevôlei</strong> · Agendamentos liberados também para{' '}
                  <strong>🎾 Beach Tennis</strong> e <strong>🏐 Vôlei de Praia</strong> (em breve abriremos abas exclusivas para outros esportes!).
                </span>
              </div>
            </div>

            {/* Sport Selector Pills (Futevôlei Focus + Beach Tennis + Vôlei + Upcoming Tabs Badge) */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSport(selectedSport === 'futevolei' ? 'all' : 'futevolei')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedSport === 'futevolei' || selectedSport === 'all'
                    ? 'bg-[#FF6B00] text-white shadow-sm ring-2 ring-amber-300/60'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                ⚽ Futevôlei (Foco Principal)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSport(selectedSport === 'beach_tennis' ? 'all' : 'beach_tennis')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedSport === 'beach_tennis'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-white/10 text-white/85 hover:bg-white/20'
                }`}
              >
                🎾 Beach Tennis
              </button>
              <button
                type="button"
                onClick={() => setSelectedSport(selectedSport === 'volei_praia' ? 'all' : 'volei_praia')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedSport === 'volei_praia'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-white/10 text-white/85 hover:bg-white/20'
                }`}
              >
                🏐 Vôlei de Praia
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-black/35 border border-white/15 text-[10px] font-extrabold text-amber-200">
                🚀 Em breve: Abas p/ Outros Esportes
              </span>
            </div>
          </div>

          {/* Court Selector & Sport Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Individual Court Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-xl">
              <button
                onClick={() => setSelectedCourtId('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedCourtId === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas as Quadras ({tenant.courts.length})
              </button>
              {tenant.courts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCourtId(c.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedCourtId === c.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c.name.split(' - ')[0]}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block"></span>
                <span>Livre p/ Locação</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block"></span>
                <span>Reservado p/ Aula (+ Aluno)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block"></span>
                <span>Esgotado · Clique p/ Lista de Espera</span>
              </div>
            </div>
          </div>

          {/* Horizontal Date Scroller */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {daysList.map((d) => {
              const isSelected = d.dateStr === selectedDate;
              return (
                <button
                  key={d.dateStr}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`min-w-[74px] py-2.5 px-3 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`text-[10px] font-bold tracking-wider ${isSelected ? 'text-amber-300' : 'text-slate-400'}`}>
                    {d.isToday ? 'HOJE' : d.weekDay}
                  </span>
                  <span className="text-lg font-extrabold tabular-nums mt-0.5">{d.dayNum}</span>
                </button>
              );
            })}
          </div>

          {availability.loading && <p role="status">Consultando agenda…</p>}
            {availability.error && <p role="alert" className="text-red-600">{availability.error}</p>}
            {/* Courts Schedule List */}
          <div className="space-y-5">
            {filteredCourts.map((court) => {
              const allCourtSlots = slotsForDate.filter((s) => s.courtId === court.id);
              const courtSlots = selectedHourFilter
                ? allCourtSlots.filter((s) => s.startTime === selectedHourFilter)
                : allCourtSlots;
              const availableCount = allCourtSlots.filter((s) => s.isAvailable).length;
              const selectedDayIndex = new Date(`${selectedDate}T12:00:00`).getDay();
              const courtDayMatrix = buildDefaultDayOfWeekPricing(court);
              const activeDayRule = courtDayMatrix[selectedDayIndex] || {
                enabled: true,
                normalRate: court.hourlyRate,
                peakRate: court.peakHourlyRate ?? court.hourlyRate + 15,
              };

              return (
                <div
                  key={court.id}
                  className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">{court.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{court.surface}</span>
                        <span aria-hidden="true">·</span>
                        <span>{court.isCovered ? 'Quadra Coberta' : 'Céu Aberto'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Expediente: {court.openTime || '06:00'} às {court.closeTime || '23:00'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-900 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          {WEEKDAY_FULL_NAMES[selectedDayIndex]}: Normal R$ {activeDayRule.normalRate}/h · Pico ({court.peakStartTime || '18:00'} às {court.peakEndTime || '22:00'}) R$ {activeDayRule.peakRate}/h
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isOwnerView && <button
                        type="button"
                        onClick={() => {
                          setActiveTab('arena_admin');
                          setArenaSubTab('dono');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configurar Preços (Pico / Dias)
                      </button>}
                      <div className="text-xs text-slate-600 font-medium">
                        <span className="text-emerald-700 font-bold tabular-nums">{availableCount}</span> horários livres hoje
                      </div>
                    </div>
                  </div>

                  {/* Slots Grid */}
                  {courtSlots.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                      Nenhum horário cadastrado para {court.name} às <strong className="text-slate-800">{selectedHourFilter}</strong>.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
                      {courtSlots.map((slot) => {
                        const isClass = slot.slotType === 'class' && slot.classConfig;

                        if (isClass && slot.classConfig) {
                          return (
                            <button
                              key={slot.id}
                              onClick={() => handleSlotClick(slot, court)}
                              className="min-h-[64px] p-2 rounded-xl flex flex-col items-center justify-center transition-all text-xs font-semibold bg-indigo-50 text-indigo-950 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                              title={`${slot.classConfig.title} (${slot.classConfig.coachName}) - Clique para adicionar aluno (Mensal/Diária)`}
                            >
                              <span className="tabular-nums font-mono text-[12px] font-bold">{slot.startTime}</span>
                              <span className="text-[10px] text-indigo-700 font-bold truncate max-w-full">
                                AULA · {slot.classConfig.coachName.split(' ')[1] || 'Prof'}
                              </span>
                              <span className="text-[9px] text-indigo-500">+ Aluno</span>
                            </button>
                          );
                        }

                        // Check waitlist count for this slot
                        const slotWaitlist = waitlist.filter(
                          (w) =>
                            (w.slotId === slot.id ||
                              (w.courtId === slot.courtId && w.date === slot.date && w.startTime === slot.startTime)) &&
                            (w.status === 'waiting' || w.status === 'notified')
                        );
                        const hasNotified = slotWaitlist.some((w) => w.status === 'notified');

                        if (!slot.isAvailable && slot.state !== 'reserved') {
                          return <div key={slot.id} className="min-h-[64px] p-2 rounded-xl bg-slate-100 text-slate-500 text-center text-xs"><strong className="block font-mono">{slot.startTime}</strong>{STATE_LABELS[slot.state]}</div>;
                        }
                        if (!slot.isAvailable) {
                          return (
                            <button
                              key={slot.id}
                              onClick={() => handleSlotClick(slot, court)}
                              className={`min-h-[64px] p-2 rounded-xl flex flex-col items-center justify-center transition-all text-xs font-semibold cursor-pointer border ${
                                slotWaitlist.length > 0
                                  ? 'bg-amber-50/90 text-amber-950 border-amber-300 hover:bg-amber-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/80 hover:border-slate-300'
                              }`}
                              title="Quadra esgotada neste horário. Clique para entrar na Lista de Espera!"
                            >
                              <span className="tabular-nums font-mono text-[12px] font-bold line-through opacity-75">
                                {slot.startTime}
                              </span>
                              <span className="text-[9px] font-bold text-amber-800 truncate max-w-full">
                                {slotWaitlist.length > 0
                                  ? `⏳ ${slotWaitlist.length} na fila`
                                  : '+ Lista Espera'}
                              </span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={slot.id}
                            onClick={() => handleSlotClick(slot, court)}
                            className={`min-h-[64px] p-2 rounded-xl flex flex-col items-center justify-center transition-all text-xs font-semibold cursor-pointer ${
                              hasNotified
                                ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 hover:bg-amber-200'
                                : slot.isPeakHour
                                ? 'bg-emerald-50/90 text-emerald-950 border border-amber-300 hover:bg-emerald-100 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-emerald-50 text-emerald-950 border border-emerald-200 hover:bg-emerald-100 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                          >
                            <span className="tabular-nums font-mono text-[13px] font-bold">{slot.startTime}</span>
                            {hasNotified ? (
                              <span className="text-[9px] font-extrabold text-amber-800">🔔 1º Notificado</span>
                            ) : (
                              <span className="text-[10px] text-slate-700 font-bold tabular-nums">
                                R$ {slot.price} {slot.isPeakHour ? '⚡' : ''}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: AULAS & TREINOS (EVIDÊNCIA MÁXIMA DE VAGAS PARA O CLIENTE) */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'aulas' && (
        <div className="space-y-6">
          {/* Header & Spotlight Banner */}
          <div className="aquarium-glass bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border border-indigo-900/40 rounded-3xl p-6 sm:p-8 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-400" />
                    Aulas & Treinamentos Oficiais
                  </span>
                  {classesWithSpotsCount > 0 ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                      <Zap className="w-3.5 h-3.5" />
                      {classesWithSpotsCount} {classesWithSpotsCount === 1 ? 'Turma com Vagas Abertas' : 'Turmas com Vagas Abertas'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                      Lista de Espera Ativa
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Evolua seu jogo na {tenant.name}
                </h2>
                <p className="text-sm text-slate-300">
                  Turmas com quantidade limite pré-definida de alunos para máxima atenção e rendimento.
                  Foco principal no <strong className="text-amber-300">Futevôlei</strong>, além de Beach Tennis e Vôlei de Praia.
                </p>
              </div>

              {/* Dynamic Stats Pill */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0">
                <div className="text-center">
                  <span className="text-2xl sm:text-3xl font-black text-white block">
                    {arenaClasses.length}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Turmas Totais</span>
                </div>
                <div className="text-center border-x border-white/10 px-3">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 block">
                    {totalClassSpotsRemaining}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-300">Vagas Livres</span>
                </div>
                <div className="text-center col-span-2 sm:col-span-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 block">
                    {arenaStudents.length}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Alunos Ativos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Filters: Sport & Coach */}
          <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Sport Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Esporte:
              </span>
              <button
                type="button"
                onClick={() => setSelectedClassSportFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedClassSportFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({classesWithSpotsInfo.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedClassSportFilter('futevolei')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedClassSportFilter === 'futevolei'
                    ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-300'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                ⚽ Futevôlei (Foco Principal)
              </button>
              <button
                type="button"
                onClick={() => setSelectedClassSportFilter('beach_tennis')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedClassSportFilter === 'beach_tennis'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🎾 Beach Tennis
              </button>
              <button
                type="button"
                onClick={() => setSelectedClassSportFilter('volei_praia')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedClassSportFilter === 'volei_praia'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🏐 Vôlei de Praia
              </button>
            </div>

            {/* Coach Dropdown Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">
                Professor:
              </label>
              <select
                value={selectedCoachFilter}
                onChange={(e) => setSelectedCoachFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="all">Todos os Professores</option>
                {Array.from(new Set(classesWithSpotsInfo.map((c) => c.cls.coachName).filter(Boolean))).map((coach) => (
                  <option key={coach} value={coach}>
                    {coach}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Classes Cards Grid */}
          {(() => {
            const displayClasses = classesWithSpotsInfo.filter(({ cls }) => {
              const sportMatches = selectedClassSportFilter === 'all' || cls.sport === selectedClassSportFilter;
              const coachMatches = selectedCoachFilter === 'all' || cls.coachName === selectedCoachFilter;
              return sportMatches && coachMatches;
            });

            if (displayClasses.length === 0) {
              return (
                <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
                  <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-700">
                    Nenhuma turma encontrada para o filtro selecionado
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Tente selecionar outro esporte ou ver todas as turmas para encontrar sua aula ideal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassSportFilter('all');
                      setSelectedCoachFilter('all');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800"
                  >
                    Limpar Filtros
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayClasses.map(({ court, cls, maxStudents, enrolled, spotsRemaining, isAvailable }) => {
                  const percentFilled = Math.min(100, Math.round((enrolled / maxStudents) * 100));
                  const isAlmostFull = spotsRemaining > 0 && spotsRemaining <= 2;

                  return (
                    <div
                      key={cls.id}
                      className={`aquarium-glass rounded-3xl border p-5 shadow-xs transition-all flex flex-col justify-between gap-4 relative overflow-hidden group hover:shadow-md ${
                        isAvailable
                          ? isAlmostFull
                            ? 'bg-gradient-to-b from-amber-50/70 via-white to-white border-amber-300 ring-1 ring-amber-300/60'
                            : 'bg-white border-slate-200 hover:border-emerald-400'
                          : 'bg-slate-50/70 border-slate-200 opacity-90'
                      }`}
                    >
                      {/* Top Header: Sport Badge + Spots Urgency Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-[11px] font-black uppercase tracking-tight flex items-center gap-1">
                          {cls.sport === 'futevolei' && '⚽ Futevôlei'}
                          {cls.sport === 'beach_tennis' && '🎾 Beach Tennis'}
                          {cls.sport === 'volei_praia' && '🏐 Vôlei'}
                          {!cls.sport && '⚽ Futevôlei'}
                        </span>

                        {isAvailable ? (
                          isAlmostFull ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs animate-bounce">
                              🔥 ÚLTIMA${spotsRemaining > 1 ? 'S' : ''} ${spotsRemaining} VAGA${spotsRemaining > 1 ? 'S' : ''}!
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                              🟢 TEM VAGA (${spotsRemaining} livres)
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                            🔒 Lotação Máxima
                          </span>
                        )}
                      </div>

                      {/* Class Title & Details */}
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                          {cls.title}
                        </h3>

                        <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>Prof. <strong className="text-slate-900">{cls.coachName}</strong></span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-lg font-mono font-bold text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {cls.startTime} - {cls.endTime}
                          </span>
                          <span className="bg-slate-100 px-2.5 py-0.5 rounded-lg font-semibold text-slate-700">
                            {court.name}
                          </span>
                        </div>
                      </div>

                      {/* Capacity Bar & Limit (Dono pré-definido) */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">
                            Lotação ({enrolled}/{maxStudents} alunos)
                          </span>
                          <span className={`font-black ${isAvailable ? (isAlmostFull ? 'text-amber-600' : 'text-emerald-700') : 'text-slate-500'}`}>
                            {isAvailable ? `${spotsRemaining} vagas restantes` : 'Fila de espera'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full ${
                              !isAvailable
                                ? 'bg-slate-400'
                                : isAlmostFull
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentFilled}%` }}
                          />
                        </div>
                      </div>

                      {/* Pricing & CTA */}
                      <div className="pt-2 border-t border-slate-100 flex items-end justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mensalidade</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-900 font-mono">
                              R$ {cls.monthlyPrice}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">/mês</span>
                          </div>
                          {cls.dailyPrice && (
                            <span className="text-[10px] text-slate-500 block">
                              Avulsa: R$ {cls.dailyPrice}
                            </span>
                          )}
                        </div>

                        {isAvailable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClassForEnroll({ courtId: court.id, classConfig: cls });
                              setEnrollAuthorRole('aluno');
                              setStudentName(userProfile.name);
                              setStudentPhone(userProfile.phone);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Garantir Minha Vaga
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              triggerToast(
                                `📋 Você foi registrado na Lista de Espera da turma "${cls.title}". Avisaremos pelo WhatsApp ${userProfile.phone} assim que liberar uma vaga!`
                              );
                            }}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                          >
                            Fila de Espera
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Busca Regional por Horário ("Quero Terça e Quinta 7 às 8") */}
          <RegionalAvailabilityFinder />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: CAMPEONATOS DA ARENA (VISÃO DO JOGADOR VS MODO DONO)      */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'campeonatos' && (
        <div className="space-y-6">
          <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Campeonatos da Arena · {tenant.name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOwnerView
                  ? 'Painel do Dono da Arena: crie campeonatos, gerencie duplas, seedings e lance os resultados da chave.'
                  : 'Inscreva sua dupla com validação de categoria, realize o pagamento e acompanhe a chave ao vivo de forma minimalista.'}
              </p>
            </div>

            {isOwnerView && (
              <button
                type="button"
                onClick={() => setShowCreateTournModal(true)}
                className="px-4 py-2.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 shadow-sm"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                + Criar Campeonato na Arena
              </button>
            )}
          </div>

          {arenaTournaments.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
              <Trophy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Nenhum campeonato ativo nesta arena no momento.</p>
              {isOwnerView && (
                <button
                  type="button"
                  onClick={() => setShowCreateTournModal(true)}
                  className="mt-3 px-4 py-2 text-xs font-black text-white bg-[#FF6B00] rounded-xl hover:bg-[#e55f00] cursor-pointer"
                >
                  Criar Primeiro Campeonato
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {arenaTournaments.map((tourn) => {
                const pairsInTourn = registeredPairs.filter((p) => p.tournamentId === tourn.id);
                const isBracketOpen = selectedTournBracketId === tourn.id;

                return (
                  <div
                    key={tourn.id}
                    className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-black text-slate-900 uppercase">{sportNames[tourn.sport]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-800">
                            {TOURNAMENT_CATEGORY_LABELS[tourn.category]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Formato:{' '}
                            <strong>
                              {tourn.semiFormat === 'semi_direta'
                                ? 'Semifinal Direta (Padrão Futevôlei)'
                                : 'Semi com Chance (Challonge)'}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Data: {tourn.date}</span>
                        </div>

                        <h3 className="text-xl font-black text-slate-900">{tourn.name}</h3>
                        <p className="text-xs text-slate-500">
                          Responsável Técnico: <strong>{tourn.responsibleName}</strong> · Taxa:{' '}
                          <strong className="text-emerald-700 font-mono">
                            R$ {tourn.registrationFee.toFixed(2)} / dupla
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setRegisteringTournId(tourn.id)}
                          className="px-4 py-2.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          Inscrever Dupla & Pagar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTournamentId(tourn.id);
                            setSelectedTournBracketId(isBracketOpen ? null : tourn.id);
                          }}
                          className={`px-4 py-2.5 text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs ${
                            isBracketOpen
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <Trophy className="w-4 h-4 text-amber-300" />
                          {isBracketOpen
                            ? '▲ Ocultar Chave'
                            : isOwnerView
                            ? '⚙️ Administrar Chave'
                            : '🏆 Ver Chave do Torneio'}
                        </button>
                      </div>
                    </div>

                    {/* Registered Pairs Preview */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          Duplas Inscritas ({pairsInTourn.length} / {tourn.maxPairs})
                        </span>
                        <span className="text-slate-400">Atualizado em tempo real</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {pairsInTourn.map((pair) => (
                          <div
                            key={pair.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col justify-between gap-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-400 text-[10px]">
                                Seed #{pair.seed}
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                ✓ Pago ({pair.paymentMethod?.toUpperCase() || 'PIX'})
                              </span>
                            </div>
                            <div className="font-bold text-slate-900 truncate">
                              {pair.player1} & {pair.player2}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {ATHLETE_LEVEL_LABELS[pair.player1Level || 'iniciante']} +{' '}
                              {ATHLETE_LEVEL_LABELS[pair.player2Level || 'iniciante']}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Inline Double Elimination Bracket (Minimalist for player, full admin for owner) */}
                    {isBracketOpen && (
                      <div className="pt-6 border-t border-slate-200 space-y-4 animate-in fade-in">
                        <div className="flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-black uppercase tracking-wider">
                              {isOwnerView
                                ? '👑 Modo Dono: Gestão Completa de Chave & Súmula'
                                : '👤 Visão do Jogador: Chave Oficial Minimalista'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTournBracketId(null)}
                            className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                          >
                            ✕ Ocultar Chave
                          </button>
                        </div>

                        <DoubleEliminationBracket minimalistPlayerView={!isOwnerView} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: TRANSMISSÕES AO VIVO                                      */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'transmissoes' && (
        <div className="space-y-6">
          <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Transmissão Oficial Ao Vivo · {tenant.name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhe as partidas ao vivo da arena com placar oficial sincronizado e controle de transmissão.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto">
              <Radio className="w-3.5 h-3.5" />
              Sinal Ao Vivo 1080p
            </span>
          </div>

          <FreeBroadcastPanel key={tenant.id} arenaId={tenant.id} />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: RANKING OFICIAL DA ARENA                                   */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'ranking' && (
        <div className="space-y-6">
          <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  Ranking Oficial de Atletas · {tenant.name}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Classificação dos atletas homologados que competem e pontuam nesta arena.
              </p>
            </div>
          </div>

          <RankingBoard initialScope="arena" arenaOnly={true} />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: COMUNIDADE DA ARENA (VÍDEOS DE APRENDIZADO & TREINO)       */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'comunidade' && (
        <ArenaCommunityLearning tenant={tenant} />
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 6: INFORMAÇÕES SOBRE HORÁRIOS & HISTÓRICO DE PARTIDAS         */}
      {/* ===================================================================== */}
      {effectiveSubTab === 'info_historico' && (
        <ArenaInfoHistory tenant={tenant} />
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 7: ÁREA DO DONO DA ARENA (GESTÃO COMPLETA)                   */}
      {/* ===================================================================== */}
      {isOwnerView && effectiveSubTab === 'dono' && (
        <div className="space-y-6">
          {/* Dono Hub Overview Banner */}
          <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Painel do Dono da Arena · {tenant.name}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Ambiente isolado para administração de horários, preços de pico, turmas de aula, limite de vagas e campeonatos.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTournModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  + Criar Novo Campeonato
                </button>
                <button
                  type="button"
                  onClick={() => setShowWhiteLabelModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 cursor-pointer border border-white/10 transition-all"
                >
                  <Palette className="w-4 h-4 text-amber-300" />
                  Personalizar Marca & Paleta
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[11px]">Quadras Cadastradas</span>
                <span className="text-lg font-black text-white">{tenant.courts.length} quadras</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[11px]">Turmas Ativas</span>
                <span className="text-lg font-black text-amber-300">{arenaClasses.length} turmas</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[11px]">Alunos Matriculados</span>
                <span className="text-lg font-black text-emerald-400">{arenaStudents.length} alunos</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[11px]">Campeonatos da Arena</span>
                <span className="text-lg font-black text-sky-300">{arenaTournaments.length} torneios</span>
              </div>
            </div>
          </div>

          {/* Seção 1: Configuração de Preços, Horários de Pico e Dias da Semana */}
          <CourtPricingAdminPanel onTriggerToast={triggerToast} />

          {/* Seção 2: Formulário para Adicionar Nova Turma de Aulas com Limite Máximo de Alunos */}
          <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Criar Nova Turma de Aulas (com Limite Máximo de Alunos)
                </h3>
                <p className="text-xs text-slate-500">
                  Defina o limite de vagas para que o sistema exiba os cartões com "🟢 TEM VAGA" e atraia novos alunos.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddClassSchedule} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Título da Turma:</label>
                <input
                  type="text"
                  required
                  value={newClassTitle}
                  onChange={(e) => setNewClassTitle(e.target.value)}
                  placeholder="Ex: Treino Noturno Futevôlei"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Professor Responsável:</label>
                <input
                  type="text"
                  required
                  value={newClassCoach}
                  onChange={(e) => setNewClassCoach(e.target.value)}
                  placeholder="Ex: Prof. Renan Silva"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Quadra:</label>
                <select
                  value={newClassCourtId}
                  onChange={(e) => setNewClassCourtId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  {tenant.courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Esporte:</label>
                <select
                  value={newClassSport}
                  onChange={(e) => setNewClassSport(e.target.value as SportType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="futevolei">⚽ Futevôlei (Foco Principal)</option>
                  <option value="beach_tennis">🎾 Beach Tennis</option>
                  <option value="volei_praia">🏐 Vôlei de Praia</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Horário Início:</label>
                <input
                  type="text"
                  value={newClassStart}
                  onChange={(e) => setNewClassStart(e.target.value)}
                  placeholder="07:00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Horário Fim:</label>
                <input
                  type="text"
                  value={newClassEnd}
                  onChange={(e) => setNewClassEnd(e.target.value)}
                  placeholder="08:00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Valor Mensalidade (R$):</label>
                <input
                  type="number"
                  value={newClassMonthly}
                  onChange={(e) => setNewClassMonthly(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  🔥 Limite de Alunos (Capacidade):
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newClassMaxStudents}
                  onChange={(e) => setNewClassMaxStudents(parseInt(e.target.value, 10) || 8)}
                  className="w-full px-3 py-2 bg-amber-50 border-2 border-amber-400 rounded-xl font-black text-slate-900"
                />
                <span className="text-[10px] text-amber-800 font-bold mt-0.5 block">
                  Exibe "Restam X vagas" no topo da página
                </span>
              </div>

              <div className="lg:col-span-4 flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  Salvar Nova Turma com Limite de {newClassMaxStudents} Alunos
                </button>
              </div>
            </form>
          </div>

          {/* Busca Regional por Horário */}
          <RegionalAvailabilityFinder />

          {/* Top Due-Date & 2-Days-Before Automatic Notification Radar Banner */}
          {(() => {
            const studentsDueToday = findStudentsWithTuitionDueToday(arenaStudents, todayStr);
            const studentsDueIn2Days = findStudentsWithTuitionDueIn2Days(arenaStudents, todayStr);
            return (
              <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black uppercase text-[10px]">
                      MOTOR AUTOMÁTICO DE MENSALIDADES (D-2 & HOJE)
                    </span>
                    <span className="font-bold text-emerald-400">
                      Disparo automático via WhatsApp/Push 2 dias antes do vencimento com Link Direto de Renovação
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-white">
                    📲 {studentsDueIn2Days.length} Aluno(s) Vencem em 2 Dias (Link de Renovação) · 🔔 {studentsDueToday.length} Vencem Hoje
                  </h2>
                  <p className="text-xs text-slate-300">
                    O sistema identifica automaticamente a data de vencimento de cada aluno e envia 2 dias antes o aviso com <strong>link direto para renovação via PIX/Cartão</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const targets = studentsDueIn2Days.length > 0 ? studentsDueIn2Days : arenaStudents.slice(0, 1);
                      targets.forEach((s) => {
                        const notif = buildTuitionDueIn2DaysNotification(s, tenant.name);
                        pushSmartNotification(notif);
                      });
                      triggerToast(
                        `📲 Disparo Automático (2 Dias Antes) enviado via WhatsApp/Push com Link Direto de Renovação para ${targets.map((t) => t.studentName).join(', ')}!`
                      );
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <BellRing className="w-4 h-4" />
                    Disparar Aviso 2 Dias Antes + Link Renovação ({studentsDueIn2Days.length || 1})
                  </button>
                  {studentsDueToday.length > 0 && (
                    <button
                      onClick={() => {
                        studentsDueToday.forEach((s) => notifyStudentTuitionDue(s.id));
                        triggerToast(
                          `Avisos adicionados ao painel para ${studentsDueToday.length} aluno(s). Use o botão do WhatsApp para enviar a mensagem.`
                        );
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <BellRing className="w-4 h-4" />
                      Notificar Vencendo Hoje ({studentsDueToday.length})
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Active Classes Cards with Dual Enrollment Buttons */}
          <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Turmas & Aulas Ativas na {tenant.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Matricule alunos como <strong>Professor ou Dono da Arena</strong> e acompanhe o preenchimento de vagas.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700">
                Vínculo imediato à turma + início da mensalidade no ato da inscrição
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {arenaClasses.map(({ court, cls }) => {
                const enrolledInClass = arenaStudents.filter((s) => s.classId === cls.id);
                const paidInClass = enrolledInClass.filter((s) => s.paymentStatus === 'pago').length;
                return (
                  <div
                    key={cls.id}
                    className="border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 bg-slate-50/50 hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-900 font-black">
                          {cls.startTime} às {cls.endTime}
                        </span>
                        <span className="text-slate-500 font-semibold">
                          {court.name.split(' - ')[0]}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-950">{cls.title}</h3>
                      <p className="text-xs text-slate-600">
                        Professor: <strong className="text-slate-900">{cls.coachName}</strong> ·{' '}
                        <strong>
                          {enrolledInClass.length}/{cls.maxStudents} alunos
                        </strong>{' '}
                        ({paidInClass} em dia)
                      </p>
                      <div className="pt-1 text-xs text-slate-800 font-mono">
                        Mensalidade: <strong>R$ {cls.monthlyPrice}/mês</strong> · Aula avulsa:{' '}
                        <strong>R$ {cls.dailyPrice}</strong>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200/70">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            setEnrollAuthorRole('professor');
                            setBillingType('mensal');
                            setEnrollDateStr(todayStr);
                            setSelectedClassForEnroll({ courtId: court.id, classConfig: cls });
                          }}
                          className="py-2 px-2.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Prof: Matricular
                        </button>
                        <button
                          onClick={() => {
                            setEnrollAuthorRole('dono');
                            setBillingType('mensal');
                            setEnrollDateStr(todayStr);
                            setSelectedClassForEnroll({ courtId: court.id, classConfig: cls });
                          }}
                          className="py-2 px-2.5 text-[11px] font-bold text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Dono: Matricular
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {arenaClasses.length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-slate-400">
                  Nenhum horário de aula configurado nesta arena. Adicione turmas no formulário acima.
                </div>
              )}
            </div>
          </div>

          {/* Professor & Arena Owner Control Panel: Students, Classes, Due Dates & Monthly Fees */}
          <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                  PAINEL DO PROFESSOR & DONO DA ARENA
                </span>
                <h2 className="text-lg font-black text-slate-900">
                  Controle de Alunos, Vínculo de Turmas e Vencimento de Mensalidades
                </h2>
                <p className="text-xs text-slate-500">
                  A mensalidade inicia no dia da inscrição. No dia do vencimento, o sistema dispara notificação Push e WhatsApp para o aluno.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <div>
                  <span className="text-slate-500 block">Recebido (Pago):</span>
                  <span className="font-mono font-black text-sm text-emerald-700 tabular-nums">
                    R${' '}
                    {arenaStudents
                      .filter((s) => s.paymentStatus === 'pago')
                      .reduce((acc, s) => acc + s.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-500 block">A Receber / Vencendo:</span>
                  <span className="font-mono font-black text-sm text-amber-700 tabular-nums">
                    R${' '}
                    {arenaStudents
                      .filter((s) => s.paymentStatus === 'pendente')
                      .reduce((acc, s) => acc + s.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Filters for Professor & Owner */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setClassManagementRoleFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    classManagementRoleFilter === 'todos'
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos os Alunos ({arenaStudents.length})
                </button>
                <button
                  onClick={() => setClassManagementRoleFilter('vencendo_hoje')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    classManagementRoleFilter === 'vencendo_hoje'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔔 Vencendo Hoje ({findStudentsWithTuitionDueToday(arenaStudents, todayStr).length})
                </button>
                <button
                  onClick={() => setClassManagementRoleFilter('professor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    classManagementRoleFilter === 'professor'
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Visão do Professor
                </button>
                <button
                  onClick={() => setClassManagementRoleFilter('dono')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    classManagementRoleFilter === 'dono'
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Visão Financeira do Dono
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600">Filtrar Professor:</span>
                <select
                  value={selectedCoachFilter}
                  onChange={(e) => setSelectedCoachFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  <option value="all">Todos os Professores</option>
                  {Array.from(new Set(arenaClasses.map((c) => c.cls.coachName))).map((coach) => (
                    <option key={coach} value={coach}>
                      {coach}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Aluno & Origem Matrícula</th>
                    <th className="py-3 px-3">Turma Vinculada & Professor</th>
                    <th className="py-3 px-3">Início (Inscrição) & Vencimento</th>
                    <th className="py-3 px-3">Valor</th>
                    <th className="py-3 px-3">Status da Mensalidade</th>
                    <th className="py-3 px-3 text-right">Controle do Professor & Dono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {arenaStudents
                    .filter((stu) => {
                      if (selectedCoachFilter !== 'all' && stu.coachName !== selectedCoachFilter) {
                        return false;
                      }
                      if (classManagementRoleFilter === 'vencendo_hoje') {
                        const cycle = calculateStudentTuitionCycle(stu.enrolledAt, todayStr);
                        const isDue =
                          stu.paymentStatus === 'pendente' &&
                          (stu.nextDueDate === todayStr || cycle.isDueToday);
                        return isDue;
                      }
                      return true;
                    })
                    .map((stu) => {
                      const isPaid = stu.paymentStatus === 'pago';
                      const cycle = calculateStudentTuitionCycle(stu.enrolledAt, todayStr);
                      const effectiveDueDay = stu.dueDayOfMonth || cycle.dueDayOfMonth;
                      const effectiveNextDue = stu.nextDueDate || cycle.nextDueDate;
                      const isDueToday =
                        !isPaid &&
                        stu.billingType === 'mensal' &&
                        (effectiveNextDue === todayStr || effectiveDueDay === new Date().getDate());

                      const renewalLink = buildDirectTuitionRenewalLink(stu);
                      const waBillingMsg = `Olá ${stu.studentName}! Lembrete oficial da ${tenant.name}: sua mensalidade da turma "${stu.classTitle}" (${stu.coachName}) tem vencimento em ${effectiveNextDue} no valor de R$ ${stu.amount.toFixed(2)}. Link direto para renovação em 1 clique: ${renewalLink}`;
                      const waUrl = `https://wa.me/55${stu.studentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(waBillingMsg)}`;

                      const roleLabel =
                        stu.enrolledByRole === 'professor'
                          ? `Inscrito pelo Professor (${stu.enrolledByName || stu.coachName})`
                          : stu.enrolledByRole === 'dono'
                          ? 'Inscrito pelo Dono da Arena'
                          : 'Auto-Inscrição pelo Aluno';

                      return (
                        <tr
                          key={stu.id}
                          className={`transition-colors ${
                            isDueToday ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-3">
                            <span className="font-black text-slate-900 block text-xs">
                              {stu.studentName}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px] block">
                              {stu.studentPhone}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {roleLabel}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="font-bold text-slate-900 block">{stu.classTitle}</span>
                            <span className="text-slate-500 text-[11px]">
                              Prof: <strong>{stu.coachName}</strong> · {stu.classTime}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="font-semibold text-slate-800 block">
                              Início na inscrição: <strong className="font-mono">{stu.enrolledAt}</strong>
                            </span>
                            {stu.billingType === 'mensal' ? (
                              <span className="text-[11px] text-slate-600 block">
                                Vence todo <strong>dia {effectiveDueDay}</strong> · Próximo:{' '}
                                <strong className="font-mono">{effectiveNextDue}</strong>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 block">Diária Avulsa</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 font-mono font-black text-slate-900 tabular-nums">
                            R$ {stu.amount.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-3">
                            {isPaid ? (
                              <span className="font-black text-emerald-700 block">
                                ✓ Em Dia (Pago)
                              </span>
                            ) : isDueToday ? (
                              <div>
                                <span className="font-black text-rose-600 block">
                                  🔔 VENCE HOJE!
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {stu.lastDueNotificationAt
                                    ? `Notificado às ${stu.lastDueNotificationAt}`
                                    : 'Disparo de vencimento ativo'}
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-amber-700 block">
                                ⏳ Pendente
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  toggleClassStudentPayment(stu.id);
                                  triggerToast(
                                    isPaid
                                      ? `Status de ${stu.studentName} alterado para Pendente.`
                                      : `✅ Pagamento de ${stu.studentName} confirmado! Próximo ciclo renovado para +30 dias.`
                                  );
                                }}
                                className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
                                  isPaid
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    : 'bg-emerald-700 text-white hover:bg-emerald-800'
                                }`}
                              >
                                {isPaid ? 'Reabrir' : 'Dar Baixa (Pago)'}
                              </button>

                              <button
                                onClick={() => {
                                  notifyStudentTuitionDue(stu.id);
                                  triggerToast(
                                    `Aviso adicionado ao painel para ${stu.studentName}. Use o botão do WhatsApp para enviar a mensagem.`
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer transition-colors flex items-center gap-1"
                                title="Enviar notificação pro aluno avisando sobre o vencimento da mensalidade"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                Notificar Vencimento
                              </button>

                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Cobrar / Avisar vencimento via WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>

                              <button
                                onClick={() => removeStudentFromClass(stu.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Remover aluno da turma"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: QUICK 1-CLICK REGULAR COURT BOOKING                          */}
      {/* ===================================================================== */}
      {activeSlot && <QuickBookingPaymentModal slotData={{ arena: tenant, courtId: activeSlot.courtId, courtName: tenant.courts.find(c => c.id === activeSlot.courtId)?.name || '', date: activeSlot.date, time: activeSlot.startTime, endTime: activeSlot.endTime, price: activeSlot.price, sport: chosenSport }} onClose={() => setActiveSlot(null)} />}

      {/* ===================================================================== */}
      {/* MODAL 1B: WAITLIST FOR SOLD-OUT COURT SLOT (LISTA DE ESPERA)          */}
      {/* ===================================================================== */}
      {waitlistSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="aquarium-glass bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
            {(() => {
              const currentBooking = bookings.find(
                (b) =>
                  b.status === 'confirmed' &&
                  (b.id === waitlistSlot.slot.bookingId ||
                    (b.courtId === waitlistSlot.slot.courtId &&
                      b.date === waitlistSlot.slot.date &&
                      b.startTime === waitlistSlot.slot.startTime))
              );

              const slotQueue = waitlist
                .filter(
                  (w) =>
                    (w.slotId === waitlistSlot.slot.id ||
                      (w.courtId === waitlistSlot.slot.courtId &&
                        w.date === waitlistSlot.slot.date &&
                        w.startTime === waitlistSlot.slot.startTime)) &&
                    (w.status === 'waiting' || w.status === 'notified')
                )
                .sort((a, b) => a.position - b.position);

              return (
                <>
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md flex items-center justify-between pb-3 border-b border-slate-100 -mt-1 pt-1">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                        Horário Esgotado · Lista de Espera Automática
                      </span>
                      <h2 className="text-lg font-bold text-slate-900">
                        {waitlistSlot.court.name} ({waitlistSlot.slot.startTime} às {waitlistSlot.slot.endTime})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Data: {waitlistSlot.slot.date} · Caso a reserva atual seja cancelada, o 1º da fila é notificado automaticamente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWaitlistSlot(null)}
                      className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Current Occupant Info & Instant Cancellation Trigger for Testing */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Reserva Atual Neste Horário:</span>
                      <span className="font-bold text-slate-900">
                        {currentBooking
                          ? `${currentBooking.customerName} (${sportNames[currentBooking.sport]})`
                          : 'Reservado na Arena'}
                      </span>
                    </div>

                    {currentBooking && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setWaitlistSlot(null);
                            setActiveLiveBroadcastBookingId(currentBooking.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Ver/Alterar Partida & Transmitir Ao Vivo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelCurrentSlotBooking(currentBooking.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Cancela esta reserva e dispara notificação imediata para o 1º da Lista de Espera"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Cancelar Reserva
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Current Waitlist Queue for this Slot */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Fila de Espera Atual ({slotQueue.length} {slotQueue.length === 1 ? 'cliente' : 'clientes'}):
                      </span>
                      <span className="text-[11px] text-slate-400">Ordem de prioridade por chegada</span>
                    </div>

                    {slotQueue.length === 0 ? (
                      <div className="p-3 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        Ninguém na fila ainda. Seja o 1º da Lista de Espera para este horário!
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {slotQueue.map((entry) => (
                          <div
                            key={entry.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              entry.position === 1
                                ? 'bg-amber-50/70 border-amber-200 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-6 h-6 rounded-lg font-mono font-extrabold text-[11px] flex items-center justify-center ${
                                  entry.position === 1
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {entry.position}º
                              </span>
                              <div>
                                <span className="font-bold block">
                                  {entry.customerName}{' '}
                                  {entry.position === 1 && (
                                    <span className="text-[10px] font-extrabold text-amber-800 ml-1">
                                      (Próximo a ser notificado)
                                    </span>
                                  )}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  WhatsApp: {entry.customerPhone} · {sportNames[entry.sport]}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <a
                                href={generateWaitlistWhatsAppLink(entry)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Notificar via WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => leaveWaitlist(entry.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Sair da fila"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Form to Join the Waitlist in 1 Click */}
                  <form onSubmit={handleJoinWaitlistSubmit} className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                    <span className="font-bold text-slate-900 block">
                      Entrar na Lista de Espera ({slotQueue.length + 1}º lugar na fila):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Seu Nome:</label>
                        <input
                          type="text"
                          required
                          value={waitlistName}
                          onChange={(e) => setWaitlistName(e.target.value)}
                          placeholder="Nome do Atleta"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">WhatsApp p/ Alerta Automático:</label>
                        <input
                          type="tel"
                          required
                          value={waitlistPhone}
                          onChange={(e) => setWaitlistPhone(e.target.value)}
                          placeholder="(64) 99988-1122"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setWaitlistSlot(null)}
                        className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                      >
                        Fechar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <BellRing className="w-3.5 h-3.5 text-amber-300" />
                        Entrar na Lista de Espera
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: ENROLL CLIENT IN CLASS (ALUNO, PROFESSOR OU DONO + VENCIMENTO)*/}
      {/* ===================================================================== */}
      {selectedClassForEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="aquarium-glass bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md flex items-center justify-between pb-3 border-b border-slate-100 -mt-1 pt-1">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-700">
                    Vínculo de Turma & Início Imediato da Mensalidade
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    {selectedClassForEnroll.classConfig.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedClassForEnroll.classConfig.startTime} às {selectedClassForEnroll.classConfig.endTime} ·{' '}
                    Professor: <strong>{selectedClassForEnroll.classConfig.coachName}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClassForEnroll(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Quem está realizando a inscrição: Aluno, Professor ou Dono */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-bold text-slate-800">
                  Quem está realizando esta matrícula na turma?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEnrollAuthorRole('aluno')}
                    className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      enrollAuthorRole === 'aluno'
                        ? 'border-slate-950 bg-slate-950 text-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    1. Próprio Aluno
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollAuthorRole('professor')}
                    className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      enrollAuthorRole === 'professor'
                        ? 'border-slate-950 bg-slate-950 text-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    2. Professor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollAuthorRole('dono')}
                    className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                      enrollAuthorRole === 'dono'
                        ? 'border-slate-950 bg-slate-950 text-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    3. Dono da Arena
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Aluno:</label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Ex: Mariana Costa"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp do Aluno (p/ Alertas):</label>
                  <input
                    type="tel"
                    required
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="Ex: (64) 99988-1122"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data da Inscrição (A mensalidade começa neste dia):
                </label>
                <input
                  type="date"
                  value={enrollDateStr}
                  onChange={(e) => setEnrollDateStr(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                />
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  ✓ O aluno fica vinculado à turma e o vencimento mensal será todo{' '}
                  <strong>dia {enrollDateStr.split('-')[2] || new Date().getDate()}</strong> (com notificação automática no dia do vencimento).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Modalidade da Matrícula:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBillingType('mensal')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      billingType === 'mensal'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Plano Mensal da Turma</span>
                    <span className="text-sm font-extrabold font-mono text-amber-400">
                      R$ {selectedClassForEnroll.classConfig.monthlyPrice}/mês
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingType('diaria')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      billingType === 'diaria'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">Aula Diária (Avulsa)</span>
                    <span className="text-sm font-extrabold font-mono">
                      R$ {selectedClassForEnroll.classConfig.dailyPrice}/aula
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassForEnroll(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer shadow-xs"
                >
                  Confirmar Matrícula & Iniciar Ciclo Mensal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CREATE TOURNAMENT INSIDE ARENA                               */}
      {/* ===================================================================== */}
      {showCreateTournModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="aquarium-glass bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <form onSubmit={handleCreateTournamentSubmit} className="space-y-4">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md flex items-center justify-between pb-3 border-b border-slate-100 -mt-1 pt-1">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Criar Novo Campeonato na {tenant.name}</h3>
                  <p className="text-xs text-slate-500">Configure formato da semifinal, categoria e responsável técnico</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateTournModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Campeonato:</label>
                  <input
                    type="text"
                    required
                    value={tournName}
                    onChange={(e) => setTournName(e.target.value)}
                    placeholder="Ex: 2ª Copa SHARK SET de Futevôlei"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Esporte:</label>
                    <select
                      value={tournSport}
                      onChange={(e) => setTournSport(e.target.value as SportType)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="futevolei">Futevôlei</option>
                      <option value="beach_tennis">Beach Tennis</option>
                      <option value="volei_praia">Vôlei de Praia</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Categoria & Trava de Nível:</label>
                    <select
                      value={tournCategory}
                      onChange={(e) => setTournCategory(e.target.value as TournamentCategory)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {Object.entries(TOURNAMENT_CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Escolha do Formato da Semifinal (Futevôlei vs Challonge) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Regra da Semifinal (Eliminatória Dupla):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTournSemiFormat('semi_direta')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        tournSemiFormat === 'semi_direta'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="font-bold block">Semi Direta (Padrão Futevôlei)</span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        A partir da Semifinal ninguém pode perder mais (2 invictos vs 2 da repescagem em mata-mata).
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTournSemiFormat('semi_com_chance')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        tournSemiFormat === 'semi_com_chance'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="font-bold block">Semi com Chance (Challonge)</span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        Quem está na chave dos vencedores pode perder na semi/final e ainda cai pra repescagem.
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Data do Evento:</label>
                    <input
                      type="date"
                      required
                      value={tournDate}
                      onChange={(e) => setTournDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Taxa por Dupla (R$):</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={tournFee}
                      onChange={(e) => setTournFee(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Responsável Nomeado (Árbitro/Dono):
                    </label>
                    <input
                      type="text"
                      required
                      value={tournResponsible}
                      onChange={(e) => setTournResponsible(e.target.value)}
                      placeholder="Nome de quem lançará placares"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">WhatsApp do Responsável:</label>
                    <input
                      type="tel"
                      required
                      value={tournResponsiblePhone}
                      onChange={(e) => setTournResponsiblePhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTournModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Criar & Colocar Campeonato pra Rodar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: ONLINE REGISTRATION & PAYMENT WITH LEVEL VALIDATION          */}
      {/* ===================================================================== */}
      {activeRegisteringTourn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="aquarium-glass bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <form onSubmit={handleCompleteTournRegistration} className="space-y-4">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md flex items-center justify-between pb-3 border-b border-slate-100 -mt-1 pt-1">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">
                    Inscrição Online & Pagamento
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{activeRegisteringTourn.name}</h3>
                  <p className="text-xs text-slate-500">
                    Categoria: <strong>{TOURNAMENT_CATEGORY_LABELS[activeRegisteringTourn.category]}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRegisteringTournId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Player 1 Selection via EMAIL - NOME with locked profile category */}
              <AthleteEmailSelector
                label={isSinglesReg ? 'Atleta (Inscrição Individual)' : 'Atleta 1'}
                athletes={athletes}
                selectedEmail={regPlayer1Email}
                enrolledEmails={enrolledEmailsInTourn}
                onSelectAthlete={(athlete) => setRegPlayer1Email((athlete?.email || '').trim().toLowerCase())}
              />

              {/* Player 2 Selection via EMAIL - NOME with locked profile category */}
              {!isSinglesReg && (
                <AthleteEmailSelector
                  label="Atleta 2 (Parceiro de Dupla)"
                  athletes={athletes}
                  selectedEmail={regPlayer2Email}
                  excludeEmail={regPlayer1Email}
                  enrolledEmails={enrolledEmailsInTourn}
                  onSelectAthlete={(athlete) => setRegPlayer2Email((athlete?.email || '').trim().toLowerCase())}
                />
              )}

              {/* Real-time Category Validation Banner */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  regValidation.isValid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">{regValidation.reason}</span>
                  <span className="text-[11px] opacity-80 block mt-0.5">Regra: {regValidation.ruleSummary}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Forma de Pagamento da Inscrição:</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    R$ {activeRegisteringTourn.registrationFee.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRegPaymentMethod('pix')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-semibold cursor-pointer ${
                      regPaymentMethod === 'pix'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    PIX Instantâneo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegPaymentMethod('cartao')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-semibold cursor-pointer ${
                      regPaymentMethod === 'cartao'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Cartão de Crédito
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegisteringTournId(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!regValidation.isValid || isSubmittingTournReg}
                  className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    regValidation.isValid && !isSubmittingTournReg
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmittingTournReg
                    ? 'Confirmando Inscrição...'
                    : `Pagar R$ ${activeRegisteringTourn.registrationFee} & Confirmar Dupla`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWhiteLabelModal && (
        <ArenaWhiteLabelCustomizerModal onClose={() => setShowWhiteLabelModal(false)} />
      )}
    </div>
  );
};
