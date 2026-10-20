import { AthleteLevel, AthleteProfile, BracketStage, RankingScope, TournamentCategory } from '../types';

export const ATHLETE_LEVEL_LABELS: Record<AthleteLevel, string> = {
  iniciante: 'Iniciante',
  serie_c: 'Série C',
  serie_b: 'Série B',
  serie_a: 'Série A',
  profissional: 'Profissional',
};

export const ATHLETE_LEVEL_WEIGHT: Record<AthleteLevel, number> = {
  iniciante: 1,
  serie_c: 2,
  serie_b: 3,
  serie_a: 4,
  profissional: 5,
};

export interface TierMeta {
  level: AthleteLevel;
  label: string;
  minPoints: number;
  maxPoints: number | null;
  minTitlesForAutoPromo: number | null;
  nextLevel?: AthleteLevel;
  description: string;
}

export const ATHLETE_TIERS: TierMeta[] = [
  {
    level: 'iniciante',
    label: 'Iniciante',
    minPoints: 0,
    maxPoints: 249,
    minTitlesForAutoPromo: 2,
    nextLevel: 'serie_c',
    description: 'Atletas em início de competição. Sobe para Série C com 250 pts ou 2 títulos.',
  },
  {
    level: 'serie_c',
    label: 'Série C',
    minPoints: 250,
    maxPoints: 549,
    minTitlesForAutoPromo: 3,
    nextLevel: 'serie_b',
    description: 'Intermediário regional. Não pode formar dupla com outro Série C na categoria Iniciante + C.',
  },
  {
    level: 'serie_b',
    label: 'Série B',
    minPoints: 550,
    maxPoints: 949,
    minTitlesForAutoPromo: 4,
    nextLevel: 'serie_a',
    description: 'Avançado competitivo. Sobe para Série A ao atingir 950 pts ou 4 títulos.',
  },
  {
    level: 'serie_a',
    label: 'Série A',
    minPoints: 950,
    maxPoints: 1499,
    minTitlesForAutoPromo: 5,
    nextLevel: 'profissional',
    description: 'Alta performance estadual. Elegível ao ranking Profissional acima de 1500 pts.',
  },
  {
    level: 'profissional',
    label: 'Profissional',
    minPoints: 1500,
    maxPoints: null,
    minTitlesForAutoPromo: null,
    description: 'Categoria máxima de elite nacional / circuitos abertos.',
  },
];

export const TOURNAMENT_CATEGORY_LABELS: Record<TournamentCategory, string> = {
  iniciante: 'Iniciante Puro (Só Iniciantes)',
  iniciante_serie_c: 'Iniciante + Série C (Proibido 2 Série C)',
  serie_c: 'Série C Livre',
  serie_b_serie_c: 'Série B + Série C (Proibido 2 Série B)',
  serie_b: 'Série B Livre',
  serie_a_pro: 'Série A + Profissional (Máx. 1 Pro)',
  mista: 'Mista / Aberta',
};

export interface CategoryValidationResult {
  isValid: boolean;
  reason: string;
  ruleSummary: string;
  combinedWeight: number;
  maxAllowedWeight: number;
}

/**
 * Valida se a combinação de níveis dos 2 atletas é permitida na categoria do torneio.
 * Impede duplas desbalanceadas como 2 atletas 'Série C' na categoria 'Iniciante + Série C'.
 */
export function validatePairCategory(
  tournamentCategory: TournamentCategory,
  level1: AthleteLevel,
  level2: AthleteLevel
): CategoryValidationResult {
  const w1 = ATHLETE_LEVEL_WEIGHT[level1];
  const w2 = ATHLETE_LEVEL_WEIGHT[level2];
  const combinedWeight = w1 + w2;
  const l1Name = ATHLETE_LEVEL_LABELS[level1];
  const l2Name = ATHLETE_LEVEL_LABELS[level2];

  switch (tournamentCategory) {
    case 'iniciante': {
      const ruleSummary = 'Permitido apenas 2 atletas Iniciantes (Soma máx: 2).';
      if (w1 > 1 || w2 > 1) {
        return {
          isValid: false,
          reason: `Pareamento bloqueado: A categoria Iniciante aceita apenas atletas Iniciantes (selecionado: ${l1Name} + ${l2Name}).`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 2,
        };
      }
      return {
        isValid: true,
        reason: `Dupla balanceada e aprovada: 2 atletas Iniciantes.`,
        ruleSummary,
        combinedWeight,
        maxAllowedWeight: 2,
      };
    }

    case 'iniciante_serie_c': {
      const ruleSummary = 'Pode 1 Série C + 1 Iniciante ou 2 Iniciantes (Soma máx: 3). Proibido 2 Série C.';
      if (w1 > 2 || w2 > 2) {
        return {
          isValid: false,
          reason: `Pareamento bloqueado: Atleta de nível ${w1 > 2 ? l1Name : l2Name} excede o teto da categoria Iniciante + Série C.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 3,
        };
      }
      if (level1 === 'serie_c' && level2 === 'serie_c') {
        return {
          isValid: false,
          reason: `Dupla desbalanceada bloqueada: Proibido formar dupla com 2 atletas Série C (${l1Name} + ${l2Name}). É permitido no máximo 1 Série C com 1 Iniciante, ou 2 Iniciantes.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 3,
        };
      }
      return {
        isValid: true,
        reason:
          level1 === 'iniciante' && level2 === 'iniciante'
            ? 'Dupla aprovada: 2 atletas Iniciantes permitidos na categoria Iniciante + Série C.'
            : 'Dupla balanceada aprovada: Combinação ideal de 1 Série C + 1 Iniciante.',
        ruleSummary,
        combinedWeight,
        maxAllowedWeight: 3,
      };
    }

    case 'serie_c': {
      const ruleSummary = 'Permitido atletas Iniciante e Série C (Soma máx: 4). Proibido Série B ou superior.';
      if (w1 > 2 || w2 > 2) {
        return {
          isValid: false,
          reason: `Pareamento bloqueado: Atletas de nível ${l1Name} / ${l2Name} possuem ranking acima da Série C.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 4,
        };
      }
      return {
        isValid: true,
        reason: `Dupla aprovada para a Série C (${l1Name} + ${l2Name}).`,
        ruleSummary,
        combinedWeight,
        maxAllowedWeight: 4,
      };
    }

    case 'serie_b_serie_c': {
      const ruleSummary = 'Pode 1 Série B + 1 Série C/Iniciante, ou 2 Série C (Soma máx: 5). Proibido 2 Série B.';
      if (w1 > 3 || w2 > 3) {
        return {
          isValid: false,
          reason: `Pareamento bloqueado: Atletas Série A ou Profissional não podem competir na Série B + Série C.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 5,
        };
      }
      if (level1 === 'serie_b' && level2 === 'serie_b') {
        return {
          isValid: false,
          reason: `Dupla desbalanceada bloqueada: Proibido formar dupla com 2 atletas Série B na categoria Série B + Série C.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 5,
        };
      }
      return {
        isValid: true,
        reason: `Dupla balanceada aprovada na categoria Série B + Série C (${l1Name} + ${l2Name}).`,
        ruleSummary,
        combinedWeight,
        maxAllowedWeight: 5,
      };
    }

    case 'serie_b': {
      const ruleSummary = 'Permitido até Série B (Soma máx: 6). Proibido Série A e Profissional.';
      if (w1 > 3 || w2 > 3) {
        return {
          isValid: false,
          reason: `Pareamento bloqueado: Atletas Série A ou Profissional não entram na Série B.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 6,
        };
      }
      return {
        isValid: true,
        reason: `Dupla aprovada para a Série B (${l1Name} + ${l2Name}).`,
        ruleSummary,
        combinedWeight,
        maxAllowedWeight: 6,
      };
    }

    case 'serie_a_pro': {
      const ruleSummary = 'Permitido 1 Profissional + 1 Série A (ou 2 Série A). Proibido 2 Profissionais juntos.';
      if (level1 === 'profissional' && level2 === 'profissional') {
        return {
          isValid: false,
          reason: `Dupla desbalanceada bloqueada: Na categoria Série A + Pro não é permitido 2 atletas Profissionais juntos.`,
          ruleSummary,
          combinedWeight,
          maxAllowedWeight: 9,
        };
      }
      return {
        isValid: true,
        reason: `Dupla aprovada na categoria Série A + Profissional (${l1Name} + ${l2Name}).`,
        ruleSummary,
        combinedWeight,
        maxAllowedWeight: 9,
      };
    }

    case 'mista':
    default:
      return {
        isValid: true,
        reason: `Dupla habilitada para a categoria (${l1Name} + ${l2Name}).`,
        ruleSummary: 'Categoria aberta com validação de ranking.',
        combinedWeight,
        maxAllowedWeight: 10,
      };
  }
}

/**
 * Calcula sugestão e trava obrigatória de subida de categoria (Auto-Promoção anti-sandbagging).
 * Os pontos do ranking vêm exclusivamente de torneios jogados. Se o atleta ganha muitos jogos/títulos
 * na Série C (ou Iniciante), ele é promovido automaticamente e bloqueado de jogar a categoria anterior.
 */
export function getRankingPromotionSuggestion(
  points: number,
  titlesCount: number,
  currentLevel: AthleteLevel,
  wins: number = 0,
  matchesPlayed: number = 0
): {
  shouldPromote: boolean;
  recommendedLevel: AthleteLevel;
  explanation: string;
  progressPercent: number;
  pointsToNext: number;
  triggeredByDominance?: boolean;
} {
  const tier = ATHLETE_TIERS.find((t) => t.level === currentLevel) || ATHLETE_TIERS[0];

  if (!tier.maxPoints || !tier.nextLevel) {
    return {
      shouldPromote: false,
      recommendedLevel: 'profissional',
      explanation: 'Atleta já está no topo do ranking (Nível Profissional).',
      progressPercent: 100,
      pointsToNext: 0,
    };
  }

  const nextMin = tier.maxPoints + 1;
  const span = nextMin - tier.minPoints;
  const earnedInTier = Math.max(0, points - tier.minPoints);
  const progressPercent = Math.min(100, Math.round((earnedInTier / span) * 100));
  const pointsToNext = Math.max(0, nextMin - points);

  const reachedPoints = points >= nextMin;
  const reachedTitles = tier.minTitlesForAutoPromo ? titlesCount >= tier.minTitlesForAutoPromo : false;
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
  const reachedDominance =
    (currentLevel === 'iniciante' && wins >= 8 && winRate >= 70) ||
    (currentLevel === 'serie_c' && wins >= 12 && winRate >= 70) ||
    (currentLevel === 'serie_b' && wins >= 18 && winRate >= 70);

  // Trava de Consistência rigorosa: Mínimo de 6 partidas com 4 vitórias e taxa de vitória >= 60%
  const hasConsistencyLockSatisfied = matchesPlayed >= 6 && wins >= 4 && winRate >= 60;
  if (hasConsistencyLockSatisfied && (reachedPoints || reachedTitles || reachedDominance)) {
    const reasonDetail = reachedPoints
      ? `atingiu ${points} pts (teto: ${tier.maxPoints} pts)`
      : reachedTitles
      ? `conquistou ${titlesCount} títulos na categoria`
      : `alta dominância em torneios (${wins} vitórias / ${winRate}% aproveitamento)`;

    return {
      shouldPromote: true,
      recommendedLevel: tier.nextLevel,
      explanation: `SUBIDA OBRIGATÓRIA: Atleta ${reasonDetail} com consistência comprovada. Promovido para ${ATHLETE_LEVEL_LABELS[tier.nextLevel]} (bloqueado de atuar em ${ATHLETE_LEVEL_LABELS[currentLevel]}).`,
      progressPercent: 100,
      pointsToNext: 0,
      triggeredByDominance: reachedDominance,
    };
  }

  return {
    shouldPromote: false,
    recommendedLevel: currentLevel,
    explanation: reachedPoints && !hasConsistencyLockSatisfied
      ? `Pontuação atingida (${points} pts), mas aguardando trava de consistência (mínimo 5 jogos com 60% win rate ou 1 título).`
      : `Para subir: ${pointsToNext} pts restantes (${progressPercent}% XP) + trava de consistência (mínimo 5 jogos com 60% win rate ou título).`,
    progressPercent,
    pointsToNext,
  };
}

export interface AntiSandbaggingCheckResult {
  isAllowed: boolean;
  effectiveLevel: AthleteLevel;
  violationType: 'none' | 'cross_city_downgrade' | 'category_cap_exceeded';
  alertMessage: string | null;
}

/**
 * Passaporte Único Nacional SHARK SET:
 * 1. Impede que um atleta que joga Série A/B/C em sua cidade tente se inscrever como Iniciante (ou nível inferior) em outra cidade.
 * 2. Impede que um atleta que já estourou o limite de vitórias/títulos/pontos da Série C continue jogando Série C.
 */
export function evaluateAthleteAntiSandbagging(
  athlete: AthleteProfile | undefined,
  claimedLevel: AthleteLevel,
  targetCity?: string
): AntiSandbaggingCheckResult {
  if (!athlete) {
    return {
      isAllowed: true,
      effectiveLevel: claimedLevel,
      violationType: 'none',
      alertMessage: null,
    };
  }

  const officialBaseLevel = athlete.highestHistoricalLevel || athlete.level;
  const promoCheck = getRankingPromotionSuggestion(
    athlete.points,
    athlete.titlesCount,
    officialBaseLevel,
    athlete.wins,
    athlete.matchesPlayed
  );

  const trueMinimumLevel = promoCheck.shouldPromote ? promoCheck.recommendedLevel : officialBaseLevel;
  const claimedWeight = ATHLETE_LEVEL_WEIGHT[claimedLevel];
  const officialWeight = ATHLETE_LEVEL_WEIGHT[officialBaseLevel];
  const minimumAllowedWeight = ATHLETE_LEVEL_WEIGHT[trueMinimumLevel];

  // Caso 1: Tentativa de "Gato Intermunicipal" (Ex: Joga Série A em Goiânia e tenta jogar Iniciante em Mineiros/Jataí)
  if (claimedWeight < officialWeight) {
    return {
      isAllowed: false,
      effectiveLevel: trueMinimumLevel,
      violationType: 'cross_city_downgrade',
      alertMessage: `🚨 TRAVA ANTI-GATO INTERMUNICIPAL: ${athlete.name} possui Passaporte Único SHARK SET nível ${ATHLETE_LEVEL_LABELS[officialBaseLevel]} em ${athlete.city}/${athlete.state} (${athlete.points} pts em torneios). É bloqueado se inscrever como ${ATHLETE_LEVEL_LABELS[claimedLevel]}${targetCity ? ` em ${targetCity}` : ''}!`,
    };
  }

  // Caso 2: Estouro de Categoria por Excesso de Títulos / Vitórias / Pontos em Torneios (Ex: Ganha muito na Série C)
  if (claimedWeight < minimumAllowedWeight && promoCheck.shouldPromote) {
    return {
      isAllowed: false,
      effectiveLevel: trueMinimumLevel,
      violationType: 'category_cap_exceeded',
      alertMessage: `🏆 SUBIDA DE CATEGORIA OBRIGATÓRIA: ${athlete.name} acumula ${athlete.points} pts, ${athlete.titlesCount} títulos e ${athlete.wins} vitórias em torneios na ${ATHLETE_LEVEL_LABELS[officialBaseLevel]}. Não pode mais jogar ${ATHLETE_LEVEL_LABELS[claimedLevel]} — categoria mínima liberada: ${ATHLETE_LEVEL_LABELS[trueMinimumLevel]}!`,
    };
  }

  return {
    isAllowed: true,
    effectiveLevel: trueMinimumLevel,
    violationType: 'none',
    alertMessage: null,
  };
}

export function validatePairWithUnifiedPassport(
  category: TournamentCategory,
  player1Name: string,
  claimedLevel1: AthleteLevel,
  player2Name: string,
  claimedLevel2: AthleteLevel,
  athletes: AthleteProfile[],
  targetCity?: string
): CategoryValidationResult {
  const matched1 = athletes.find((a) => a.name.toLowerCase() === player1Name.trim().toLowerCase());
  const matched2 = athletes.find((a) => a.name.toLowerCase() === player2Name.trim().toLowerCase());

  const check1 = evaluateAthleteAntiSandbagging(matched1, claimedLevel1, targetCity);
  if (!check1.isAllowed) {
    return {
      isValid: false,
      reason: check1.alertMessage || 'Bloqueado pelo Passaporte Único Shark Set.',
      ruleSummary:
        'Passaporte Único Anti-Sandbagging: O nível homologado no Ranking acompanha o atleta em qualquer cidade e sobe automaticamente ao atingir o teto de pontos/títulos da categoria.',
      combinedWeight: ATHLETE_LEVEL_WEIGHT[check1.effectiveLevel] + ATHLETE_LEVEL_WEIGHT[claimedLevel2],
      maxAllowedWeight: 10,
    };
  }

  const check2 = evaluateAthleteAntiSandbagging(matched2, claimedLevel2, targetCity);
  if (!check2.isAllowed) {
    return {
      isValid: false,
      reason: check2.alertMessage || 'Bloqueado pelo Passaporte Único Shark Set.',
      ruleSummary:
        'Passaporte Único Anti-Sandbagging: O nível homologado no Ranking acompanha o atleta em qualquer cidade e sobe automaticamente ao atingir o teto de pontos/títulos da categoria.',
      combinedWeight: ATHLETE_LEVEL_WEIGHT[check1.effectiveLevel] + ATHLETE_LEVEL_WEIGHT[check2.effectiveLevel],
      maxAllowedWeight: 10,
    };
  }

  return validatePairCategory(category, check1.effectiveLevel, check2.effectiveLevel);
}



/**
 * Motor de Cálculo de Pontos do Ranking de Futevôlei
 * Considera:
 * 1. Resultado e Fase do Torneio (Classificatória, Semifinal, Final)
 * 2. Performance em quadra (Saldo/margem de pontos no placar)
 * 3. Nível do Oponente (Bônus de dificuldade ao vencer oponentes de série superior)
 */
export function calculateFutevoleiMatchPoints(params: {
  winnerLevels: AthleteLevel[];
  loserLevels: AthleteLevel[];
  winnerScore: number;
  loserScore: number;
  stage?: BracketStage;
  isBroadcastFriendly?: boolean; // Amistoso com transmissão validada em arena
  priorHeadToHeadMatchesThisWeek?: number; // Proteção anti-farming/conluio
}): {
  winnerPoints: number;
  loserPoints: number;
  performanceBonus: number;
  opponentDifficultyBonus: number;
  stageBonus: number;
  explanation: string;
  isCappedByAntiFarm?: boolean;
} {
  const {
    winnerLevels,
    loserLevels,
    winnerScore,
    loserScore,
    stage = 'winners',
    isBroadcastFriendly = false,
    priorHeadToHeadMatchesThisWeek = 0,
  } = params;

  const avgWinnerWeight =
    winnerLevels.reduce((acc, l) => acc + ATHLETE_LEVEL_WEIGHT[l], 0) / Math.max(1, winnerLevels.length);
  const avgLoserWeight =
    loserLevels.reduce((acc, l) => acc + ATHLETE_LEVEL_WEIGHT[l], 0) / Math.max(1, loserLevels.length);

  // Base points: Torneio tem peso maior (25 pts), amistoso com transmissão tem base padrão equilibrada (16 pts)
  const baseWin = isBroadcastFriendly ? 16 : 25;

  // Stage bonus (apenas para torneios oficiais)
  let stageBonus = 0;
  if (!isBroadcastFriendly) {
    if (stage === 'semifinals') stageBonus = 12;
    if (stage === 'grand_final' || stage === 'super_final') stageBonus = 28;
  }

  // Performance bonus based on score margin (e.g. 18x10 -> diff 8 -> +8 pts)
  const scoreDiff = Math.max(1, winnerScore - loserScore);
  const performanceBonus = Math.min(12, Math.round(scoreDiff * 0.9));

  // Opponent difficulty bonus (Underdog Bonus & Anti-Farm Clamp)
  // weightDiff > 0: Venceu alguém de nível superior!
  // weightDiff < 0: Venceu alguém de nível inferior (favorito)
  const weightDiff = avgLoserWeight - avgWinnerWeight;
  let opponentDifficultyBonus = 0;

  if (weightDiff > 0) {
    // Venceu adversário mais forte: super bônus proporcional à diferença de categorias
    // Ex: +1 categoria acima = +18 pts; +2 categorias acima = +36 pts!
    opponentDifficultyBonus = Math.round(weightDiff * (isBroadcastFriendly ? 18 : 16));
  } else if (weightDiff === 0) {
    // Mesma categoria
    opponentDifficultyBonus = isBroadcastFriendly ? 5 : 6;
  } else {
    // Favorito venceu categoria inferior: ganho mínimo para desestimular farming
    // Ex: Profissional ganhando de Série C ganha no máximo +2 pts de bônus
    opponentDifficultyBonus = Math.max(1, Math.round(4 + weightDiff * 2));
  }

  let winnerPoints = baseWin + stageBonus + performanceBonus + opponentDifficultyBonus;

  // Proteção Anti-Farm / Conluio entre amigos no amistoso:
  // Se jogarem mais de 2 partidas na mesma semana entre si, a pontuação sofre corte de 80% (1/5)
  let isCappedByAntiFarm = false;
  if (isBroadcastFriendly && priorHeadToHeadMatchesThisWeek >= 2) {
    winnerPoints = Math.max(2, Math.round(winnerPoints * 0.2));
    isCappedByAntiFarm = true;
  }

  // Loser points: resiliência ao enfrentar categoria superior ou fazer jogo apertado
  const closeMatchBonus = loserScore >= 14 ? 4 : 1;
  const underdogResilience = avgWinnerWeight > avgLoserWeight ? Math.round((avgWinnerWeight - avgLoserWeight) * 4) : 0;
  const loserPoints = isCappedByAntiFarm ? 1 : 3 + closeMatchBonus + underdogResilience;

  const typePrefix = isBroadcastFriendly ? 'Amistoso Transmitido' : 'Torneio';
  const farmNote = isCappedByAntiFarm ? ' [⚠️ Trava Anti-Farm: Limite semanal atingido]' : '';
  const explanation = `${typePrefix}: Base +${baseWin} | Dif. Nível +${opponentDifficultyBonus} | Performance (${winnerScore}x${loserScore}) +${performanceBonus}${stageBonus > 0 ? ` | Fase +${stageBonus}` : ''}${farmNote}`;

  return {
    winnerPoints,
    loserPoints,
    performanceBonus,
    opponentDifficultyBonus,
    stageBonus,
    explanation,
    isCappedByAntiFarm,
  };
}

export interface RankedAthleteRow extends AthleteProfile {
  scopePosition: number;
  globalPosition: number;
}

export const RANKING_SCOPE_LABELS: Record<RankingScope, string> = {
  geral: 'RANKING GERAL',
  pais: 'RANKING POR PAÍS',
  estado: 'RANKING POR ESTADO',
  cidade: 'RANKING POR CIDADE',
  arena: 'RANKING POR ARENA',
};

/**
 * Extracts unique Countries, States, Cities, and Arenas from the athletes list (Zero Duplication).
 */
export function extractAvailableRankingDimensions(athletes: AthleteProfile[]) {
  const countries = Array.from(new Set(athletes.map((a) => a.country || 'Brasil')));
  const states = Array.from(new Set(athletes.map((a) => a.state || 'GO')));
  const cities = Array.from(new Set(athletes.map((a) => (a.city || 'Mineiros').split(' - ')[0].trim())));
  const arenasMap = new Map<string, string>();
  athletes.forEach((a) => {
    const id = a.arenaId || 'conflora';
    const name = a.arenaName || 'SHARK SET Arena Matriz';
    arenasMap.set(id, name);
  });

  return {
    countries,
    states,
    cities,
    arenas: Array.from(arenasMap.entries()).map(([id, name]) => ({ id, name })),
  };
}

/**
 * Pure Clean Code function that filters and ranks athletes by:
 * - RANKING GERAL
 * - RANKING POR PAÍS
 * - RANKING POR ESTADO
 * - RANKING POR CIDADE
 * - RANKING POR ARENA
 */
export function filterAndRankAthletesByScope(
  athletes: AthleteProfile[],
  params: {
    scope: RankingScope;
    country?: string;
    state?: string;
    city?: string;
    arenaId?: string;
    levelFilter?: AthleteLevel | 'all';
    searchQuery?: string;
  }
): RankedAthleteRow[] {
  const sortedGlobal = [...athletes].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.titlesCount - a.titlesCount;
  });

  const globalPosMap = new Map<string, number>();
  sortedGlobal.forEach((ath, idx) => {
    globalPosMap.set(ath.id, idx + 1);
  });

  // 1. Filter by geographic / organizational scope first
  const scopedList = sortedGlobal.filter((ath) => {
    const athCountry = ath.country || 'Brasil';
    const athState = ath.state || 'GO';
    const athCityClean = (ath.city || 'Mineiros').split(' - ')[0].trim();
    const athArenaId = ath.arenaId || 'conflora';

    if (params.scope === 'pais' && params.country && params.country !== 'all') {
      if (athCountry !== params.country) return false;
    }
    if (params.scope === 'estado' && params.state && params.state !== 'all') {
      if (athState !== params.state) return false;
    }
    if (params.scope === 'cidade' && params.city && params.city !== 'all') {
      if (athCityClean.toLowerCase() !== params.city.toLowerCase()) return false;
    }
    if (params.scope === 'arena' && params.arenaId && params.arenaId !== 'all') {
      if (athArenaId !== params.arenaId) return false;
    }
    return true;
  });

  // 2. Compute exact position within the active Scope (1º, 2º, 3º...)
  const rankedInScope: RankedAthleteRow[] = scopedList.map((ath, idx) => ({
    ...ath,
    scopePosition: idx + 1,
    globalPosition: globalPosMap.get(ath.id) || idx + 1,
  }));

  // 3. Apply optional technical level or text search filter while preserving scopePosition
  return rankedInScope.filter((ath) => {
    if (params.levelFilter && params.levelFilter !== 'all' && ath.level !== params.levelFilter) {
      return false;
    }
    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.toLowerCase();
      const matchName = ath.name.toLowerCase().includes(q);
      const matchCity = (ath.city || '').toLowerCase().includes(q);
      const matchArena = (ath.arenaName || '').toLowerCase().includes(q);
      if (!matchName && !matchCity && !matchArena) return false;
    }
    return true;
  });
}

/**
 * Formata a data de entrada do atleta na plataforma SHARK SET (ex: "Out/2026")
 */
export function formatSharksetSince(dateStr?: string): string {
  if (!dateStr) return 'Out/2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Out/2026';
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[d.getMonth()]}/${d.getFullYear()}`;
  } catch {
    return 'Out/2026';
  }
}


