import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
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
} from '../services/smartAlertEngine';
import { generateBookingWhatsAppLink, generateWaitlistWhatsAppLink } from '../services/whatsappAdapter';
import {
  ATHLETE_LEVEL_LABELS,
  TOURNAMENT_CATEGORY_LABELS,
  validatePairCategory,
} from '../services/rankingValidator';
import {
  buildDefaultDayOfWeekPricing,
  WEEKDAY_FULL_NAMES,
} from '../data/initialData';
import { CourtPricingAdminPanel } from './CourtPricingAdminPanel';
import { RegionalAvailabilityFinder } from './RegionalAvailabilityFinder';
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
} from 'lucide-react';

export const CourtScheduler: React.FC = () => {
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
    createBooking,
    userProfile,
    setUserProfile,
    setActiveTab,
    arenaSubTab,
    setArenaSubTab,
    classStudents,
    enrollStudentInClass,
    toggleClassStudentPayment,
    simulateStudentDueToday,
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
  } = useApp();

  // Filter by specific court inside the arena agenda
  const [selectedCourtId, setSelectedCourtId] = useState<string>('all');

  // Date selection
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

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

  // Tournament Creation Form state
  const [showCreateTournModal, setShowCreateTournModal] = useState(false);
  const [tournName, setTournName] = useState('');
  const [tournSport, setTournSport] = useState<SportType>('futevolei');
  const [tournCategory, setTournCategory] = useState<TournamentCategory>('iniciante_serie_c');
  const [tournSemiFormat, setTournSemiFormat] = useState<SemiFormat>('semi_direta');
  const [tournDate, setTournDate] = useState('2026-10-24');
  const [tournFee, setTournFee] = useState(120);
  const [tournResponsible, setTournResponsible] = useState(userProfile.name);
  const [tournResponsiblePhone, setTournResponsiblePhone] = useState(userProfile.phone);

  // Quick Online Tournament Registration & Payment Modal inside Arena
  const [registeringTournId, setRegisteringTournId] = useState<string | null>(null);
  const [regPlayer1, setRegPlayer1] = useState(userProfile.name);
  const [regLevel1, setRegLevel1] = useState<AthleteLevel>(userProfile.level || 'serie_c');
  const [regPlayer2, setRegPlayer2] = useState('');
  const [regLevel2, setRegLevel2] = useState<AthleteLevel>('iniciante');
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
      const dateStr = d.toISOString().split('T')[0];
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

  const slotsForDate = useMemo(() => {
    return slots.filter((s) => s.date === selectedDate);
  }, [slots, selectedDate]);

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

  // Handle clicking on a slot in the court agenda
  const handleSlotClick = (slot: TimeSlot, court: Court) => {
    if (slot.slotType === 'class' && slot.classConfig) {
      setSelectedClassForEnroll({ courtId: court.id, classConfig: slot.classConfig });
      return;
    }

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

  // Confirm regular booking
  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlot || !customerName.trim() || !customerPhone.trim()) return;

    const newBooking = createBooking(activeSlot.id, chosenSport, customerName.trim(), customerPhone.trim());
    setUserProfile({ ...userProfile, name: customerName.trim(), phone: customerPhone.trim() });
    const waLink = generateBookingWhatsAppLink(newBooking, tenant.whatsapp, tenant.name);
    setBookingSuccessUrl(waLink);
  };

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

  // Cancel active booking directly from Waitlist modal to demonstrate automatic notification
  const handleCancelCurrentSlotBooking = (bookingId: string) => {
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
    setArenaSubTab('aulas');
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
      maxStudents: 12,
    });

    setNewClassTitle('');
    setNewClassCoach('');
    triggerToast('Novo horário fixo de aula adicionado à agenda da quadra!');
  };

  // Owner: Create Tournament
  const handleCreateTournamentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournName.trim()) return;

    const created = createTournament({
      name: tournName.trim(),
      sport: tournSport,
      category: tournCategory,
      semiFormat: tournSemiFormat,
      date: tournDate,
      registrationFee: tournFee,
      responsibleName: tournResponsible.trim() || 'Organizador',
      responsiblePhone: tournResponsiblePhone.trim() || tenant.whatsapp,
    });

    setTournName('');
    setShowCreateTournModal(false);
    triggerToast(`Campeonato "${created.name}" criado e liberado para inscrições!`);
  };

  // Client: Register & Pay for Tournament inside Arena
  const activeRegisteringTourn = tournaments.find((t) => t.id === registeringTournId);
  const regValidation = useMemo(() => {
    if (!activeRegisteringTourn) return { isValid: true, reason: '', ruleSummary: '' };
    return validatePairCategory(activeRegisteringTourn.category, regLevel1, regLevel2);
  }, [activeRegisteringTourn, regLevel1, regLevel2]);

  const handleCompleteTournRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRegisteringTourn || !regValidation.isValid) return;
    if (!regPlayer1.trim() || !regPlayer2.trim()) return;

    const newPair = registerDouble({
      tournamentId: activeRegisteringTourn.id,
      player1: regPlayer1.trim(),
      player1Level: regLevel1,
      player2: regPlayer2.trim(),
      player2Level: regLevel2,
      phone: regPhone.trim(),
      category: activeRegisteringTourn.category,
      paymentMethod: regPaymentMethod,
    });

    setRegPlayer2('');
    setRegisteringTournId(null);
    triggerToast(
      `Pagamento confirmado e Dupla #${newPair.seed} (${newPair.player1} & ${newPair.player2}) inscrita com sucesso!`
    );
  };

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

      {/* Arena Overview Header — High-Contrast SHARK SET Design with Arena Cover Image */}
      <div className="bg-slate-950 text-white border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Arena Photo Banner */}
          <div className="lg:col-span-4 relative min-h-[190px] bg-slate-900">
            <img
              src={
                tenant.imageUrl ||
                'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1000&q=85'
              }
              alt={tenant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
            <div className="absolute top-3 left-3">
              <button
                onClick={() => setActiveTab('arenas_directory')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-amber-400 text-xs font-black border border-white/15 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Trocar Arena
              </button>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
              <span className="font-black text-amber-400">★ {tenant.rating.toFixed(1)} Oficial</span>
              <span className="font-mono font-bold text-emerald-300">{tenant.distanceKm.toFixed(1)} km de você</span>
            </div>
          </div>

          {/* Arena Info & Sub-Navigation */}
          <div className="lg:col-span-8 p-6 flex flex-col justify-between space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold">{tenant.city}, {tenant.state}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>Funcionamento: <strong className="text-white">{tenant.operatingHours.open} às {tenant.operatingHours.close}</strong></span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-extrabold text-emerald-400">{tenant.courts.length} Quadras Disponíveis</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {tenant.name}
                </h1>
                <p className="text-xs text-slate-400">{tenant.address} · {tenant.amenities.join(' · ')}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1 shrink-0">
                <span className="text-amber-400 font-bold uppercase tracking-wider block text-[10px]">
                  Reserva sem Dúvidas (2 Cliques):
                </span>
                <span className="font-extrabold text-white text-xs block">
                  1º Clique no Horário Livre · 2º Pague no PIX/Cartão
                </span>
              </div>
            </div>

            {/* High-Visibility Sub-Navigation Inside the Arena */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setArenaSubTab('agenda')}
                className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  arenaSubTab === 'agenda'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                1. AGENDAR HORÁRIO & PAGAR ({tenant.courts.length} Quadras)
              </button>

              <button
                onClick={() => setArenaSubTab('aulas')}
                className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  arenaSubTab === 'aulas'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                2. AULAS & MENSALIDADES ({arenaStudents.length} Alunos)
              </button>

              <button
                onClick={() => setArenaSubTab('campeonatos')}
                className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  arenaSubTab === 'campeonatos'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4" />
                3. CAMPEONATOS DA ARENA ({arenaTournaments.length})
              </button>

              <button
                onClick={() => setArenaSubTab('config_dono')}
                className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                  arenaSubTab === 'config_dono'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                4. CONFIGURAR VALORES & HORÁRIOS (DONO)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: AGENDA DA ARENA (UMA AGENDA PARA CADA QUADRA)              */}
      {/* ===================================================================== */}
      {arenaSubTab === 'agenda' && (
        <div className="space-y-5">
          {/* Ultra-Intuitive 2-Step Strip */}
          <div className="bg-emerald-950 text-white rounded-2xl p-4 border border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                1
              </span>
              <div className="text-xs">
                <strong className="text-amber-300 block text-sm">Toque em qualquer horário verde abaixo para agendar e pagar</strong>
                <span className="text-emerald-200">
                  Sem cadastro complicado: escolha o horário, pague via PIX ou Cartão em 1 clique e sua quadra está reservada!
                </span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300 shrink-0">
              Confirmação Imediata
            </span>
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

          {/* Courts Schedule List */}
          <div className="space-y-5">
            {filteredCourts.map((court) => {
              const courtSlots = slotsForDate.filter((s) => s.courtId === court.id);
              const availableCount = courtSlots.filter((s) => s.isAvailable).length;
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
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
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
                      <button
                        type="button"
                        onClick={() => setArenaSubTab('config_dono')}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Configurar Preços (Pico / Dias)
                      </button>
                      <div className="text-xs text-slate-600 font-medium">
                        <span className="text-emerald-700 font-bold tabular-nums">{availableCount}</span> horários livres
                      </div>
                    </div>
                  </div>

                  {/* Slots Grid */}
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: AULAS, GESTÃO DE ALUNOS & MENSALIDADES (ALUNO/PROF/DONO)   */}
      {/* ===================================================================== */}
      {arenaSubTab === 'aulas' && (
        <div className="space-y-6">
          {/* Busca Regional por Horário ("Quero Terça e Quinta 7 às 8") */}
          <RegionalAvailabilityFinder />

          {/* Top Due-Date & 2-Days-Before Automatic Notification Radar Banner */}
          {(() => {
            const studentsDueToday = findStudentsWithTuitionDueToday(arenaStudents, todayStr);
            const studentsDueIn2Days = findStudentsWithTuitionDueIn2Days(arenaStudents, todayStr);
            return (
              <div className="bg-slate-950 text-white border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                          `🔔 Notificação de vencimento enviada via Push + WhatsApp para ${studentsDueToday.length} aluno(s) que vencem hoje!`
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

          {/* Active Classes Cards with Dual Enrollment Buttons (Aluno Self-Enroll vs Professor/Dono Enroll) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Turmas & Aulas Ativas na {tenant.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Escolha se deseja se inscrever como <strong>Aluno</strong> ou matricular um aluno como <strong>Professor / Dono da Arena</strong>.
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
                      <button
                        onClick={() => {
                          setEnrollAuthorRole('aluno');
                          setBillingType('mensal');
                          setEnrollDateStr(todayStr);
                          setSelectedClassForEnroll({ courtId: court.id, classConfig: cls });
                        }}
                        className="w-full py-2.5 px-3 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Sou Aluno: Inscrever-me nesta Turma
                      </button>

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
                  Nenhum horário de aula configurado nesta arena. Adicione horários na aba "Configurar Quadras & Valores".
                </div>
              )}
            </div>
          </div>

          {/* Professor & Arena Owner Control Panel: Students, Classes, Due Dates & Monthly Fees */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
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
                  {Array.from(new Set(arenaStudents.map((s) => s.coachName))).map((coach) => (
                    <option key={coach} value={coach}>
                      {coach}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                                    `🔔 Notificação de vencimento enviada para o aluno ${stu.studentName} (Push + WhatsApp)!`
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer transition-colors flex items-center gap-1"
                                title="Enviar notificação pro aluno avisando sobre o vencimento da mensalidade"
                              >
                                <BellRing className="w-3.5 h-3.5" />
                                Notificar Vencimento
                              </button>

                              {!isDueToday && (
                                <button
                                  onClick={() => {
                                    simulateStudentDueToday(stu.id);
                                    triggerToast(
                                      `📅 Vencimento de ${stu.studentName} simulado para HOJE (${todayStr}) e notificação enviada ao aluno!`
                                    );
                                  }}
                                  className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold cursor-pointer transition-colors text-[11px]"
                                  title="Simular que hoje é o dia do vencimento deste aluno e disparar notificação"
                                >
                                  Simular Vence Hoje
                                </button>
                              )}

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
      {/* SUB-TAB 3: CAMPEONATOS DA ARENA (CRIAR, INSCREVER, PAGAR E VER DUPLAS)*/}
      {/* ===================================================================== */}
      {arenaSubTab === 'campeonatos' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Campeonatos & Torneios em {tenant.name}</h2>
              <p className="text-xs text-slate-500">
                Crie campeonatos, libere inscrições com pagamento online, valide categorias (ex: Iniciante + Série C) e gerencie a tabela.
              </p>
            </div>

            <button
              onClick={() => setShowCreateTournModal(true)}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Criar Campeonato na Arena
            </button>
          </div>

          {/* List of Tournaments in this Arena */}
          <div className="space-y-5">
            {arenaTournaments.map((tourn) => {
              const pairsInTourn = registeredPairs.filter((p) => p.tournamentId === tourn.id);

              return (
                <div
                  key={tourn.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-slate-900 uppercase">{sportNames[tourn.sport]}</span>
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
                              : 'Semi com Chance (Padrão Challonge)'}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Data: {tourn.date}</span>
                      </div>

                      <h3 className="text-xl font-extrabold text-slate-900">{tourn.name}</h3>
                      <p className="text-xs text-slate-500">
                        Responsável pelo Campeonato: <strong>{tourn.responsibleName}</strong> · Taxa de Inscrição:{' '}
                        <strong className="text-emerald-700 font-mono">R$ {tourn.registrationFee.toFixed(2)} / dupla</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          setRegisteringTournId(tourn.id);
                        }}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        Inscrever Dupla & Pagar
                      </button>

                      <button
                        onClick={() => {
                          setActiveTournamentId(tourn.id);
                          setActiveTab('tournaments');
                        }}
                        className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Trophy className="w-4 h-4 text-amber-300" />
                        Abrir Tabela do Campeonato
                      </button>
                    </div>
                  </div>

                  {/* Registered Pairs Preview inside Arena Tournament Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        Duplas Inscritas & Confirmadas ({pairsInTourn.length} / {tourn.maxPairs})
                      </span>
                      <span className="text-slate-400">Atualizado em tempo real após pagamento</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      {pairsInTourn.map((pair) => (
                        <div
                          key={pair.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col justify-between gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-400 text-[10px]">Seed #{pair.seed}</span>
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: PAINEL ADMINISTRATIVO DO DONO (PREÇOS PICO & DIAS SEMANA)  */}
      {/* ===================================================================== */}
      {arenaSubTab === 'config_dono' && (
        <CourtPricingAdminPanel onTriggerToast={triggerToast} />
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: QUICK 1-CLICK REGULAR COURT BOOKING                          */}
      {/* ===================================================================== */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {!bookingSuccessUrl ? (
              <form onSubmit={handleConfirmBooking} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Reservar Horário</h2>
                    <p className="text-xs text-slate-500">
                      {tenant.name} · {activeSlot.date} às {activeSlot.startTime}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSlot(null)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-700">
                  <div>
                    <span className="font-semibold block text-slate-900">
                      {tenant.courts.find((c) => c.id === activeSlot.courtId)?.name}
                    </span>
                    <span className="text-slate-500">
                      Duração: 60 min ({activeSlot.startTime} - {activeSlot.endTime})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total</span>
                    <span className="text-base font-extrabold text-slate-900 tabular-nums">
                      R$ {activeSlot.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Esporte:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'futevolei' as SportType, label: '⚽ Futevôlei' },
                      { id: 'beach_tennis' as SportType, label: '🎾 Beach Tennis' },
                      { id: 'volei_praia' as SportType, label: '🏐 Vôlei Praia' },
                    ].map((sp) => (
                      <button
                        type="button"
                        key={sp.id}
                        onClick={() => setChosenSport(sp.id)}
                        className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                          chosenSport === sp.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Seu Nome:</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp:</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                {/* 1-Click Payment Method Selector */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Forma de Pagamento Rápido:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingPayMethod('pix')}
                      className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        bookingPayMethod === 'pix'
                          ? 'bg-slate-950 text-amber-400 border-slate-950'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      PIX Instantâneo
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingPayMethod('cartao')}
                      className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        bookingPayMethod === 'cartao'
                          ? 'bg-slate-950 text-amber-400 border-slate-950'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Cartão em 1 Clique
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSlot(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    PAGAR R$ {activeSlot.price.toFixed(2)} & RESERVAR AGORA
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reserva Confirmada!</h3>
                  <p className="text-xs text-slate-600 mt-1">Horário reservado na {tenant.name}.</p>
                </div>
                <div className="space-y-2 pt-2">
                  <a
                    href={bookingSuccessUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Enviar Comprovante no WhatsApp
                  </a>
                  <button
                    onClick={() => setActiveSlot(null)}
                    className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1B: WAITLIST FOR SOLD-OUT COURT SLOT (LISTA DE ESPERA)          */}
      {/* ===================================================================== */}
      {waitlistSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4 max-h-[90vh] overflow-y-auto">
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
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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
                      <button
                        type="button"
                        onClick={() => handleCancelCurrentSlotBooking(currentBooking.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                        title="Cancela esta reserva e dispara notificação imediata para o 1º da Lista de Espera"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Cancelar Reserva & Notificar 1º da Fila
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleCreateTournamentSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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
                      value={tournDate}
                      onChange={(e) => setTournDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Taxa por Dupla (R$):</label>
                    <input
                      type="number"
                      value={tournFee}
                      onChange={(e) => setTournFee(parseInt(e.target.value, 10) || 100)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleCompleteTournRegistration} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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

              {/* Player 1 + Ranking Level */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Atleta 1:</label>
                  <input
                    type="text"
                    required
                    value={regPlayer1}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegPlayer1(val);
                      const found = athletes.find((a) => a.name.toLowerCase() === val.toLowerCase());
                      if (found) setRegLevel1(found.level);
                    }}
                    placeholder="Nome do Atleta 1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ranking Atleta 1:</label>
                  <select
                    value={regLevel1}
                    onChange={(e) => setRegLevel1(e.target.value as AthleteLevel)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Player 2 + Ranking Level */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Atleta 2 (Parceiro):</label>
                  <input
                    type="text"
                    required
                    value={regPlayer2}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRegPlayer2(val);
                      const found = athletes.find((a) => a.name.toLowerCase() === val.toLowerCase());
                      if (found) setRegLevel2(found.level);
                    }}
                    placeholder="Nome do Parceiro"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ranking Atleta 2:</label>
                  <select
                    value={regLevel2}
                    onChange={(e) => setRegLevel2(e.target.value as AthleteLevel)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                  disabled={!regValidation.isValid}
                  className={`px-5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    regValidation.isValid
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Pagar R$ {activeRegisteringTourn.registrationFee} & Confirmar Dupla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
