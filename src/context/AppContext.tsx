import { BOOKING_DEMO } from '../services/bookingMode';
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  ArenaBrandPalette,
  AthleteAchievement,
  AthleteGameStats,
  AthleteLevel,
  AthleteMediaItem,
  AthleteProfile,
  Booking,
  BracketMatch,
  ClassEnrollmentAuthorRole,
  ClassScheduleConfig,
  ClassStudent,
  Court,
  ExperienceCategory,
  RankingMatchLog,
  SemiFormat,
  SportType,
  TeamPair,
  TenantConfig,
  TimeSlot,
  Tournament,
  TournamentCategory,
  TournamentModalityFormat,
  WaitlistEntry,
  WaitlistNotification,
} from '../types';
import { TENANTS } from '../data/tenants';

export const EMPTY_TENANT: TenantConfig = {
  id: '',
  name: 'Nenhuma Arena Cadastrada',
  city: '',
  state: '',
  address: '',
  distanceKm: 0,
  courts: [],
  operatingHours: { open: '06:00', close: '23:00' },
  amenities: [],
};

import {
  INITIAL_ATHLETES,
  INITIAL_BOOKINGS,
  INITIAL_CLASS_STUDENTS,
  INITIAL_PAIRS,
  INITIAL_RANKING_LOGS,
  INITIAL_TOURNAMENTS,
  INITIAL_WAITLIST,
  generateWeeklySlots,
  getInitialTournamentMatches,
} from '../data/initialData';
import {
  advanceWinner,
  buildDefaultRefereeState,
  createBracketForPresentPairs,
  createBuraco4Bracket,
  overrideMatchDetails,
  resetMatch,
} from '../services/bracketEngine';
import { generateWaitlistWhatsAppLink } from '../services/whatsappAdapter';
import { ATHLETE_LEVEL_LABELS, calculateFutevoleiMatchPoints } from '../services/rankingValidator';
import {
  buildBooking15MinReminderNotification,
  buildMatch10PointsRemainingNotification,
  buildTuitionDueTodayNotification,
  buildWaitlistFreedPushNotification,
  calculateStudentTuitionCycle,
  evaluateMatchNearCompletion,
} from '../services/smartAlertEngine';
import { useSharkStore } from '../store/useSharkStore';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { checkPlayerInactivity } from '../services/inactivityClient';
import { applyRankedActivity, resetInactiveProgress } from '../services/rankingActivity';

export type MainTab =
  | 'home'
  | 'live'
  | 'tournaments'
  | 'scheduler'
  | 'register_dupla'
  | 'arenas_directory'
  | 'saas_hub'
  | 'ranking_athletes'
  | 'shark_academy'
  | 'my_bookings';

export type ArenaSubTab =
  | 'agendamentos'
  | 'ranking'
  | 'campeonatos'
  | 'transmissoes'
  | 'comunidade'
  | 'info_historico'
  | 'dono'
  | 'agenda'
  | 'aulas'
  | 'config_dono';

interface AppContextType {
  resetAllDataToCleanSlate: () => void;
  applyTournamentEdit: (tournamentId: string, matches: BracketMatch[], teams?: TeamPair[]) => void;
  checkPlayerInactivity: () => Promise<void>;
  arenasMap: Record<string, TenantConfig>;
  tenant: TenantConfig;
  setTenantId: (id: string) => void;
  availableTenants: TenantConfig[];
  radiusKm: number;
  setRadiusKm: (km: number) => void;
  selectedSport: 'all' | SportType;
  setSelectedSport: (sport: 'all' | SportType) => void;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  arenaSubTab: ArenaSubTab;
  setArenaSubTab: (sub: ArenaSubTab) => void;
  slots: TimeSlot[];
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  waitlistNotifications: WaitlistNotification[];
  tournaments: Tournament[];
  activeTournamentId: string;
  setActiveTournamentId: (id: string) => void;
  tournamentMatches: BracketMatch[];
  matchesByTournament: Record<string, BracketMatch[]>;
  registeredPairs: TeamPair[];
  athletes: AthleteProfile[];
  rankingLogs: RankingMatchLog[];
  classStudents: ClassStudent[];
  userProfile: { name: string; phone: string; level: AthleteLevel };
  setUserProfile: (profile: { name: string; phone: string; level: AthleteLevel }) => void;
  focusMode: boolean;
  setFocusMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  toggleFocusMode: () => void;
  createBooking: (slotId: string, sport: SportType, customerName: string, customerPhone: string) => Booking;
  cancelBooking: (bookingId: string) => WaitlistEntry | null;
  joinWaitlist: (slotId: string, sport: SportType, customerName: string, customerPhone: string) => WaitlistEntry;
  leaveWaitlist: (waitlistId: string) => void;
  claimWaitlistSlot: (waitlistId: string) => Booking;
  dismissWaitlistNotification: (notificationId: string) => void;
  updateCourtConfig: (
    courtId: string,
    updates: Partial<
      Pick<
        Court,
        | 'name'
        | 'hourlyRate'
        | 'peakHourlyRate'
        | 'weekendNormalRate'
        | 'weekendPeakRate'
        | 'peakStartTime'
        | 'peakEndTime'
        | 'dayOfWeekPricing'
        | 'openTime'
        | 'closeTime'
        | 'isCovered'
      >
    >
  ) => void;
  applyPricingToAllArenaCourts: (sourceCourtId: string) => void;
  addClassScheduleToCourt: (courtId: string, classSchedule: Omit<ClassScheduleConfig, 'id'>) => void;
  removeClassScheduleFromCourt: (courtId: string, classId: string) => void;
  enrollStudentInClass: (data: {
    courtId: string;
    classConfig: ClassScheduleConfig;
    studentName: string;
    studentPhone: string;
    billingType: 'mensal' | 'diaria';
    enrolledAt?: string;
    enrolledByRole?: ClassEnrollmentAuthorRole;
    enrolledByName?: string;
  }) => ClassStudent;
  toggleClassStudentPayment: (studentId: string) => void;
  simulateStudentDueToday: (studentId: string) => ClassStudent | null;
  notifyStudentTuitionDue: (studentId: string) => void;
  removeStudentFromClass: (studentId: string) => void;
  createNewArenaTenant: (data: {
    name: string;
    city: string;
    state: string;
    whatsapp: string;
    courtsCount: number;
    plan: 'arena_pro_99' | 'pay_per_table_20';
    ownerName: string;
  }) => TenantConfig;
  createTournament: (data: {
    name: string;
    sport: SportType;
    category: TournamentCategory;
    modalityFormat?: TournamentModalityFormat;
    semiFormat: SemiFormat;
    date: string;
    location?: string;
    specificRules?: string;
    maxPairs?: number;
    registrationFee: number;
    responsibleName: string;
    responsiblePhone: string;
  }) => Tournament;
  updateTournamentConfig: (
    tournamentId: string,
    updates: Partial<
      Pick<
        Tournament,
        | 'name'
        | 'date'
        | 'location'
        | 'modalityFormat'
        | 'specificRules'
        | 'maxPairs'
        | 'semiFormat'
        | 'responsibleName'
        | 'responsiblePhone'
        | 'category'
      >
    >
  ) => void;
  registerDouble: (data: {
    tournamentId: string;
    player1: string;
    player1Level?: AthleteLevel;
    player2: string;
    player2Level?: AthleteLevel;
    phone: string;
    category: TournamentCategory;
    paymentMethod?: 'pix' | 'cartao' | 'arena';
    player1Paid?: boolean;
    player2Paid?: boolean;
  }) => TeamPair;
  togglePairPlayerPayment: (pairId: string, playerSlot: 1 | 2) => TeamPair | null;
  rejectPairEnrollment: (pairId: string, reason?: string) => TeamPair | null;
  restorePairEnrollment: (pairId: string) => TeamPair | null;
  togglePairPresence: (pairId: string) => void;
  startTournamentWithDraw: (
    tournamentId: string,
    drawMode: 'seeded' | 'random' | 'manual',
    manualSlotPairIds?: (string | '')[],
    onlyConfirmedPairs?: boolean
  ) => BracketMatch[];
  updateLiveRefereeMatch: (matchId: string, updater: (prev: BracketMatch) => BracketMatch) => void;
  liveSpectatorsCount: number;
  addOrUpdateAthlete: (data: {
    name: string;
    phone: string;
    birthDate?: string;
    experienceCategory?: ExperienceCategory;
    level: AthleteLevel;
    preferredSport: SportType;
    country?: string;
    state?: string;
    city: string;
    arenaId?: string;
    arenaName?: string;
    points?: number;
  }) => void;
  updateAthleteProfile: (
    athleteId: string,
    updates: Partial<
      Pick<
        AthleteProfile,
        | 'name'
        | 'phone'
        | 'birthDate'
        | 'experienceCategory'
        | 'courtSide'
        | 'dominantFoot'
        | 'bio'
        | 'country'
        | 'state'
        | 'city'
        | 'arenaId'
        | 'arenaName'
        | 'level'
      >
    >
  ) => void;
  updateAthleteGameStats: (athleteId: string, stats: AthleteGameStats) => void;
  addAthleteMedia: (athleteId: string, item: Omit<AthleteMediaItem, 'id' | 'createdAt'>) => void;
  removeAthleteMedia: (athleteId: string, mediaId: string) => void;
  addAthleteAchievement: (athleteId: string, achievement: Omit<AthleteAchievement, 'id'>) => void;
  removeAthleteAchievement: (athleteId: string, achievementId: string) => void;
  changeAthleteLevel: (athleteId: string, newLevel: AthleteLevel) => void;
  awardAthletePoints: (athleteId: string, pointsToAdd: number, addTitle?: boolean) => void;
  handleAdvanceMatch: (matchId: string, winningTeam: 1 | 2, score1: number, score2: number) => void;
  notifyLiveMatchProgress: (matchId: string, liveScore1: number, liveScore2: number) => string | null;
  handleResetMatch: (matchId: string) => void;
  handleOverrideMatch: (
    matchId: string,
    updates: { team1?: TeamPair; team2?: TeamPair; courtName?: string; scheduledTime?: string }
  ) => void;
  regenerateBracket: (tournamentId: string, customFormat?: SemiFormat) => void;
  updateArenaBranding: (
    targetTenantId: string,
    branding: {
      logoUrl?: string;
      whiteLabelEnabled?: boolean;
      brandPalette?: ArenaBrandPalette;
      name?: string;
      tagline?: string;
    }
  ) => void;
  updateBookingMatchSetup: (bookingId: string, updater: (prev: Booking) => Booking) => void;
  finishLiveBookingMatchAndCreditRanking: (
    bookingId: string,
    winningTeam: 1 | 2
  ) => { credited: boolean; message: string };
  activeLiveBroadcastBookingId: string | null;
  setActiveLiveBroadcastBookingId: (bookingId: string | null) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  tenantModalOpen: boolean;
  setTenantModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);


const isCleanSlate = () => {
  try {
    // Modo de produção limpo: se o usuário limpou ou não tem demo explícito, inicia 100% zerado
    return localStorage.getItem('sharkset_seed_demo') !== 'true';
  } catch {
    return true;
  }
};

const STORAGE_KEYS = {
  ARENAS: 'sharkset_v3_arenas',
  TENANT: 'sharkset_v1_tenant_id',
  BOOKINGS: 'sharkset_v2_bookings',
  WAITLIST: 'sharkset_v1_waitlist',
  TOURNAMENTS: 'sharkset_v5_tournaments',
  PAIRS: 'sharkset_v5_pairs',
  MATCHES: 'sharkset_v5_matches',
  ATHLETES: 'sharkset_v2_athletes',
  RANKING_LOGS: 'sharkset_v1_ranking_logs',
  CLASS_STUDENTS: 'sharkset_v2_class_students',
  USER_PROFILE: 'sharkset_v1_user_profile',
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      useSharkStore.getState().setFirebaseUserEmail(user?.email || null);
      if (user) void checkPlayerInactivity().catch(error => console.warn(error.message));
    });
    return () => unsubscribe();
  }, []);
  // Arenas state
  const [arenasMap, setArenasMap] = useState<Record<string, TenantConfig>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ARENAS);
      return stored ? JSON.parse(stored) : TENANTS;
    } catch {
      return TENANTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ARENAS, JSON.stringify(arenasMap));
  }, [arenasMap]);

  const [tenantId, setTenantIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.TENANT) || 'conflora';
  });

  const tenant = useMemo(() => {
    const list = Object.values(arenasMap);
    if (!list.length) return EMPTY_TENANT;
    return arenasMap[tenantId] || list[0] || EMPTY_TENANT;
  }, [arenasMap, tenantId]);

  const setTenantId = (id: string) => {
    if (arenasMap[id]) {
      setTenantIdState(id);
      localStorage.setItem(STORAGE_KEYS.TENANT, id);
    }
  };

  const availableTenants = useMemo(() => Object.values(arenasMap), [arenasMap]);

  // Location radius filter (in km)
  const [radiusKm, setRadiusKm] = useState<number>(50);

  // Sport Filter
  const [selectedSport, setSelectedSport] = useState<'all' | SportType>('all');

  // Navigation tabs — Clean Home ('home') with eye-catching highlights + Arenas + Torneios + Ranking
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [arenaSubTab, setArenaSubTab] = useState<ArenaSubTab>('agendamentos');

  // Modals & Palettes
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [activeLiveBroadcastBookingId, setActiveLiveBroadcastBookingId] = useState<string | null>(null);

  // User quick profile
  const [userProfile, setUserProfileState] = useState<{ name: string; phone: string; level: AthleteLevel }>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return stored ? JSON.parse(stored) : { name: 'Edmar Júnio', phone: '64999881122', level: 'serie_c' };
    } catch {
      return { name: 'Edmar Júnio', phone: '64999881122', level: 'serie_c' };
    }
  });

  const setUserProfile = (profile: { name: string; phone: string; level: AthleteLevel }) => {
    setUserProfileState(profile);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  };


  const resetAllDataToCleanSlate = () => {
    if (!window.confirm('Atenção: Isso irá apagar todo o histórico de teste em cache e iniciar o Sharkset completamente do zero. Deseja continuar?')) {
      return;
    }
    try {
      localStorage.clear();
      localStorage.setItem('sharkset_clean_slate', 'true');
    } catch {
      // ignore
    }
    setAthletes([]);
    setTournaments([]);
    setTournamentMatches([]);
    setRegisteredPairs([]);
    setBookings([]);
    setWaitlist([]);
    setRankingLogs([]);
    setClassStudents([]);
    window.location.reload();
  };

  // Focus Mode state (auto-activated in scheduler or broadcasts, or toggled manually)
  const [focusMode, setFocusModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sharkset_focus_mode') === 'true';
    } catch {
      return false;
    }
  });

  const setFocusMode = (mode: boolean | ((prev: boolean) => boolean)) => {
    setFocusModeState((prev) => {
      const next = typeof mode === 'function' ? mode(prev) : mode;
      try {
        localStorage.setItem('sharkset_focus_mode', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleFocusMode = () => setFocusMode((prev) => !prev);

  // Auto-activate focus mode on active broadcast studio
  useEffect(() => {
    if (activeLiveBroadcastBookingId) {
      setFocusMode(true);
    }
  }, [activeLiveBroadcastBookingId]);

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
      return stored ? JSON.parse(stored) : INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
  }, [bookings]);

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WAITLIST);
      return stored ? JSON.parse(stored) : INITIAL_WAITLIST;
    } catch {
      return INITIAL_WAITLIST;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WAITLIST, JSON.stringify(waitlist));
  }, [waitlist]);

  const [waitlistNotifications, setWaitlistNotifications] = useState<WaitlistNotification[]>([]);

  // Synchronize slots with active bookings
  const syncSlotsWithBookings = (rawSlots: TimeSlot[], currentBookings: Booking[]) => {
    return rawSlots.map((s) => {
      if (s.slotType === 'class') return s;
      const activeBook = currentBookings.find(
        (b) =>
          b.status === 'confirmed' &&
          b.courtId === s.courtId &&
          b.date === s.date &&
          b.startTime === s.startTime
      );
      if (activeBook) {
        return { ...s, isAvailable: false, bookingId: activeBook.id };
      }
      return s;
    });
  };

  const [slots, setSlots] = useState<TimeSlot[]>(() => {
    return syncSlotsWithBookings(generateWeeklySlots(tenant.courts), bookings);
  });

  useEffect(() => {
    setSlots(syncSlotsWithBookings(generateWeeklySlots(tenant.courts), bookings));
  }, [tenant]);

  // Athletes Ranking state
  const [athletes, setAthletes] = useState<AthleteProfile[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ATHLETES);
      return (stored ? JSON.parse(stored) : INITIAL_ATHLETES).map((athlete: AthleteProfile) => resetInactiveProgress(athlete));
    } catch {
      return INITIAL_ATHLETES;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATHLETES, JSON.stringify(athletes));
  }, [athletes]);

  // Ranking Match Logs state
  const [rankingLogs, setRankingLogs] = useState<RankingMatchLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RANKING_LOGS);
      return stored ? JSON.parse(stored) : INITIAL_RANKING_LOGS;
    } catch {
      return INITIAL_RANKING_LOGS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RANKING_LOGS, JSON.stringify(rankingLogs));
  }, [rankingLogs]);

  // Class Students state
  const [classStudents, setClassStudents] = useState<ClassStudent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CLASS_STUDENTS);
      return stored ? JSON.parse(stored) : INITIAL_CLASS_STUDENTS;
    } catch {
      return INITIAL_CLASS_STUDENTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLASS_STUDENTS, JSON.stringify(classStudents));
  }, [classStudents]);

  // Tournaments state
  const [tournaments, setTournaments] = useState<Tournament[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TOURNAMENTS);
      return stored ? JSON.parse(stored) : INITIAL_TOURNAMENTS;
    } catch {
      return INITIAL_TOURNAMENTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TOURNAMENTS, JSON.stringify(tournaments));
  }, [tournaments]);

  const [activeTournamentId, setActiveTournamentId] = useState<string>('tourn-conflora-1');

  // Registered Pairs state
  const [registeredPairs, setRegisteredPairs] = useState<TeamPair[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PAIRS);
      return stored ? JSON.parse(stored) : INITIAL_PAIRS;
    } catch {
      return INITIAL_PAIRS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAIRS, JSON.stringify(registeredPairs));
  }, [registeredPairs]);

  // Tournament Matches state
  const [tournamentMatches, setTournamentMatches] = useState<BracketMatch[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MATCHES);
      return stored ? JSON.parse(stored) : getInitialTournamentMatches();
    } catch {
      return getInitialTournamentMatches();
    }
  });

  const [liveSpectatorsCount, setLiveSpectatorsCount] = useState<number>(1);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(tournamentMatches));
  }, [tournamentMatches]);

  // Real-Time Synchronization via Server-Sent Events (SSE) + BroadcastChannel + Storage Event
  useEffect(() => {
    let es: EventSource | null = null;
    let bc: BroadcastChannel | null = null;

    const applyRemoteMatchUpdate = (payload: {
      matchId: string;
      score1: number;
      score2: number;
      status: BracketMatch['status'];
      liveReferee?: BracketMatch['liveReferee'];
      fullMatches?: BracketMatch[];
    }) => {
      if (payload.fullMatches && Array.isArray(payload.fullMatches)) {
        setTournamentMatches(payload.fullMatches);
        return;
      }
      if (!payload.matchId) return;
      setTournamentMatches((prev) =>
        prev.map((m) =>
          m.id === payload.matchId && m.status !== 'completed' && payload.status !== 'completed'
            ? {
                ...m,
                score1: payload.score1 ?? m.score1,
                score2: payload.score2 ?? m.score2,
                status: payload.status === 'in_progress' ? 'in_progress' : m.status,
                liveReferee: payload.liveReferee ?? m.liveReferee,
              }
            : m
        )
      );
    };

    try {
      es = new EventSource('/api/live-matches/stream');
      es.addEventListener('presence', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          if (typeof data.spectators === 'number') {
            setLiveSpectatorsCount(Math.max(1, data.spectators));
          }
        } catch {
          // Ignore malformed event
        }
      });
      es.addEventListener('match:updated', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          applyRemoteMatchUpdate(data);
        } catch {
          // Ignore malformed event
        }
      });
    } catch {
      // Fallback if SSE is unavailable
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('sharkset_live_bracket');
      bc.onmessage = (ev) => {
        if (ev.data) applyRemoteMatchUpdate(ev.data);
      };
    }

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.MATCHES && e.newValue) {
        try {
          setTournamentMatches(JSON.parse(e.newValue));
        } catch {
          // Ignore parse error
        }
      }
      if (e.key === STORAGE_KEYS.PAIRS && e.newValue) {
        try {
          setRegisteredPairs(JSON.parse(e.newValue));
        } catch {
          // Ignore parse error
        }
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => {
      es?.close();
      bc?.close();
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

  // Keyboard shortcut listener: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setTenantModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Create Booking
  const createBooking = (slotId: string, sport: SportType, customerName: string, customerPhone: string): Booking => {
    if (!BOOKING_DEMO) throw new Error('Reserva online indisponível. A arena deve confirmar o horário.');
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) throw new Error('Slot não encontrado');

    const court = tenant.courts.find((c) => c.id === slot.courtId);
    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      tenantId: tenant.id,
      arenaName: tenant.name,
      courtId: slot.courtId,
      courtName: court ? court.name : 'Quadra de Areia',
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sport,
      customerName,
      customerPhone,
      price: slot.price,
      status: 'confirmed',
      bookingKind: 'locacao',
      createdAt: new Date().toISOString(),
    };

    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, isAvailable: false, bookingId: newBooking.id } : s))
    );

    setWaitlist((prev) =>
      prev.map((w) =>
        w.slotId === slotId &&
        w.customerName.toLowerCase() === customerName.toLowerCase() &&
        (w.status === 'waiting' || w.status === 'notified')
          ? { ...w, status: 'converted' }
          : w
      )
    );

    setUserProfile({ ...userProfile, name: customerName, phone: customerPhone });
    setBookings((prev) => [newBooking, ...prev]);

    // Preview bookings remain local and never reach Firestore.

    // Automatically schedule/dispatch 15-minute pre-match reminder notification
    const reminderNotif = buildBooking15MinReminderNotification(newBooking, tenant.name);
    useSharkStore.getState().pushSmartNotification(reminderNotif);

    return newBooking;
  };

  // Cancel Booking & Automatically Notify Next Person in Waitlist (with Push Notification)
  const cancelBooking = (bookingId: string): WaitlistEntry | null => {
    if (!BOOKING_DEMO) throw new Error('Cancelamento online indisponível. Contate a arena.');
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking) return null;

    const targetSlotId = `slot-${targetBooking.courtId}-${targetBooking.date}-${targetBooking.startTime}`;

    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)));
    setSlots((prev) =>
      prev.map((s) =>
        s.bookingId === bookingId || s.id === targetSlotId
          ? { ...s, isAvailable: true, bookingId: undefined }
          : s
      )
    );

    const queueForSlot = waitlist
      .filter(
        (w) =>
          (w.slotId === targetSlotId ||
            (w.courtId === targetBooking.courtId &&
              w.date === targetBooking.date &&
              w.startTime === targetBooking.startTime)) &&
          w.status === 'waiting'
      )
      .sort((a, b) => a.position - b.position);

    if (queueForSlot.length > 0) {
      const nextCustomer = queueForSlot[0];
      const notifiedTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const updatedEntry: WaitlistEntry = {
        ...nextCustomer,
        status: 'notified',
        notifiedAt: notifiedTime,
      };

      setWaitlist((prev) => prev.map((w) => (w.id === nextCustomer.id ? updatedEntry : w)));

      const notification: WaitlistNotification = {
        id: `wnotif-${Date.now()}`,
        waitlistEntry: updatedEntry,
        cancelledByCustomer: targetBooking.customerName,
        whatsappLink: generateWaitlistWhatsAppLink(updatedEntry),
        timestamp: notifiedTime,
      };

      setWaitlistNotifications((prev) => [notification, ...prev]);

      // Dispatch Web Push Notification & Smart Alert for Waitlist Freed
      const pushNotif = buildWaitlistFreedPushNotification(updatedEntry);
      useSharkStore.getState().pushSmartNotification(pushNotif);

      return updatedEntry;
    }

    return null;
  };

  // Join Waitlist
  const joinWaitlist = (
    slotId: string,
    sport: SportType,
    customerName: string,
    customerPhone: string
  ): WaitlistEntry => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) throw new Error('Horário não encontrado');

    const court = tenant.courts.find((c) => c.id === slot.courtId);
    const activeInSlot = waitlist.filter(
      (w) => w.slotId === slotId && (w.status === 'waiting' || w.status === 'notified')
    );

    const newEntry: WaitlistEntry = {
      id: `wait-${Date.now()}`,
      tenantId: tenant.id,
      arenaName: tenant.name,
      slotId: slot.id,
      courtId: slot.courtId,
      courtName: court ? court.name : 'Quadra de Areia',
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price: slot.price,
      sport,
      customerName,
      customerPhone,
      position: activeInSlot.length + 1,
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };

    setWaitlist((prev) => [...prev, newEntry]);
    setUserProfile({ ...userProfile, name: customerName, phone: customerPhone });
    return newEntry;
  };

  const leaveWaitlist = (waitlistId: string) => {
    const target = waitlist.find((w) => w.id === waitlistId);
    if (!target) return;

    setWaitlist((prev) => {
      const filtered = prev.filter((w) => w.id !== waitlistId);
      let posCounter = 1;
      return filtered.map((w) => {
        if (w.slotId === target.slotId && (w.status === 'waiting' || w.status === 'notified')) {
          return { ...w, position: posCounter++ };
        }
        return w;
      });
    });
  };

  const claimWaitlistSlot = (waitlistId: string): Booking => {
    if (!BOOKING_DEMO) throw new Error('Reserva online indisponível. A arena deve confirmar o horário.');
    const entry = waitlist.find((w) => w.id === waitlistId);
    if (!entry) throw new Error('Registro da lista de espera não encontrado');

    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      tenantId: entry.tenantId,
      arenaName: entry.arenaName,
      courtId: entry.courtId,
      courtName: entry.courtName,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      sport: entry.sport,
      customerName: entry.customerName,
      customerPhone: entry.customerPhone,
      price: entry.price,
      status: 'confirmed',
      bookingKind: 'locacao',
      createdAt: new Date().toISOString(),
    };

    setSlots((prev) =>
      prev.map((s) =>
        s.id === entry.slotId ||
        (s.courtId === entry.courtId && s.date === entry.date && s.startTime === entry.startTime)
          ? { ...s, isAvailable: false, bookingId: newBooking.id }
          : s
      )
    );

    setWaitlist((prev) => {
      let posCounter = 1;
      return prev.map((w) => {
        if (w.id === waitlistId) {
          return { ...w, status: 'converted' as const };
        }
        if (w.slotId === entry.slotId && w.status === 'waiting') {
          return { ...w, position: posCounter++ };
        }
        return w;
      });
    });

    setWaitlistNotifications((prev) => prev.filter((n) => n.waitlistEntry.id !== waitlistId));
    setBookings((prev) => [newBooking, ...prev]);
    return newBooking;
  };

  const dismissWaitlistNotification = (notificationId: string) => {
    setWaitlistNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  // Owner: Update Court Configuration (including Peak Hours & Day-of-Week Pricing Matrix)
  const updateCourtConfig = (
    courtId: string,
    updates: Partial<
      Pick<
        Court,
        | 'name'
        | 'hourlyRate'
        | 'peakHourlyRate'
        | 'weekendNormalRate'
        | 'weekendPeakRate'
        | 'peakStartTime'
        | 'peakEndTime'
        | 'dayOfWeekPricing'
        | 'openTime'
        | 'closeTime'
        | 'isCovered'
      >
    >
  ) => {
    setArenasMap((prev) => {
      const currentArena = prev[tenant.id];
      if (!currentArena) return prev;
      const updatedCourts = currentArena.courts.map((c) => (c.id === courtId ? { ...c, ...updates } : c));
      return {
        ...prev,
        [tenant.id]: {
          ...currentArena,
          courts: updatedCourts,
        },
      };
    });
  };

  // Owner: Replicate pricing rules of a court across all courts in the current Arena
  const applyPricingToAllArenaCourts = (sourceCourtId: string) => {
    setArenasMap((prev) => {
      const currentArena = prev[tenant.id];
      if (!currentArena) return prev;
      const sourceCourt = currentArena.courts.find((c) => c.id === sourceCourtId);
      if (!sourceCourt) return prev;

      const updatedCourts = currentArena.courts.map((c) => ({
        ...c,
        hourlyRate: sourceCourt.hourlyRate,
        peakHourlyRate: sourceCourt.peakHourlyRate,
        weekendNormalRate: sourceCourt.weekendNormalRate,
        weekendPeakRate: sourceCourt.weekendPeakRate,
        peakStartTime: sourceCourt.peakStartTime,
        peakEndTime: sourceCourt.peakEndTime,
        openTime: sourceCourt.openTime,
        closeTime: sourceCourt.closeTime,
        dayOfWeekPricing: sourceCourt.dayOfWeekPricing
          ? JSON.parse(JSON.stringify(sourceCourt.dayOfWeekPricing))
          : undefined,
      }));

      return {
        ...prev,
        [tenant.id]: {
          ...currentArena,
          courts: updatedCourts,
        },
      };
    });
  };

  const addClassScheduleToCourt = (courtId: string, classSchedule: Omit<ClassScheduleConfig, 'id'>) => {
    const newCls: ClassScheduleConfig = {
      ...classSchedule,
      id: `cls-${Date.now()}`,
    };
    setArenasMap((prev) => {
      const currentArena = prev[tenant.id];
      if (!currentArena) return prev;
      const updatedCourts = currentArena.courts.map((c) => {
        if (c.id !== courtId) return c;
        return {
          ...c,
          classSchedules: [...(c.classSchedules || []), newCls],
        };
      });
      return {
        ...prev,
        [tenant.id]: {
          ...currentArena,
          courts: updatedCourts,
        },
      };
    });
  };

  const removeClassScheduleFromCourt = (courtId: string, classId: string) => {
    setArenasMap((prev) => {
      const currentArena = prev[tenant.id];
      if (!currentArena) return prev;
      const updatedCourts = currentArena.courts.map((c) => {
        if (c.id !== courtId) return c;
        return {
          ...c,
          classSchedules: (c.classSchedules || []).filter((cls) => cls.id !== classId),
        };
      });
      return {
        ...prev,
        [tenant.id]: {
          ...currentArena,
          courts: updatedCourts,
        },
      };
    });
  };

  const enrollStudentInClass = (data: {
    courtId: string;
    classConfig: ClassScheduleConfig;
    studentName: string;
    studentPhone: string;
    billingType: 'mensal' | 'diaria';
    enrolledAt?: string;
    enrolledByRole?: ClassEnrollmentAuthorRole;
    enrolledByName?: string;
  }): ClassStudent => {
    const court = tenant.courts.find((c) => c.id === data.courtId);
    const amount = data.billingType === 'mensal' ? data.classConfig.monthlyPrice : data.classConfig.dailyPrice;
    const enrollmentDate = data.enrolledAt || new Date().toISOString().split('T')[0];
    const cycle = calculateStudentTuitionCycle(enrollmentDate);

    const newStudent: ClassStudent = {
      id: `stu-${Date.now()}`,
      tenantId: tenant.id,
      courtId: data.courtId,
      courtName: court ? court.name : 'Quadra Principal',
      classId: data.classConfig.id,
      classTitle: data.classConfig.title,
      classTime: `${data.classConfig.startTime} às ${data.classConfig.endTime}`,
      coachName: data.classConfig.coachName,
      sport: data.classConfig.sport,
      studentName: data.studentName,
      studentPhone: data.studentPhone,
      billingType: data.billingType,
      amount,
      paymentStatus: 'pendente',
      enrolledAt: enrollmentDate,
      billingStartDate: cycle.billingStartDate,
      dueDayOfMonth: cycle.dueDayOfMonth,
      nextDueDate: cycle.nextDueDate,
      enrolledByRole: data.enrolledByRole || 'aluno',
      enrolledByName:
        data.enrolledByName ||
        (data.enrolledByRole === 'professor'
          ? data.classConfig.coachName
          : data.enrolledByRole === 'dono'
          ? 'Dono da Arena'
          : 'Auto-Matrícula pelo App'),
    };
    setClassStudents((prev) => [newStudent, ...prev]);

    // Se a mensalidade vence hoje (início no dia da inscrição), envia notificação automática pro aluno
    if (data.billingType === 'mensal' && cycle.isDueToday) {
      const notif = buildTuitionDueTodayNotification(newStudent, tenant.name);
      useSharkStore.getState().pushSmartNotification(notif);
    }

    return newStudent;
  };

  const toggleClassStudentPayment = (studentId: string) => {
    setClassStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const nextStatus = s.paymentStatus === 'pago' ? 'pendente' : 'pago';
        // Quando pago, avança o próximo vencimento em +1 mês mantendo o dia da inscrição
        let updatedNextDue = s.nextDueDate;
        if (nextStatus === 'pago' && s.billingType === 'mensal') {
          const baseStr = s.nextDueDate || s.enrolledAt;
          const [y, m, d] = baseStr.split('-').map((n) => parseInt(n, 10));
          const nextMonth = m === 12 ? 1 : m + 1;
          const nextYear = m === 12 ? y + 1 : y;
          const maxDay = new Date(nextYear, nextMonth, 0).getDate();
          const day = Math.min(s.dueDayOfMonth || d || 1, maxDay);
          updatedNextDue = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        return { ...s, paymentStatus: nextStatus, nextDueDate: updatedNextDue };
      })
    );
  };

  const simulateStudentDueToday = (studentId: string): ClassStudent | null => {
    const todayIso = new Date().toISOString().split('T')[0];
    const todayDay = new Date().getDate();
    let targetStudent: ClassStudent | null = null;

    setClassStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const updated: ClassStudent = {
          ...s,
          billingType: 'mensal',
          paymentStatus: 'pendente',
          dueDayOfMonth: todayDay,
          nextDueDate: todayIso,
          lastDueNotificationAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        targetStudent = updated;
        return updated;
      })
    );

    if (targetStudent) {
      const notif = buildTuitionDueTodayNotification(targetStudent, tenant.name);
      useSharkStore.getState().pushSmartNotification(notif);
    }
    return targetStudent;
  };

  const notifyStudentTuitionDue = (studentId: string) => {
    const stu = classStudents.find((s) => s.id === studentId);
    if (!stu) return;
    const notif = buildTuitionDueTodayNotification(stu, tenant.name);
    useSharkStore.getState().pushSmartNotification(notif);
    setClassStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              lastDueNotificationAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            }
          : s
      )
    );
  };

  const removeStudentFromClass = (studentId: string) => {
    setClassStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const createNewArenaTenant = (data: {
    name: string;
    city: string;
    state: string;
    whatsapp: string;
    courtsCount: number;
    plan: 'arena_pro_99' | 'pay_per_table_20';
    ownerName: string;
  }): TenantConfig => {
    const id = `arena-${Date.now()}`;
    const count = Math.max(1, Math.min(12, data.courtsCount || 3));
    const courts: Court[] = Array.from({ length: count }).map((_, idx) => ({
      id: `${id}-q${idx + 1}`,
      name: `Quadra ${idx + 1} - ${data.name}`,
      description: 'Areia Quartzosa Tratada · Iluminação LED Pro',
      sports: ['futevolei', 'beach_tennis', 'volei_praia'],
      surface: 'Areia Quartzosa Premium',
      isCovered: idx === 0,
      hasLighting: true,
      hourlyRate: 80,
      peakHourlyRate: 110,
      weekendNormalRate: 95,
      weekendPeakRate: 120,
      peakStartTime: '18:00',
      peakEndTime: '22:00',
      openTime: '06:00',
      closeTime: '23:00',
      classSchedules: [
        {
          id: `cls-${id}-${idx + 1}`,
          startTime: '07:00',
          endTime: '08:00',
          title: `Turma Futevôlei Evolução Q${idx + 1}`,
          coachName: `Prof. ${data.ownerName.split(' ')[0]}`,
          sport: 'futevolei',
          monthlyPrice: 220,
          dailyPrice: 45,
          maxStudents: 12,
        },
      ],
    }));

    const newTenant: TenantConfig = {
      id,
      name: data.name,
      tagline: data.plan === 'arena_pro_99' ? 'Arena Oficial Plano Mensal R$ 99' : 'Arena Parceira SHARK SET',
      city: data.city,
      state: data.state.toUpperCase(),
      address: `Centro Esportivo · ${data.city} - ${data.state.toUpperCase()}`,
      distanceKm: 2.5,
      rating: 5.0,
      whatsapp: data.whatsapp,
      primaryColor: '#0f172a',
      accentColor: '#fbbf24',
      sandBg: '#f8fafc',
      amenities: ['Wi-Fi', 'Bar & Grill', 'Vestiários', 'Placar Ao Vivo SHARK SET'],
      courts,
      operatingHours: { open: '06:00', close: '23:00' },
      subscriptionPlan: data.plan,
      monthlyPlanPrice: data.plan === 'arena_pro_99' ? 99 : 20,
      ownerName: data.ownerName,
    };

    setArenasMap((prev) => ({
      ...prev,
      [id]: newTenant,
    }));
    setTenantIdState(id);
    localStorage.setItem(STORAGE_KEYS.TENANT, id);
    return newTenant;
  };

  // Create Tournament (Supports Location, Modality Format Simples/Duplas, Specific Rules, Max Participants)
  const createTournament = (data: {
    name: string;
    sport: SportType;
    category: TournamentCategory;
    modalityFormat?: TournamentModalityFormat;
    semiFormat: SemiFormat;
    date: string;
    location?: string;
    specificRules?: string;
    maxPairs?: number;
    registrationFee: number;
    responsibleName: string;
    responsiblePhone: string;
  }): Tournament => {
    const newTourn: Tournament = {
      id: `tourn-${Date.now()}`,
      tenantId: tenant.id,
      name: data.name,
      sport: data.sport,
      category: data.category,
      modalityFormat: data.modalityFormat || 'duplas',
      semiFormat: data.semiFormat,
      date: data.date,
      location: data.location || `${tenant.name} (${tenant.city} - ${tenant.state})`,
      specificRules:
        data.specificRules ||
        'Sets de 18 pontos (diferença mínima de 2 pontos). Semifinal conforme formato escolhido. Pontuação oficial para o Ranking de Futevôlei.',
      format: 'double_elimination_buraco4',
      description: `Torneio oficial em ${data.location || tenant.name}. Responsável técnico: ${data.responsibleName}.`,
      maxPairs: data.maxPairs || 8,
      registrationFee: data.registrationFee,
      responsibleName: data.responsibleName,
      responsiblePhone: data.responsiblePhone,
      isOpenForRegistration: true,
      isFinished: false,
    };

    setTournaments((prev) => [newTourn, ...prev]);
    setActiveTournamentId(newTourn.id);

    const emptyMatches = createBuraco4Bracket(newTourn.id, [], newTourn.semiFormat);
    setTournamentMatches((prev) => [...prev, ...emptyMatches]);

    return newTourn;
  };

  const updateTournamentConfig = (
    tournamentId: string,
    updates: Partial<
      Pick<
        Tournament,
        | 'name'
        | 'date'
        | 'location'
        | 'modalityFormat'
        | 'specificRules'
        | 'maxPairs'
        | 'semiFormat'
        | 'responsibleName'
        | 'responsiblePhone'
        | 'category'
      >
    >
  ) => {
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? { ...t, ...updates } : t)));

    // Editing the tournament description must never regenerate and erase played matches.
    // A new draw is an explicit operation with its previous version archived.
  };

  // Register Pair or Singles Participant: Guarantees spot immediately as 'pending' until BOTH players pay
  const registerDouble = (data: {
    tournamentId: string;
    player1: string;
    player1Level?: AthleteLevel;
    player2: string;
    player2Level?: AthleteLevel;
    phone: string;
    category: TournamentCategory;
    paymentMethod?: 'pix' | 'cartao' | 'arena';
    player1Paid?: boolean;
    player2Paid?: boolean;
  }): TeamPair => {
    const pairsInTourn = registeredPairs.filter(
      (p) => p.tournamentId === data.tournamentId && p.enrollmentStatus !== 'rejected'
    );
    const nextSeed = pairsInTourn.length + 1;
    const p1Paid = data.player1Paid ?? false;
    const p2Paid = data.player2Paid ?? false;
    const bothPaid = p1Paid && p2Paid;

    const newPair: TeamPair = {
      id: `pair-${Date.now()}`,
      tournamentId: data.tournamentId,
      player1: data.player1,
      player1Level: data.player1Level || 'iniciante',
      player2: data.player2,
      player2Level: data.player2Level || 'iniciante',
      phone: data.phone,
      category: data.category,
      seed: nextSeed,
      isPaid: bothPaid,
      player1Paid: p1Paid,
      player2Paid: p2Paid,
      enrollmentStatus: bothPaid ? 'confirmed' : 'pending',
      refundStatus: 'none',
      isPresent: true,
      paymentMethod: data.paymentMethod || 'pix',
      registeredAt: new Date().toLocaleString('pt-BR'),
    };

    const updatedAllPairs = [...registeredPairs, newPair];
    setRegisteredPairs(updatedAllPairs);

    const tourn = tournaments.find((t) => t.id === data.tournamentId);
    const updatedTournPairs = updatedAllPairs.filter(
      (p) => p.tournamentId === data.tournamentId && p.enrollmentStatus !== 'rejected'
    );
    const rebuilt = createBuraco4Bracket(
      data.tournamentId,
      updatedTournPairs,
      tourn?.semiFormat || 'semi_direta'
    );
    setTournamentMatches((prev) => [
      ...prev.filter((m) => m.tournamentId !== data.tournamentId),
      ...rebuilt,
    ]);

    return newPair;
  };

  // Toggle individual payment of Player 1 or Player 2; confirms spot ONLY when both players have paid
  const togglePairPlayerPayment = (pairId: string, playerSlot: 1 | 2): TeamPair | null => {
    let updatedItem: TeamPair | null = null;
    setRegisteredPairs((prev) =>
      prev.map((p) => {
        if (p.id !== pairId) return p;
        const isSinglesPair = p.player2.toLowerCase() === 'individual (1x1)';
        const nextP1 = playerSlot === 1 ? !p.player1Paid : !!p.player1Paid;
        const nextP2 = isSinglesPair
          ? nextP1
          : playerSlot === 2
          ? !p.player2Paid
          : !!p.player2Paid;
        const bothPaid = nextP1 && nextP2;

        // If previously rejected, keep rejected unless restored; otherwise 'confirmed' iff bothPaid
        const nextStatus =
          p.enrollmentStatus === 'rejected'
            ? 'rejected'
            : bothPaid
            ? 'confirmed'
            : 'pending';

        updatedItem = {
          ...p,
          player1Paid: nextP1,
          player2Paid: nextP2,
          isPaid: bothPaid,
          enrollmentStatus: nextStatus,
        };
        return updatedItem;
      })
    );
    return updatedItem;
  };

  // Admin can reject a spot at any time; if any player paid, flags automatic refund ('refunded')
  const rejectPairEnrollment = (pairId: string, reason?: string): TeamPair | null => {
    let rejectedPair: TeamPair | null = null;
    const nextPairs = registeredPairs.map((p) => {
      if (p.id !== pairId) return p;
      const hadAnyPayment = !!p.player1Paid || !!p.player2Paid || !!p.isPaid;
      rejectedPair = {
        ...p,
        enrollmentStatus: 'rejected',
        isPresent: false,
        refundStatus: hadAnyPayment ? 'refunded' : 'none',
        rejectionReason:
          reason ||
          (hadAnyPayment
            ? 'Vaga recusada pelo Admin — Valor pago ressarcido aos atletas.'
            : 'Vaga recusada pelo Admin.'),
      };
      return rejectedPair;
    });

    setRegisteredPairs(nextPairs);

    if (rejectedPair) {
      const tId = (rejectedPair as TeamPair).tournamentId;
      const tourn = tournaments.find((t) => t.id === tId);
      const activeTournPairs = nextPairs.filter(
        (p) => p.tournamentId === tId && p.enrollmentStatus !== 'rejected'
      );
      const rebuilt = createBuraco4Bracket(tId, activeTournPairs, tourn?.semiFormat || 'semi_direta');
      setTournamentMatches((prev) => [...prev.filter((m) => m.tournamentId !== tId), ...rebuilt]);
    }

    return rejectedPair;
  };

  // Admin can restore a rejected pair back to active
  const restorePairEnrollment = (pairId: string): TeamPair | null => {
    let restored: TeamPair | null = null;
    const nextPairs = registeredPairs.map((p) => {
      if (p.id !== pairId) return p;
      const bothPaid = !!p.player1Paid && !!p.player2Paid;
      restored = {
        ...p,
        enrollmentStatus: bothPaid ? 'confirmed' : 'pending',
        refundStatus: 'none',
        rejectionReason: undefined,
        isPresent: true,
      };
      return restored;
    });

    setRegisteredPairs(nextPairs);
    return restored;
  };

  const togglePairPresence = (pairId: string) => {
    setRegisteredPairs((prev) =>
      prev.map((p) => (p.id === pairId ? { ...p, isPresent: p.isPresent === false ? true : false } : p))
    );
  };

  // Start tournament & build bracket for present pairs with either Random Draw or Manual Placement
  const startTournamentWithDraw = (
    tournamentId: string,
    drawMode: 'seeded' | 'random' | 'manual',
    manualSlotPairIds?: (string | '')[],
    onlyConfirmedPairs: boolean = true
  ): BracketMatch[] => {
    const tourn = tournaments.find((t) => t.id === tournamentId);
    const eligiblePairs = registeredPairs.filter((p) => {
      if (p.tournamentId !== tournamentId) return false;
      if (p.enrollmentStatus === 'rejected') return false;
      if (p.isPresent === false) return false;
      if (onlyConfirmedPairs && p.enrollmentStatus !== 'confirmed') return false;
      return true;
    });

    if (tourn && eligiblePairs.length > tourn.maxPairs) throw new Error('Número de duplas excede o limite do torneio.');
    const generatedMatches = createBracketForPresentPairs(
      tournamentId,
      eligiblePairs,
      tourn?.semiFormat || 'semi_direta',
      drawMode,
      manualSlotPairIds
    );

    // Initialize Referee state on Round 1 ready matches
    const withReferee = generatedMatches.map((m) =>
      m.team1 && m.team2 && m.status !== 'completed'
        ? { ...m, liveReferee: buildDefaultRefereeState(m, tourn?.responsibleName || 'Árbitro SHARK SET') }
        : m
    );

    applyTournamentEdit(tournamentId, withReferee);

    return withReferee;
  };

  // Update Live Referee Match State & Broadcast in Real Time to all Spectators on the Bracket Page
  const updateLiveRefereeMatch = (matchId: string, updater: (prev: BracketMatch) => BracketMatch) => {
    setTournamentMatches((prev) => {
      let updatedTarget: BracketMatch | null = null;
      const nextList = prev.map((m) => {
        if (m.id !== matchId || m.status === 'completed') return m;
        const base = m.liveReferee ? m : { ...m, liveReferee: buildDefaultRefereeState(m) };
        updatedTarget = updater(base);
        return updatedTarget;
      });

      if (updatedTarget) {
        const target = updatedTarget as BracketMatch;
        const payload = {
          matchId: target.id,
          tournamentId: target.tournamentId,
          score1: target.score1 ?? 0,
          score2: target.score2 ?? 0,
          status: target.status,
          liveReferee: target.liveReferee,
        };

        fetch('/api/live-matches/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('sharkset_live_bracket');
          bc.postMessage(payload);
          bc.close();
        }
      }

      return nextList;
    });
  };

  // Athlete Profile & Ranking Management
  const addOrUpdateAthlete = (data: {
    name: string;
    phone: string;
    birthDate?: string;
    experienceCategory?: ExperienceCategory;
    level: AthleteLevel;
    preferredSport: SportType;
    country?: string;
    state?: string;
    city: string;
    arenaId?: string;
    arenaName?: string;
    points?: number;
  }) => {
    const newAth: AthleteProfile = {
      id: `ath-${Date.now()}`,
      name: data.name,
      phone: data.phone,
      birthDate: data.birthDate || '1997-05-10',
      experienceCategory: data.experienceCategory || (data.level === 'profissional' ? 'profissional' : 'amador'),
      courtSide: 'Ambos',
      dominantFoot: 'Destro',
      bio: `Atleta SHARK SET de ${data.preferredSport === 'futevolei' ? 'Futevôlei' : 'Areia'} (${data.city}).`,
      level: data.level,
      highestHistoricalLevel: data.level,
      points: 0,
      titlesCount: 0,
      matchesPlayed: 0,
      wins: 0,
      stats: {
        aces: 5,
        errors: 2,
        sharkAttacks: 2,
        pingoPoints: 8,
        defenses: 14,
      },
      mediaGallery: [],
      achievements: [],
      preferredSport: data.preferredSport,
      country: data.country || 'Brasil',
      state: data.state || tenant.state || 'GO',
      city: data.city,
      arenaId: data.arenaId || tenant.id,
      arenaName: data.arenaName || tenant.name,
    };
    setAthletes((prev) => [newAth, ...prev]);
  };

  const updateAthleteProfile = (
    athleteId: string,
    updates: Partial<
      Pick<
        AthleteProfile,
        | 'name'
        | 'phone'
        | 'birthDate'
        | 'experienceCategory'
        | 'courtSide'
        | 'dominantFoot'
        | 'bio'
        | 'country'
        | 'state'
        | 'city'
        | 'arenaId'
        | 'arenaName'
        | 'level'
      >
    >
  ) => {
    setAthletes((prev) =>
      prev.map((a) => {
        if (a.id !== athleteId) return a;
        const updated = { ...a, ...updates };
        if (a.name.toLowerCase() === userProfile.name.toLowerCase()) {
          setUserProfile({
            name: updated.name,
            phone: updated.phone,
            level: updated.level,
          });
        }
        return updated;
      })
    );
  };

  const updateAthleteGameStats = (athleteId: string, stats: AthleteGameStats) => {
    setAthletes((prev) => prev.map((a) => (a.id === athleteId ? { ...a, stats } : a)));
  };

  const addAthleteMedia = (athleteId: string, item: Omit<AthleteMediaItem, 'id' | 'createdAt'>) => {
    const newMedia: AthleteMediaItem = {
      ...item,
      id: `med-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAthletes((prev) =>
      prev.map((a) =>
        a.id === athleteId ? { ...a, mediaGallery: [newMedia, ...(a.mediaGallery || [])] } : a
      )
    );
  };

  const removeAthleteMedia = (athleteId: string, mediaId: string) => {
    setAthletes((prev) =>
      prev.map((a) =>
        a.id === athleteId
          ? { ...a, mediaGallery: (a.mediaGallery || []).filter((m) => m.id !== mediaId) }
          : a
      )
    );
  };

  const addAthleteAchievement = (athleteId: string, achievement: Omit<AthleteAchievement, 'id'>) => {
    const newAch: AthleteAchievement = {
      ...achievement,
      id: `ach-${Date.now()}`,
    };
    setAthletes((prev) =>
      prev.map((a) =>
        a.id === athleteId
          ? {
              ...a,
              titlesCount: achievement.placement === '1º Lugar' ? a.titlesCount + 1 : a.titlesCount,
              achievements: [newAch, ...(a.achievements || [])],
            }
          : a
      )
    );
  };

  const removeAthleteAchievement = (athleteId: string, achievementId: string) => {
    setAthletes((prev) =>
      prev.map((a) =>
        a.id === athleteId
          ? { ...a, achievements: (a.achievements || []).filter((ach) => ach.id !== achievementId) }
          : a
      )
    );
  };

  const changeAthleteLevel = (athleteId: string, newLevel: AthleteLevel) => {
    setAthletes((prev) =>
      prev.map((a) => {
        if (a.id !== athleteId) return a;
        if (a.name.toLowerCase() === userProfile.name.toLowerCase()) {
          setUserProfile({ ...userProfile, level: newLevel });
        }
        return {
          ...a,
          level: newLevel,
          experienceCategory: newLevel === 'profissional' ? 'profissional' : a.experienceCategory || 'amador',
        };
      })
    );
  };

  const awardAthletePoints = (athleteId: string, pointsToAdd: number, addTitle = false) => {
    setAthletes((prev) =>
      prev.map((a) => {
        if (a.id !== athleteId) return a;
        return {
          ...a,
          points: Math.max(0, a.points + pointsToAdd),
          lastPointsDelta: pointsToAdd,
          titlesCount: addTitle ? a.titlesCount + 1 : a.titlesCount,
          matchesPlayed: a.matchesPlayed + 1,
          wins: pointsToAdd > 0 ? a.wins + 1 : a.wins,
        };
      })
    );
  };

  // Results are projections of the current bracket; corrections never add duplicate credits.
  const applyTournamentEdit = (tournamentId: string, matches: BracketMatch[], teams?: TeamPair[]) => {
    if (matches.some(match => match.tournamentId !== tournamentId)) throw new Error('Tabela pertence a outro torneio.');
    const previous = tournamentMatches.filter(match => match.tournamentId === tournamentId);
    if (JSON.stringify(previous) === JSON.stringify(matches) && !teams) return;
    const archiveKey = 'sharkset_bracket_revisions_' + tournamentId;
    const nextById = new Map(matches.map(match => [match.id, match]));
    const changed = previous.filter(match => JSON.stringify(match) !== JSON.stringify(nextById.get(match.id)));
    try {
      const archive = JSON.parse(localStorage.getItem(archiveKey) || '[]');
      localStorage.setItem(archiveKey, JSON.stringify([...archive, { at: new Date().toISOString(),
        matches: changed.map(({ audit, ...match }) => match),
        removedIds: matches.filter(match => !previous.some(old => old.id === match.id)).map(match => match.id),
        teams: teams ? registeredPairs.filter(team => team.tournamentId === tournamentId) : undefined }]));
    } catch { throw new Error('Não foi possível preservar o histórico neste navegador. Libere espaço antes de salvar a alteração.'); }
    const updated = [...tournamentMatches.filter(match => match.tournamentId !== tournamentId), ...matches];
    setTournamentMatches(updated);
    if (teams) setRegisteredPairs(prev => [...prev.filter(team => team.tournamentId !== tournamentId), ...teams]);
    setTournaments(prev => prev.map(tournament => tournament.id === tournamentId ? { ...tournament,
      isFinished: matches.length > 0 && matches.every(match => match.status === 'completed'), semiFormat: 'semi_direta' } : tournament));
    // Local table edits are not proof of an official server-validated result for global ranking.
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('sharkset_live_bracket');
      channel.postMessage({ fullMatches: updated }); channel.close();
    }
  };

  const handleAdvanceMatch = (matchId: string, winningTeam: 1 | 2, score1: number, score2: number) => {
    const target = tournamentMatches.find(match => match.id === matchId);
    if (!target) throw new Error('Partida não encontrada.');
    const matches = tournamentMatches.filter(match => match.tournamentId === target.tournamentId);
    applyTournamentEdit(target.tournamentId, advanceWinner(matches, matchId, winningTeam, score1, score2));
  };

  // Notify Next Match Players when Current Match has <= 10 points remaining
  const notifyLiveMatchProgress = (matchId: string, liveScore1: number, liveScore2: number): string | null => {
    const currentMatch = tournamentMatches.find((m) => m.id === matchId);
    if (!currentMatch || currentMatch.status === 'completed') return null;

    setTournamentMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, score1: liveScore1, score2: liveScore2, status: 'in_progress' } : m
      )
    );

    const matchesInTourn = tournamentMatches.filter((m) => m.tournamentId === currentMatch.tournamentId);
    const evalResult = evaluateMatchNearCompletion(currentMatch, matchesInTourn, liveScore1, liveScore2, 18);

    if (evalResult.shouldNotifyNextMatch) {
      const notif = buildMatch10PointsRemainingNotification(
        currentMatch,
        evalResult.nextMatch,
        liveScore1,
        liveScore2,
        evalResult.pointsRemaining,
        tenant.name
      );
      useSharkStore.getState().pushSmartNotification(notif);
      return notif.title;
    }

    return null;
  };

  const handleResetMatch = (matchId: string) => {
    const target = tournamentMatches.find(match => match.id === matchId);
    if (!target) return;
    applyTournamentEdit(target.tournamentId, resetMatch(tournamentMatches.filter(match => match.tournamentId === target.tournamentId), matchId));
  };

  const handleOverrideMatch = (
    matchId: string,
    updates: { team1?: TeamPair; team2?: TeamPair; courtName?: string; scheduledTime?: string }
  ) => {
    const target = tournamentMatches.find(match => match.id === matchId);
    if (!target) return;
    applyTournamentEdit(target.tournamentId, overrideMatchDetails(tournamentMatches.filter(match => match.tournamentId === target.tournamentId), matchId, updates));
  };

  const regenerateBracket = (tournamentId: string, customFormat?: SemiFormat) => {
    const tourn = tournaments.find((t) => t.id === tournamentId);
    const formatToUse = customFormat || tourn?.semiFormat || 'semi_direta';
    const pairsForTourn = registeredPairs.filter((p) => p.tournamentId === tournamentId);
    const newMatches = createBuraco4Bracket(tournamentId, pairsForTourn, formatToUse);
    applyTournamentEdit(tournamentId, newMatches);
  };

  // White-Label Arena Branding (Logo + Automatic Palette + Website Mode)
  const updateArenaBranding = (
    targetTenantId: string,
    branding: {
      logoUrl?: string;
      whiteLabelEnabled?: boolean;
      brandPalette?: ArenaBrandPalette;
      name?: string;
      tagline?: string;
    }
  ) => {
    setArenasMap((prev) => {
      const current = prev[targetTenantId];
      if (!current) return prev;
      return {
        ...prev,
        [targetTenantId]: {
          ...current,
          ...(branding.name !== undefined ? { name: branding.name } : {}),
          ...(branding.tagline !== undefined ? { tagline: branding.tagline } : {}),
          ...(branding.logoUrl !== undefined ? { logoUrl: branding.logoUrl } : {}),
          ...(branding.whiteLabelEnabled !== undefined
            ? { whiteLabelEnabled: branding.whiteLabelEnabled }
            : {}),
          ...(branding.brandPalette !== undefined
            ? {
                brandPalette: branding.brandPalette,
                primaryColor: branding.brandPalette.primary,
                accentColor: branding.brandPalette.accent,
              }
            : {}),
        },
      };
    });
  };

  // Update Booking Match Setup (4 Players, Referee Invite, Live Broadcast, Score & Highlighted Chat)
  const updateBookingMatchSetup = (bookingId: string, updater: (prev: Booking) => Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updater(b) : b)));
  };

  // Finish Live Booking Match & Credit Ranking Points if 4 Players are Identified & Present + Live Broadcast
  const finishLiveBookingMatchAndCreditRanking = (
    bookingId: string,
    winningTeam: 1 | 2
  ): { credited: boolean; message: string } => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) {
      return { credited: false, message: 'Partida não encontrada.' };
    }
    // A browser preview or an editable local scoreboard is not verified match evidence.
    return { credited: false, message: 'O ranking de lives será liberado após a integração de vídeo e validação do resultado no servidor. A prévia não pontua.' };
  };

  return (
    <AppContext.Provider
      value={{
        applyTournamentEdit,
        checkPlayerInactivity,
        arenasMap,
        tenant,
        setTenantId,
        availableTenants,
        radiusKm,
        setRadiusKm,
        selectedSport,
        setSelectedSport,
        activeTab,
        setActiveTab,
        arenaSubTab,
        setArenaSubTab,
        slots,
        bookings,
        waitlist,
        waitlistNotifications,
        tournaments,
        activeTournamentId,
        setActiveTournamentId,
        tournamentMatches,
        matchesByTournament: tournamentMatches.reduce<Record<string, BracketMatch[]>>((acc, m) => {
          if (!acc[m.tournamentId]) acc[m.tournamentId] = [];
          acc[m.tournamentId].push(m);
          return acc;
        }, {}),
        registeredPairs,
        athletes,
        rankingLogs,
        classStudents,
        userProfile,
        setUserProfile,
        resetAllDataToCleanSlate,
        focusMode,
        setFocusMode,
        toggleFocusMode,
        createBooking,
        cancelBooking,
        joinWaitlist,
        leaveWaitlist,
        claimWaitlistSlot,
        dismissWaitlistNotification,
        updateCourtConfig,
        applyPricingToAllArenaCourts,
        addClassScheduleToCourt,
        removeClassScheduleFromCourt,
        enrollStudentInClass,
        toggleClassStudentPayment,
        simulateStudentDueToday,
        notifyStudentTuitionDue,
        removeStudentFromClass,
        createNewArenaTenant,
        createTournament,
        updateTournamentConfig,
        registerDouble,
        togglePairPlayerPayment,
        rejectPairEnrollment,
        restorePairEnrollment,
        togglePairPresence,
        startTournamentWithDraw,
        updateLiveRefereeMatch,
        liveSpectatorsCount,
        addOrUpdateAthlete,
        updateAthleteProfile,
        updateAthleteGameStats,
        addAthleteMedia,
        removeAthleteMedia,
        addAthleteAchievement,
        removeAthleteAchievement,
        changeAthleteLevel,
        awardAthletePoints,
        handleAdvanceMatch,
        notifyLiveMatchProgress,
        handleResetMatch,
        handleOverrideMatch,
        regenerateBracket,
        updateArenaBranding,
        updateBookingMatchSetup,
        finishLiveBookingMatchAndCreditRanking,
        activeLiveBroadcastBookingId,
        setActiveLiveBroadcastBookingId,
        commandPaletteOpen,
        setCommandPaletteOpen,
        tenantModalOpen,
        setTenantModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
