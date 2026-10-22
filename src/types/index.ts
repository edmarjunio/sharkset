export type SportType = 'futevolei' | 'beach_tennis' | 'volei_praia';

export type AthleteLevel = 'iniciante' | 'serie_c' | 'serie_b' | 'serie_a' | 'profissional';

export type ExperienceCategory = 'amador' | 'profissional';

export type TournamentModalityFormat = 'duplas' | 'simples';

export type RankingScope = 'geral' | 'pais' | 'estado' | 'cidade' | 'arena';

export type SmartAlertType =
  | 'vacant_2h'
  | 'waitlist_freed'
  | 'match_10pts_left'
  | 'booking_15min'
  | 'tuition_due_today'
  | 'tuition_due_2days'
  | 'tournament_started'
  | 'bracket_result_published';

export type ClassEnrollmentAuthorRole = 'aluno' | 'professor' | 'dono';

export type TournamentCategory =
  | 'iniciante'
  | 'iniciante_serie_c'
  | 'serie_c'
  | 'serie_b_serie_c'
  | 'serie_b'
  | 'serie_a_pro'
  | 'mista';

export type DoublesCategory = TournamentCategory;

export type SemiFormat = 'semi_direta' | 'semi_com_chance';

export type EnrollmentStatus = 'pending' | 'confirmed' | 'rejected';

export type RefundStatus = 'none' | 'refund_pending' | 'refunded';

export interface AthleteGameStats {
  aces: number;
  errors: number;
  sharkAttacks: number;
  pingoPoints: number;
  defenses: number;
}

export interface AthleteMediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  title: string;
  tag: string;
  createdAt: string;
}

export interface AthleteAchievement {
  id: string;
  title: string;
  tournamentName: string;
  year: string;
  placement: '1º Lugar' | '2º Lugar' | '3º Lugar' | 'Destaque';
}

export interface AthleteProfile {
  lastMatchAt?: string;
  rankingInactive?: boolean;
  levelMatches?: number;
  levelWins?: number;
  levelPoints?: number;
  id: string;
  name: string;
  email?: string;
  phone: string;
  photoUrl?: string;
  photoURL?: string;
  birthDate?: string; // YYYY-MM-DD
  experienceCategory?: ExperienceCategory; // 'amador' | 'profissional'
  courtSide?: 'Direita' | 'Esquerda' | 'Ambos';
  dominantFoot?: 'Destro' | 'Canhoto' | 'Ambidestro';
  bio?: string;
  level: AthleteLevel;
  points: number;
  lastPointsDelta?: number;
  lastMatchSummary?: string;
  titlesCount: number;
  matchesPlayed: number;
  wins: number;
  stats?: AthleteGameStats;
  mediaGallery?: AthleteMediaItem[];
  achievements?: AthleteAchievement[];
  preferredSport: SportType;
  country?: string; // e.g., 'Brasil'
  state?: string;   // e.g., 'GO', 'SP'
  city: string;     // e.g., 'Mineiros'
  arenaId?: string;
  arenaName?: string;
  highestHistoricalLevel?: AthleteLevel; // Passaporte Único: impede descer de categoria em outra cidade
  autoPromotedFrom?: AthleteLevel;       // Registro de subida automática por excesso de títulos/pontos
  tournamentsPlayed?: number;            // Total de torneios oficiais disputados
  tournamentTokens?: number;             // Saldo de tokens do atleta para criação de campeonatos
  role?: 'admin' | 'athlete' | 'manager'; // Papel administrativo global ou de atleta
  createdAt?: string;                    // Data de entrada no SHARK SET
}

export interface RankingMatchLog {
  id: string;
  tournamentId: string;
  tournamentName: string;
  matchNumber: number;
  winnerNames: string;
  loserNames: string;
  score: string;
  winnerLevelAvg: string;
  loserLevelAvg: string;
  pointsAwardedWinner: number;
  pointsAwardedLoser: number;
  explanation: string;
  timestamp: string;
}

export interface ClassScheduleConfig {
  id: string;
  startTime: string; // e.g., "07:00"
  endTime: string;   // e.g., "08:00"
  daysOfWeek?: number[]; // e.g., [2, 4] = Terça e Quinta, [1, 3] = Segunda e Quarta
  level?: AthleteLevel | 'todos'; // e.g., 'iniciante', 'serie_c'
  title: string;     // e.g., "Turma Futevôlei Evolução"
  coachName: string;
  sport: SportType;
  monthlyPrice: number;
  dailyPrice: number;
  maxStudents: number;
  enrolledCount?: number;
}

export interface ClassStudent {
  id: string;
  tenantId: string;
  courtId: string;
  courtName: string;
  classId: string;
  classTitle: string;
  classTime: string;
  coachName: string;
  sport: SportType;
  studentName: string;
  studentPhone: string;
  billingType: 'mensal' | 'diaria';
  amount: number;
  paymentStatus: 'pago' | 'pendente';
  enrolledAt: string; // YYYY-MM-DD (Dia da inscrição = início do ciclo da mensalidade)
  billingStartDate?: string; // YYYY-MM-DD
  dueDayOfMonth?: number; // Dia do vencimento mensal (1 a 31, baseado no dia da inscrição)
  nextDueDate?: string; // YYYY-MM-DD (Data exata do próximo vencimento)
  enrolledByRole?: ClassEnrollmentAuthorRole; // 'aluno' | 'professor' | 'dono'
  enrolledByName?: string;
  lastDueNotificationAt?: string;
}

export interface DayPricingRule {
  enabled: boolean;   // Quadra aberta para locação neste dia da semana
  normalRate: number; // Valor da hora em horário normal neste dia (R$)
  peakRate: number;   // Valor da hora em horário de pico neste dia (R$)
}

export interface Court {
  id: string;
  name: string;
  description: string;
  sports: SportType[];
  surface: 'Areia Fina' | 'Areia Quartzosa Premium';
  isCovered: boolean;
  hasLighting: boolean;
  hourlyRate: number;
  peakHourlyRate?: number;
  weekendNormalRate?: number;
  weekendPeakRate?: number;
  peakStartTime?: string; // Ex: "18:00"
  peakEndTime?: string;   // Ex: "22:00"
  dayOfWeekPricing?: Partial<Record<number, DayPricingRule>>; // 0 (Dom) a 6 (Sáb)
  openTime?: string;
  closeTime?: string;
  classSchedules?: ClassScheduleConfig[];
}

export interface TimeSlot {
  id: string;
  courtId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  price: number;
  isAvailable: boolean;
  isPeakHour?: boolean;
  dayOfWeek?: number;
  pricingLabel?: string;
  bookingId?: string;
  slotType?: 'regular' | 'class';
  classConfig?: ClassScheduleConfig;
}

export interface VacantSlotWithin2h {
  slot: TimeSlot;
  court: Court;
  minutesUntilStart: number;
}

export interface ArenaBrandPalette {
  primary: string;
  secondary: string;
  accent: string;
  headerBg: string;
  surfaceBg: string;
  textOnPrimary: string;
  paletteName?: string;
}

export interface BookingParticipant {
  athleteId: string;
  name: string;
  level: AthleteLevel;
  teamSlot: 1 | 2;
  confirmedPresent: boolean;
  invitedBy?: string;
}

export interface BookingRefereeInvite {
  athleteId: string;
  name: string;
  phone?: string;
  status: 'invited' | 'accepted';
  isBroadcastOwner: boolean;
}

export interface BookingLiveChatMessage {
  id: string;
  author: string;
  role: 'referee_broadcaster' | 'player' | 'spectator';
  roleLabel: string;
  text: string;
  timestamp: string;
}

export interface BookingLiveBroadcast {
  sets1?: number;
  sets2?: number;
  bestOf?: 1 | 3 | 5;
  stageName?: string;
  setHistory?: Array<[number, number]>;
  decidingPoints?: number;
  winBy?: number;
  elapsedSeconds?: number;
  clockStartedAt?: number | null;
  isLive: boolean;
  streamTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  spectatorsCount: number;
  score1: number;
  score2: number;
  targetPoints: number;
  servingTeam: 1 | 2;
  serverName: string;
  startedAt: string;
  rankingPointsCredited?: boolean;
  pointHistory: RefereePointEvent[];
  chatMessages: BookingLiveChatMessage[];
}

export interface Booking {
  id: string;
  tenantId: string;
  arenaName?: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  sport: SportType;
  customerName: string;
  customerPhone: string;
  price: number;
  status: 'confirmed' | 'cancelled';
  bookingKind?: 'locacao' | 'aula_experimental';
  createdAt: string;
  participants?: BookingParticipant[];
  referee?: BookingRefereeInvite | null;
  liveBroadcast?: BookingLiveBroadcast;
}

export interface TeamPair {
  player1Id?: string;
  player2Id?: string;
  player1Email?: string;
  player2Email?: string;
  player1Phone?: string;
  player2Phone?: string;
  id: string;
  tournamentId: string;
  player1: string;
  player1Level: AthleteLevel;
  player2: string;
  player2Level: AthleteLevel;
  phone: string;
  category: TournamentCategory;
  seed: number;
  isPaid: boolean;
  player1Paid?: boolean;
  player2Paid?: boolean;
  enrollmentStatus?: EnrollmentStatus; // 'pending' | 'confirmed' | 'rejected'
  refundStatus?: RefundStatus;         // 'none' | 'refund_pending' | 'refunded'
  rejectionReason?: string;
  isPresent?: boolean;                 // Check-in de presença para montagem da chave
  paymentMethod?: 'pix' | 'cartao' | 'arena';
  registeredAt: string;
}

export type BracketStage = 'winners' | 'losers' | 'semifinals' | 'third_place' | 'grand_final' | 'super_final';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed';

export type PointSkillType = 'normal' | 'ace' | 'shark_attack' | 'pingo' | 'erro_adv';

export interface RefereePointEvent {
  id: string;
  timestamp: string;
  scoringTeam: 1 | 2;
  scorerName: string;
  serverName: string;
  skill: PointSkillType;
  scoreAfter: string; // e.g. "11 x 9"
}

export interface RefereeTimeoutEvent {
  id: string;
  timestamp: string;
  requestedBy: 'team1' | 'team2' | 'technical';
  teamName: string;
  scoreAtTimeout: string;
}

export interface RefereeCardEvent {
  id: string;
  timestamp: string;
  team: 1 | 2;
  playerName: string;
  cardType: 'yellow' | 'red';
  reason: string;
  scoreAtCard: string;
}

export interface RefereeMatchState {
  refereeName: string;
  targetPoints: number; // default 18
  servingTeam: 1 | 2;
  /**
   * 0 = Team 1 Player 1
   * 1 = Team 2 Player 1
   * 2 = Team 1 Player 2
   * 3 = Team 2 Player 2
   */
  serverRotationIndex: 0 | 1 | 2 | 3;
  serviceOrderLabels: [string, string, string, string];
  /**
   * Team that owns each position of the service order. When absent the legacy
   * alternation (team 1, team 2, team 1, team 2) applies.
   */
  serviceOrderTeams?: [1 | 2, 1 | 2, 1 | 2, 1 | 2];
  /** Player (0 = first listed, 1 = second listed) who opened serving for each team. */
  firstServers?: { team1?: 0 | 1; team2?: 0 | 1 };
  team1TimeoutsUsed: number;
  team2TimeoutsUsed: number;
  maxTimeoutsPerTeam: number;
  activeTimeout?: {
    type: 'team1' | 'team2' | 'technical';
    label: string;
    startedAt: string;
  } | null;
  courtSwapsCount: number;
  currentSidesSwapped: boolean;
  startedAt?: string;
  updatedAt: string;
  pointHistory: RefereePointEvent[];
  timeoutHistory: RefereeTimeoutEvent[];
  cardsHistory?: RefereeCardEvent[];
}

export interface BracketMatch {
  bracketStructure?: { version: number; drawMode?: 'seeded' | 'random' | 'manual'; randomSeed?: number; seededTeamIds: (string | null)[]; contractedNodes: { id: string; stage: BracketStage; round: number; source1?: BracketSource; source2?: BracketSource }[] };
  source1?: BracketSource;
  source2?: BracketSource;
  initialLowerSource?: BracketSource;
  nodeKey?: string;
  region?: 'left_top' | 'left_bottom' | 'right_top' | 'right_bottom' | 'center';
  rules?: MatchRules;
  sets?: MatchSet[];
  resultMode?: 'played' | 'walkover';
  officialAt?: string;
  revision?: number;
  /** Revision confirmed by the server-side result validator. */
  serverValidatedRevision?: number;
  /** Optimistic concurrency revision for authenticated in-progress referee updates. */
  liveStateRevision?: number;
  semifinalDecision?: 'waiting' | 'fixed' | 'swap' | 'blocked' | 'exception';
  exceptionReason?: string;
  exceptionFingerprint?: string;
  audit?: BracketAuditEntry[];
  id: string;
  tournamentId: string;
  matchNumber: number;
  stage: BracketStage;
  round: number;
  stageName: string;
  team1?: TeamPair;
  team2?: TeamPair;
  score1?: number;
  score2?: number;
  winnerId?: string;
  loserId?: string;
  courtId?: string;
  courtName?: string;
  scheduledTime?: string;
  status: MatchStatus;
  nextMatchWinnerId?: string;
  winnerDestinationSlot?: 'team1' | 'team2';
  nextMatchLoserId?: string;
  loserDestinationSlot?: 'team1' | 'team2';
  liveReferee?: RefereeMatchState;
  /** Official broadcast (Firestore `broadcasts` id) chosen for this specific match. */
  linkedBroadcastId?: string;
  spectatorsCount?: number;
}

export type BracketSource = { kind: 'team'; team: TeamPair; slot: number } |
  { kind: 'winner' | 'loser'; matchId: string };
export interface MatchSet { score1: number; score2: number }
export interface MatchRules { bestOf: 1 | 3 | 5; targetPoints: number; decidingPoints: number; winBy: number }
export interface BracketAuditEntry {
  id: string; at: string; actor: string; reason: string; action: string;
  before: string; affectedMatchIds: string[];
}

export interface Tournament {
  id: string;
  tenantId: string;
  name: string;
  sport: SportType;
  category: TournamentCategory;
  modalityFormat?: TournamentModalityFormat;
  semiFormat: SemiFormat;
  date: string;
  location?: string;
  specificRules?: string;
  format: 'double_elimination_buraco4';
  description: string;
  maxPairs: number;
  registrationFee: number;
  responsibleName: string;
  responsiblePhone: string;
  isOpenForRegistration: boolean;
  isFinished: boolean;
  tableLicenseStatus?: 'unlocked_single_20' | 'unlocked_single_token' | 'unlocked_arena_pro_99';
  tableLicenseFee?: number;
  createdScope?: 'arena' | 'user'; // 'arena' = criado na arena fixa; 'user' = criado pelo usuário com escolha livre de arena
  creatorUid?: string;             // UID do usuário criador
  creatorTokensSpent?: number;     // Quantidade de tokens debitados (1 token)
}

export interface TournamentStandingRow {
  pair: TeamPair;
  position: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  winRate: number;
  rankingPointsEarned: number;
  statusBadge: string;
}

export interface TenantConfig {
  id: string;
  name: string;
  tagline: string;
  city: string;
  state: string;
  address: string;
  distanceKm: number;
  rating: number;
  whatsapp: string;
  primaryColor: string;
  accentColor: string;
  sandBg: string;
  amenities: string[];
  courts: Court[];
  operatingHours: {
    open: string;
    close: string;
  };
  subscriptionPlan?: 'arena_pro_99' | 'pay_per_table_20' | 'pay_per_token_19_90';
  monthlyPlanPrice?: number; // R$ 99/mês
  ownerId?: string;
  ownerName?: string;
  managers?: string[]; // E-mails ou UIDs de gestores autorizados pelo dono para configurar a arena
  imageUrl?: string;
  logoUrl?: string;
  whiteLabelEnabled?: boolean;
  brandPalette?: ArenaBrandPalette;
  lat?: number;
  lng?: number;
  cep?: string;
  defaultHourlyRate?: number;
  hasPeakPricing?: boolean;
  peakIntervals?: Array<{ id: string; startTime: string; endTime: string; price: number; label?: string }>;
  whatsappVerified?: boolean;
}

export type CouponScope = 'global' | 'arena';
export type CouponDiscountType = 'fixed' | 'percent';

export interface DiscountCoupon {
  id: string;
  code: string;                      // ex: 'SHARK10', 'BEMVINDO'
  description?: string;
  discountType: CouponDiscountType; // 'fixed' (desconto em R$) | 'percent' (% desconto)
  discountValue: number;             // ex: 10 (R$ 10 ou 10%)
  scope: CouponScope;                // 'global' (todas as arenas) | 'arena' (arena específica)
  arenaId?: string;                  // ID da arena se scope === 'arena'
  arenaName?: string;
  minBookingValue?: number;          // Valor mínimo da locação para aplicar o cupom (R$)
  maxUses?: number;                  // Limite máximo de utilizações
  usedCount: number;                 // Total de vezes utilizado
  active: boolean;                   // Ativo ou pausado
  expiresAt?: string;                // ISO timestamp; coupon is invalid after this instant
  pinned?: boolean;                  // Shows this global coupon in the public site banner
  bannerMessage?: string;
  createdBy?: string;                // UID do criador
  createdAt: string;
}

export interface TokenPackage {
  id: string;
  tokens: number;
  price: number;
  label: string;
  discountLabel?: string;
  isPopular?: boolean;
}

export interface LiveChatMessage {
  id: string;
  streamId?: string;
  matchId?: string;
  authorName: string;
  authorCity?: string;
  authorLevel?: AthleteLevel;
  badge?: string;
  text: string;
  reaction?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface HistoricalLegendVideo {
  id: string;
  title: string;
  legends: string[];
  legendName?: string;
  era: string;
  year?: string;
  location: string;
  youtubeEmbedUrl: string;
  thumbnailUrl: string;
  viewsCount: string;
  spectatorsWatchingNow: number;
  duration?: string;
  description: string;
  highlightTag: string;
}

export interface WaitlistEntry {
  id: string;
  tenantId: string;
  arenaName: string;
  slotId: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  sport: SportType;
  customerName: string;
  customerPhone: string;
  position: number;
  status: 'waiting' | 'notified' | 'converted' | 'cancelled';
  notifiedAt?: string;
  createdAt: string;
}

export interface WaitlistNotification {
  id: string;
  waitlistEntry: WaitlistEntry;
  cancelledByCustomer?: string;
  whatsappLink: string;
  timestamp: string;
}

export interface SmartNotificationItem {
  id: string;
  type: SmartAlertType;
  title: string;
  body: string;
  badgeLabel: string;
  recipientName?: string;
  recipientPhone?: string;
  whatsappUrl?: string;
  actionLabel?: string;
  actionTargetTab?: 'scheduler' | 'tournaments' | 'my_bookings';
  slotId?: string;
  matchId?: string;
  tournamentId?: string;
  createdAt: string;
  read: boolean;
  pushDelivered: boolean;
}

export interface MatchMvpVoteRecord {
  id: string;
  matchId: string;
  tournamentId: string;
  tournamentName?: string;
  playerName: string;
  pairNames: string;
  voterName: string;
  votedAt: string;
  ownerId?: string;
}

export type AcademyCategory =
  | 'marcacao_padrao'
  | 'posicionamento_quadra'
  | 'corrida_areia'
  | 'base_defesa'
  | 'ataque_shark'
  | 'comunidade';

export type AcademyMediaType = 'video' | 'document' | 'image';

export interface AcademyPost {
  id: string;
  title: string;
  category: AcademyCategory;
  mediaType: AcademyMediaType;
  mediaUrl?: string;
  summary: string;
  tacticalKeyPoints?: string[];
  authorName: string;
  authorRole?: string;
  arenaName?: string;
  level: 'iniciante' | 'intermediario' | 'avancado' | 'todos';
  likesCount: number;
  createdAt?: string;
  ownerId?: string;
  publisherType?: 'user' | 'arena';
  publisherId?: string;
  arenaId?: string;
}

export type ReportTargetType = 'athlete' | 'match';

export type ReportReason =
  | 'match_fixing'           // Entrega de jogo combinada com amigos para subir ranking
  | 'fake_score'             // Placar simulado ou falso
  | 'sandbagging'            // Atleta jogando em categoria inferior de propósito
  | 'collusion_farming'      // Múltiplos jogos seguidos contra a mesma pessoa para farmar XP
  | 'inappropriate_conduct'  // Conduta anti-esportiva
  | 'other';

export interface IntegrityReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;           // athleteId ou matchId
  targetName: string;         // Nome do atleta ou descrição da partida
  reason: ReportReason;
  description: string;
  reporterName?: string;
  reporterPhone?: string;
  status: 'pending' | 'investigating' | 'action_taken' | 'dismissed';
  evidenceUrl?: string;       // Link de gravação ou transmissão
  adminNotes?: string;
  createdAt: string;
}
