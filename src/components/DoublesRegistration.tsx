import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  AthleteLevel,
  AthleteProfile,
  ExperienceCategory,
  RankingScope,
  SportType,
  TournamentCategory,
} from '../types';
import {
  ATHLETE_LEVEL_LABELS,
  RANKING_SCOPE_LABELS,
  TOURNAMENT_CATEGORY_LABELS,
  calculateFutevoleiMatchPoints,
  evaluateAthleteAntiSandbagging,
  extractAvailableRankingDimensions,
  filterAndRankAthletesByScope,
  getRankingPromotionSuggestion,
  validatePairCategory,
} from '../services/rankingValidator';
import { AthleteLevelBadge } from './AthleteLevelBadge';
import { AthleteEmailSelector } from './AthleteEmailSelector';
import { toast } from '../store/useToastStore';
import {
  Plus,
  Search,
  CheckCircle2,
  Trophy,
  ArrowRight,
  AlertCircle,
  UserPlus,
  Zap,
  TrendingUp,
  Globe,
  MapPin,
  Building2,
  Flag,
  X,
  Filter,
} from 'lucide-react';

export const DoublesRegistration: React.FC = () => {
  const {
    tenant,
    availableTenants,
    registeredPairs,
    registerDouble,
    togglePairPlayerPayment,
    rejectPairEnrollment,
    restorePairEnrollment,
    togglePairPresence,
    activeTournamentId,
    tournaments,
    setActiveTab,
    regenerateBracket,
    athletes,
    rankingLogs,
    addOrUpdateAthlete,
    changeAthleteLevel,
    awardAthletePoints,
    updateTournamentConfig,
  } = useApp();

  const [subView, setSubView] = useState<'ranking_atletas' | 'inscricao_duplas'>('inscricao_duplas');

  // Modals for operational actions (separated from visualization)
  const [isAddAthleteModalOpen, setIsAddAthleteModalOpen] = useState<boolean>(false);
  const [isRecordMatchModalOpen, setIsRecordMatchModalOpen] = useState<boolean>(false);

  // 5 Segmented Ranking Scopes: GERAL | PAÍS | ESTADO | CIDADE | ARENA
  const [rankingScope, setRankingScope] = useState<RankingScope>('geral');
  const [selectedCountry, setSelectedCountry] = useState<string>('Brasil');
  const [selectedState, setSelectedState] = useState<string>('GO');
  const [selectedCity, setSelectedCity] = useState<string>('Mineiros');
  const [selectedArenaId, setSelectedArenaId] = useState<string>(tenant.id);
  const [rankingFilterLevel, setRankingFilterLevel] = useState<'all' | AthleteLevel>('all');
  const [athleteSearch, setAthleteSearch] = useState<string>('');

  // Doubles / Singles registration state
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [paymentMethod] = useState<'pix' | 'cartao' | 'arena'>('pix');
  const [searchQuery, setSearchQuery] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmittingPair, setIsSubmittingPair] = useState(false);
  const pairSubmissionLock = useRef(false);

  // New Athlete Ranking registration state
  const [newAthName, setNewAthName] = useState('');
  const [newAthEmail, setNewAthEmail] = useState('');
  const [newAthPhone, setNewAthPhone] = useState('');
  const [newAthBirthDate, setNewAthBirthDate] = useState('1996-04-15');
  const [newAthExp, setNewAthExp] = useState<ExperienceCategory>('amador');
  const [newAthLevel, setNewAthLevel] = useState<AthleteLevel>('iniciante');
  const [newAthSport] = useState<SportType>('futevolei');
  const [newAthCountry, setNewAthCountry] = useState('Brasil');
  const [newAthState, setNewAthState] = useState('GO');
  const [newAthCity, setNewAthCity] = useState('Mineiros');
  const [newAthArenaId, setNewAthArenaId] = useState(tenant.id);

  // Interactive Match Ranking Calculator / Homologator (Performance + Opponent Level)
  const [simWinnerId, setSimWinnerId] = useState<string>(athletes[0]?.id || '');
  const [simLoserId, setSimLoserId] = useState<string>(athletes[4]?.id || athletes[1]?.id || '');
  const [simWinScore, setSimWinScore] = useState<number>(18);
  const [simLoseScore, setSimLoseScore] = useState<number>(12);

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];
  const isSingles = activeTournament.modalityFormat === 'simples';

  const selectedPlayer1 = useMemo(
    () => athletes.find((athlete) => (athlete.email || '').trim().toLowerCase() === player1) || null,
    [athletes, player1]
  );
  const selectedPlayer2 = useMemo(
    () => athletes.find((athlete) => (athlete.email || '').trim().toLowerCase() === player2) || null,
    [athletes, player2]
  );

  // Extract unique Countries, States, Cities, and Arenas via Clean Code service
  const dimensions = useMemo(() => extractAvailableRankingDimensions(athletes), [athletes]);

  // Filtered and ranked athletes by active scope (GERAL, PAÍS, ESTADO, CIDADE, ARENA)
  const rankedAthletes = useMemo(
    () =>
      filterAndRankAthletesByScope(athletes, {
        scope: rankingScope,
        country: selectedCountry,
        state: selectedState,
        city: selectedCity,
        arenaId: selectedArenaId,
        levelFilter: rankingFilterLevel,
        searchQuery: athleteSearch,
      }),
    [
      athletes,
      rankingScope,
      selectedCountry,
      selectedState,
      selectedCity,
      selectedArenaId,
      rankingFilterLevel,
      athleteSearch,
    ]
  );

  // Validate the selected pair against the active tournament's category + Cross-City Unified Passport + Anti-Sandbagging Ceiling
  const validation = useMemo(() => {
    const invalid = (reason: string) => ({
      isValid: false,
      reason,
      ruleSummary: 'Selecione atletas cadastrados; a categoria é carregada do perfil.',
      combinedWeight: 0,
      maxAllowedWeight: 0,
    });
    if (!selectedPlayer1) return invalid('Selecione o primeiro atleta pelo e-mail.');

    if (isSingles) {
      const check1 = evaluateAthleteAntiSandbagging(selectedPlayer1, selectedPlayer1.level, tenant.city);
      return {
        isValid: check1.isAllowed,
        reason: !check1.isAllowed
          ? check1.alertMessage || 'Bloqueado pelo Passaporte Único.'
          : `Inscrição Individual (Simples 1x1) liberada para ${ATHLETE_LEVEL_LABELS[check1.effectiveLevel]}.`,
        ruleSummary:
          'Passaporte Único Shark Set: Pontos exclusivos de torneios oficiais e bloqueio automático entre cidades.',
        combinedWeight: 1,
        maxAllowedWeight: 5,
      };
    }
    if (!selectedPlayer2) return invalid('Selecione o segundo atleta pelo e-mail.');
    if (selectedPlayer1.email?.trim().toLowerCase() === selectedPlayer2.email?.trim().toLowerCase()) {
      return invalid('A dupla precisa ter dois e-mails diferentes.');
    }
    const check1 = evaluateAthleteAntiSandbagging(selectedPlayer1, selectedPlayer1.level, tenant.city);
    const check2 = evaluateAthleteAntiSandbagging(selectedPlayer2, selectedPlayer2.level, tenant.city);
    if (!check1.isAllowed || !check2.isAllowed) {
      return invalid(check1.alertMessage || check2.alertMessage || 'Categoria bloqueada pelo Passaporte Único.');
    }
    return validatePairCategory(activeTournament.category, check1.effectiveLevel, check2.effectiveLevel);
  }, [isSingles, activeTournament.category, selectedPlayer1, selectedPlayer2, tenant.city]);

  const currentPairs = useMemo(() => {
    return registeredPairs.filter((p) => p.tournamentId === activeTournament.id);
  }, [registeredPairs, activeTournament.id]);

  const enrolledAthleteEmails = useMemo(
    () => new Set(currentPairs
      .filter((pair) => pair.enrollmentStatus !== 'rejected')
      .flatMap((pair) => [pair.player1Email, pair.player2Email])
      .filter((email): email is string => Boolean(email))
      .map((email) => email.trim().toLowerCase())),
    [currentPairs]
  );

  const filteredPairs = useMemo(() => {
    if (!searchQuery.trim()) return currentPairs;
    const q = searchQuery.toLowerCase();
    return currentPairs.filter(
      (p) =>
        p.player1.toLowerCase().includes(q) ||
        p.player2.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [currentPairs, searchQuery]);

  // Live preview of ELO/Performance calculation between selected Winner & Opponent
  const simWinnerAth = athletes.find((a) => a.id === simWinnerId) || athletes[0];
  const simLoserAth = athletes.find((a) => a.id === simLoserId) || athletes[1];

  const simCalc = useMemo(() => {
    if (!simWinnerAth || !simLoserAth) return null;
    return calculateFutevoleiMatchPoints({
      winnerLevels: [simWinnerAth.level],
      loserLevels: [simLoserAth.level],
      winnerScore: simWinScore,
      loserScore: simLoseScore,
      stage: 'winners',
    });
  }, [simWinnerAth, simLoserAth, simWinScore, simLoseScore]);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4500);
  };

  const handleSubmitPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (pairSubmissionLock.current || !selectedPlayer1 || (!isSingles && !selectedPlayer2)) return;
    if (!validation.isValid) return;

    pairSubmissionLock.current = true;
    setIsSubmittingPair(true);
    try {
      const newPair = registerDouble({
        tournamentId: activeTournament.id,
        player1Id: selectedPlayer1.id,
        player1Email: selectedPlayer1.email,
        player1Phone: selectedPlayer1.phone,
        player1: selectedPlayer1.name,
        player1Level: selectedPlayer1.level,
        player2Id: isSingles ? undefined : selectedPlayer2?.id,
        player2Email: isSingles ? undefined : selectedPlayer2?.email,
        player2Phone: isSingles ? undefined : selectedPlayer2?.phone,
        player2: isSingles ? 'Individual (1x1)' : selectedPlayer2!.name,
        player2Level: isSingles ? selectedPlayer1.level : selectedPlayer2!.level,
        phone: selectedPlayer1.phone || selectedPlayer2?.phone || '',
        category: activeTournament.category,
        paymentMethod,
        player1Paid: false,
        player2Paid: false,
      });

      setPlayer1('');
      setPlayer2('');
      toast.success('Inscrição realizada com sucesso!');
      triggerToast(`Vaga #${newPair.seed} reservada em ${activeTournament.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a inscrição.');
    } finally {
      setIsSubmittingPair(false);
      pairSubmissionLock.current = false;
    }
  };
  const handleAddAthlete = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = newAthEmail.trim().toLowerCase();
    if (!newAthName.trim() || !normalizedEmail) return;
    if (athletes.some((athlete) => (athlete.email || '').trim().toLowerCase() === normalizedEmail)) {
      toast.error('Este e-mail já está cadastrado. Selecione o perfil existente.');
      return;
    }

    const chosenArena =
      availableTenants.find((a) => a.id === newAthArenaId) ||
      dimensions.arenas.find((a) => a.id === newAthArenaId);

    addOrUpdateAthlete({
      name: newAthName.trim(),
      email: normalizedEmail,
      phone: newAthPhone.trim(),
      birthDate: newAthBirthDate,
      experienceCategory: newAthExp,
      level: newAthLevel,
      preferredSport: newAthSport,
      country: newAthCountry,
      state: newAthState,
      city: `${newAthCity.trim()} - ${newAthState}`,
      arenaId: newAthArenaId,
      arenaName: chosenArena ? chosenArena.name : tenant.name,
    });

    const addedName = newAthName;
    setNewAthName('');
    setNewAthEmail('');
    setNewAthPhone('');
    setIsAddAthleteModalOpen(false);
    toast.success(`Atleta "${addedName}" cadastrado com sucesso!`);
    triggerToast(
      `Jogador ${addedName} homologado no Ranking (${newAthCountry} · ${newAthState} · ${newAthCity} · ${
        chosenArena?.name || tenant.name
      })!`
    );
  };

  const handleApplySimulatedMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simWinnerAth || !simLoserAth || !simCalc) return;
    if (simWinnerAth.id === simLoserAth.id) {
      triggerToast('Selecione dois jogadores diferentes para registrar o confronto.');
      return;
    }

    awardAthletePoints(simWinnerAth.id, simCalc.winnerPoints, false);
    awardAthletePoints(simLoserAth.id, simCalc.loserPoints, false);

    setIsRecordMatchModalOpen(false);
    triggerToast(
      `Ranking atualizado automaticamente! ${simWinnerAth.name} ganhou +${simCalc.winnerPoints} pts (venceu oponente ${ATHLETE_LEVEL_LABELS[simLoserAth.level]} por ${simWinScore}x${simLoseScore}).`
    );
  };

  const scopeTabs: { id: RankingScope; label: string; emoji: string }[] = [
    { id: 'geral', label: 'Geral', emoji: '🌍' },
    { id: 'pais', label: 'País', emoji: '🏳️' },
    { id: 'estado', label: 'Estado', emoji: '📍' },
    { id: 'cidade', label: 'Cidade', emoji: '🏙️' },
    { id: 'arena', label: 'Arena', emoji: '🏟️' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* ===================================================================== */}
      {/* LEVEL 1: UNIFIED COMPACT HEADER + PRIMARY ACTION CTAs                 */}
      {/* ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#12C7BB] font-black uppercase tracking-wider text-[11px]">
              RANKING SHARK SET OFICIAL
            </span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-slate-300 font-semibold">
              {athletes.length} Jogadores Homologados
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            INSCRIÇÕES DO TORNEIO{' '}
            <span className="text-base sm:text-lg font-bold text-[#5BC3FA]">
              ({athletes.length} Jogadores Homologados)
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Alterne entre os escopos abaixo. Pontuação calculada por performance e nível do oponente.
          </p>
        </div>

        {/* Action Buttons on Top Right */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {subView === 'ranking_atletas' ? (
            <>
              <button
                type="button"
                onClick={() => setIsAddAthleteModalOpen(true)}
                className="px-3.5 py-2.5 rounded-lg bg-[#071D3D]/90 hover:bg-[#0B254E] text-slate-100 border border-slate-600/70 font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4 text-[#12C7BB]" />
                + Cadastrar Jogador
              </button>

              <button
                type="button"
                onClick={() => setIsRecordMatchModalOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#e66000] text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md"
              >
                <Zap className="w-4 h-4 fill-white" />
                ⚡ Registrar Partida
              </button>

              <button
                type="button"
                onClick={() => setSubView('inscricao_duplas')}
                className="px-3.5 py-2.5 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                ✍️ Inscrever no Torneio ({currentPairs.length}/{activeTournament.maxPairs})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('ranking_athletes')}
                className="px-3.5 py-2.5 rounded-lg bg-[#071D3D]/90 hover:bg-[#0B254E] text-slate-100 border border-slate-600/70 font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                ← Voltar para Tabela de Classificação
              </button>

              <button
                type="button"
                onClick={() => {
                  regenerateBracket(activeTournament.id);
                  setActiveTab('tournaments');
                }}
                className="px-4 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#e66000] text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md"
              >
                <Trophy className="w-4 h-4" />
                Abrir Chave do Torneio
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs text-emerald-100 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-300 hover:text-white font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: TABELA DE CLASSIFICAÇÃO PROTAGONISTA (100% LARGURA)       */}
      {/* ===================================================================== */}
      {subView === 'ranking_atletas' && (
        <div>
          {/* LEVEL 2: FOLDER/SPREADSHEET TABS ATTACHED DIRECTLY TO THE TABLE TOP */}
          <div className="flex flex-wrap items-end gap-1 border-b border-[#145A9B]/60 px-2">
            {scopeTabs.map((tab) => {
              const active = rankingScope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRankingScope(tab.id)}
                  className={`px-5 py-3 text-xs sm:text-sm font-extrabold rounded-t-xl transition-all flex items-center gap-2 border-t border-x -mb-px ${
                    active
                      ? 'bg-[#05182C] text-white border-[#145A9B]/80 border-t-2 border-t-[#FF6B00] shadow-sm z-10'
                      : 'bg-[#030F1E]/60 text-slate-400 hover:text-slate-200 hover:bg-[#05182C]/50 border-transparent'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* LEVEL 3: 100% WIDTH CLASSIFICATION TABLE CONTAINER */}
          <div className="aquarium-glass bg-[#05182C] border border-t-0 border-[#145A9B]/60 rounded-b-2xl rounded-tr-2xl shadow-2xl overflow-hidden">
            {/* Search & Filters Toolbar */}
            <div className="p-4 bg-[#041426]/90 border-b border-[#145A9B]/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                    placeholder="Buscar atleta, cidade ou arena..."
                    className="w-full pl-10 pr-8 py-2 text-xs font-medium bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
                  />
                  {athleteSearch && (
                    <button
                      type="button"
                      onClick={() => setAthleteSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Contextual Scope Selector (Country / State / City / Arena) */}
                {rankingScope === 'pais' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300 font-bold">País:</span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white"
                    >
                      {dimensions.countries.map((country) => (
                        <option key={country} value={country}>
                          🌍 {country}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {rankingScope === 'estado' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300 font-bold">Estado (UF):</span>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white"
                    >
                      {dimensions.states.map((st) => (
                        <option key={st} value={st}>
                          📍 {st}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {rankingScope === 'cidade' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300 font-bold">Cidade:</span>
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white"
                    >
                      {dimensions.cities.map((city) => (
                        <option key={city} value={city}>
                          🏙️ {city}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {rankingScope === 'arena' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300 font-bold">Arena:</span>
                    <select
                      value={selectedArenaId}
                      onChange={(e) => setSelectedArenaId(e.target.value)}
                      className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white"
                    >
                      {dimensions.arenas.map((arena) => (
                        <option key={arena.id} value={arena.id}>
                          🏟️ {arena.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Right Side: Category Dropdown Filter */}
              <div className="flex items-center gap-2 text-xs shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#12C7BB]" />
                <span className="text-slate-300 font-bold">Filtros:</span>
                <select
                  value={rankingFilterLevel}
                  onChange={(e) => setRankingFilterLevel(e.target.value as 'all' | AthleteLevel)}
                  className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
                >
                  <option value="all">Todas as Categorias ({athletes.length})</option>
                  {(['iniciante', 'serie_c', 'serie_b', 'serie_a', 'profissional'] as AthleteLevel[]).map(
                    (lvl) => (
                      <option key={lvl} value={lvl}>
                        {ATHLETE_LEVEL_LABELS[lvl]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* 100% Full-Width Classification Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#030E1C] border-b border-[#145A9B]/50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-20">#</th>
                    <th className="py-3.5 px-4">Atleta</th>
                    <th className="py-3.5 px-4">Categoria</th>
                    <th className="py-3.5 px-4">Cidade / Arena</th>
                    <th className="py-3.5 px-4 text-center">Jogos</th>
                    <th className="py-3.5 px-4">Win Rate</th>
                    <th className="py-3.5 px-4 text-right">Pts</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#145A9B]/30">
                  {rankedAthletes.map((ath) => {
                    const promo = getRankingPromotionSuggestion(
                      ath.points,
                      ath.titlesCount,
                      ath.level,
                      ath.levelWins,
                      ath.levelMatches
                    );
                    const matchesPlayed = ath.matchesPlayed || 0;
                    const wins = ath.wins || 0;
                    const losses = Math.max(0, matchesPlayed - wins);
                    const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;

                    return (
                      <tr
                        key={ath.id}
                        className={`hover:bg-[#0B254E]/50 transition-colors ${
                          ath.scopePosition === 1 ? 'bg-[#0B254E]/25' : ''
                        }`}
                      >
                        {/* # Position */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-7 h-7 rounded-md font-black text-xs flex items-center justify-center ${
                                ath.scopePosition === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : ath.scopePosition === 2
                                  ? 'bg-slate-200 text-slate-900'
                                  : ath.scopePosition === 3
                                  ? 'bg-amber-700/80 text-amber-100'
                                  : 'text-slate-300 font-bold'
                              }`}
                            >
                              {ath.scopePosition}º
                            </span>
                            {rankingScope !== 'geral' && (
                              <span
                                className="text-[11px] font-semibold text-slate-400"
                                title="Posição no Ranking Geral"
                              >
                                (#{ath.globalPosition})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Athlete */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">{ath.name}</span>
                            {ath.titlesCount > 0 && (
                              <span className="text-[11px] font-bold text-amber-400" title="Títulos conquistados">
                                🏆 {ath.titlesCount}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {promo.explanation}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <AthleteLevelBadge level={ath.level} size="sm" />
                          </div>
                        </td>

                        {/* City / Arena */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-100 block">
                            {ath.arenaName || tenant.name}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {(ath.city || 'Mineiros').split(' - ')[0]} · {ath.state || 'GO'} ({ath.country || 'Brasil'})
                          </span>
                        </td>

                        {/* Matches */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-extrabold text-white text-sm block">
                            {matchesPlayed}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            <strong className="text-emerald-400">{wins}V</strong> -{' '}
                            <strong className="text-rose-400">{losses}D</strong>
                          </span>
                        </td>

                        {/* Win Rate */}
                        <td className="py-3.5 px-4 min-w-[140px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-extrabold text-white text-sm">{winRate}%</span>
                            <span className="text-[10px] font-bold text-[#12C7BB]">
                              {winRate >= 70 ? 'Alto' : winRate >= 50 ? 'Positivo' : 'Regular'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#030B17] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                winRate >= 70
                                  ? 'bg-emerald-400'
                                  : winRate >= 50
                                  ? 'bg-[#0987CE]'
                                  : 'bg-slate-600'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, winRate))}%` }}
                            />
                          </div>
                        </td>

                        {/* Points */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-base font-black text-amber-400">
                            {ath.points}
                          </span>
                          {ath.lastPointsDelta ? (
                            <span className="block text-[10px] font-bold text-emerald-400">
                              +{ath.lastPointsDelta} últ.
                            </span>
                          ) : (
                            <span className="block text-[10px] text-slate-400 font-semibold">pts</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {promo.shouldPromote ? (
                              <button
                                type="button"
                                onClick={() => {
                                  changeAthleteLevel(ath.id, promo.recommendedLevel);
                                  triggerToast(
                                    `🎉 ${ath.name} promovido para ${ATHLETE_LEVEL_LABELS[promo.recommendedLevel]}!`
                                  );
                                }}
                                className="px-2.5 py-1.5 bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold rounded-md text-[11px]"
                              >
                                Promover →
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setPlayer1((ath.email || '').trim().toLowerCase());
                                  setPlayer2('');
                                  setSubView('inscricao_duplas');
                                }}
                                className="px-2.5 py-1.5 bg-[#071D3D] hover:bg-[#0B254E] text-slate-200 border border-slate-700 font-semibold rounded-md text-[11px]"
                              >
                                Inscrever
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {rankedAthletes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Nenhum atleta encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: CADASTRAR JOGADOR NO RANKING                                 */}
      {/* ===================================================================== */}
      {isAddAthleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-add-athlete-title"
        >
          <div className="aquarium-glass w-full max-w-lg bg-[#05182C] border border-[#145A9B] rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#145A9B]/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0987CE]/20 text-[#12C7BB] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="modal-add-athlete-title" className="text-base font-black text-white">
                    Cadastrar Jogador no Ranking
                  </h2>
                  <p className="text-xs text-slate-300">
                    Homologue um novo atleta com Passaporte Único em todos os 5 escopos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAthleteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAthlete} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-200 mb-1">Nome do Jogador:</label>
                <input
                  type="text"
                  required
                  value={newAthName}
                  onChange={(e) => setNewAthName(e.target.value)}
                  placeholder="Ex: Rodrigo Mineiros"
                  className="w-full px-3 py-2.5 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-200">E-mail único do atleta:</label>
                <input type="email" required value={newAthEmail} onChange={(event) => setNewAthEmail(event.target.value)} placeholder="atleta@email.com" className="w-full rounded-lg border border-[#145A9B]/60 bg-[#030D1A] px-3 py-2.5 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Data de Nascimento:</label>
                  <input
                    type="date"
                    value={newAthBirthDate}
                    onChange={(e) => setNewAthBirthDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-semibold text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Experiência:</label>
                  <select
                    value={newAthExp}
                    onChange={(e) => setNewAthExp(e.target.value as ExperienceCategory)}
                    className="w-full px-2.5 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-semibold text-white"
                  >
                    <option value="amador">Amador</option>
                    <option value="profissional">Profissional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">Série / Nível Técnico:</label>
                <select
                  value={newAthLevel}
                  onChange={(e) => setNewAthLevel(e.target.value as AthleteLevel)}
                  className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-bold text-white"
                >
                  {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">País:</label>
                  <input
                    type="text"
                    value={newAthCountry}
                    onChange={(e) => setNewAthCountry(e.target.value)}
                    className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Estado (UF):</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newAthState}
                    onChange={(e) => setNewAthState(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg uppercase font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Cidade:</label>
                  <input
                    type="text"
                    value={newAthCity}
                    onChange={(e) => setNewAthCity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Arena Base:</label>
                  <select
                    value={newAthArenaId}
                    onChange={(e) => setNewAthArenaId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-semibold text-white"
                  >
                    {availableTenants.map((ar) => (
                      <option key={ar.id} value={ar.id}>
                        {ar.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-200 mb-1">WhatsApp:</label>
                <input
                  type="tel"
                  value={newAthPhone}
                  onChange={(e) => setNewAthPhone(e.target.value)}
                  placeholder="(64) 99999-0000"
                  className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-semibold text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#145A9B]/40">
                <button
                  type="button"
                  onClick={() => setIsAddAthleteModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#e66000] text-white font-extrabold shadow-md"
                >
                  Homologar Jogador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: REGISTRAR PARTIDA (CÁLCULO DINÂMICO DE PONTOS)               */}
      {/* ===================================================================== */}
      {isRecordMatchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-record-match-title"
        >
          <div className="aquarium-glass w-full max-w-2xl bg-[#05182C] border border-[#145A9B] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#145A9B]/50">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="modal-record-match-title" className="text-base font-black text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" />
                    Registrar Partida · Cálculo Dinâmico de Pontos
                  </h2>
                  <span className="text-[11px] font-bold text-[#12C7BB]">
                    · Atualiza todos os 5 Rankings Simultaneamente
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Vencer um oponente de nível superior concede bônus extra de dificuldade, somado ao saldo de pontos do placar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordMatchModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplySimulatedMatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Jogador Vencedor:</label>
                  <select
                    value={simWinnerId}
                    onChange={(e) => setSimWinnerId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-bold text-white"
                  >
                    {athletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({ATHLETE_LEVEL_LABELS[a.level]})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-200 mb-1">Oponente Enfrentado:</label>
                  <select
                    value={simLoserId}
                    onChange={(e) => setSimLoserId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-bold text-white"
                  >
                    {athletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({ATHLETE_LEVEL_LABELS[a.level]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-bold text-slate-200 mb-1">Placar do Jogo:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={simWinScore}
                      onChange={(e) => setSimWinScore(parseInt(e.target.value, 10) || 18)}
                      className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-extrabold text-sm text-center text-white"
                    />
                    <span className="font-bold text-slate-400">x</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={simLoseScore}
                      onChange={(e) => setSimLoseScore(parseInt(e.target.value, 10) || 12)}
                      className="w-full px-3 py-2 bg-[#030D1A] border border-[#145A9B]/60 rounded-lg font-extrabold text-sm text-center text-white"
                    />
                  </div>
                </div>

                {/* Informational Preview (Simple non-clickable rectangular tag) */}
                {simCalc && (
                  <div className="p-3 rounded-lg bg-[#030D1A]/90 border-l-4 border-l-[#12C7BB] text-xs space-y-0.5">
                    <span className="font-extrabold text-[#12C7BB] block text-sm">
                      Vencedor recebe: +{simCalc.winnerPoints} pts
                    </span>
                    <span className="text-slate-300 block text-[11px]" title={simCalc.explanation}>
                      Performance: <strong>+{simCalc.performanceBonus}</strong> · Dificuldade do Oponente:{' '}
                      <strong>+{simCalc.opponentDifficultyBonus}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#145A9B]/40">
                <button
                  type="button"
                  onClick={() => setIsRecordMatchModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#e66000] text-white font-extrabold shadow-md"
                >
                  Registrar Resultado no Ranking
                </button>
              </div>
            </form>

            {/* Recent Matches Log inside the Modal */}
            {rankingLogs.length > 0 && (
              <div className="pt-4 border-t border-[#145A9B]/40 space-y-2.5">
                <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#12C7BB]" />
                  Últimos Jogos Contabilizados ({rankingLogs.length})
                </h3>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1 text-xs">
                  {rankingLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-[#030D1A]/80 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-white">
                          {log.winnerNames}{' '}
                          <span className="text-amber-400 font-extrabold">({log.score})</span>{' '}
                          {log.loserNames}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Jogo #{log.matchNumber} · {log.timestamp}
                        </span>
                      </div>
                      <span className="font-extrabold text-[#12C7BB] shrink-0">
                        +{log.pointsAwardedWinner} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ===================================================================== */}
      {/* SUB-VIEW 2: INSCRIÇÃO DE PARTICIPANTES / DUPLAS NO TORNEIO            */}
      {/* ===================================================================== */}
      {subView === 'inscricao_duplas' && (
        <div className="space-y-6">
          {/* Ultra-Clean Shareable Tournament Registration Link Banner */}
          <div className="aquarium-glass bg-[#071D3D] text-[#F7FAFD] border-2 border-[#0987CE] rounded-2xl p-5 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-0.5 rounded bg-[#0987CE] text-white font-black uppercase text-[10px]">
                  LINK OFICIAL DE INSCRIÇÃO · LIMPO, CLARO E DIRETO AO PONTO
                </span>
                <span className="font-bold text-[#12C7BB]">
                  Passaporte Único Anti-Sandbagging Ativo entre Cidades
                </span>
              </div>
              <h2 className="text-xl font-black text-white">
                Inscrição Rápida: {activeTournament.name} ({TOURNAMENT_CATEGORY_LABELS[activeTournament.category]})
              </h2>
              <p className="text-xs text-slate-300 max-w-3xl">
                Envie o link direto no grupo de WhatsApp ou bio do Instagram. O atleta entra, digita o nome da dupla em <strong>3 passos simples</strong> e garante a vaga na hora! O sistema barra automaticamente atletas de <strong>Série A tentando jogar Iniciante em outra cidade</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/?torneio=${activeTournament.id}&inscricao=rapida`;
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).catch(() => {});
                  }
                  triggerToast(
                    `🔗 Link Direto de Inscrição copiado (${url})! Pronto para colar no WhatsApp ou Instagram da Arena.`
                  );
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer shadow-md"
              >
                🔗 Copiar Link Direto de Inscrição
              </button>

            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="aquarium-glass bg-white border-2 border-slate-900 rounded-2xl p-5 shadow-xs h-fit space-y-4">
            <div className="pb-3 border-b border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-500" />
                  Garantir Vaga em 3 Cliques
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black text-[10px]">
                  R$ {activeTournament.registrationFee} / dupla
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] space-y-1">
                <span className="font-extrabold block uppercase text-[10px] text-amber-800">
                  Regra Oficial de Reserva de Vaga & Pagamento:
                </span>
                <p>
                  1. Ao fazer a inscrição, a dupla <strong>garante a vaga imediatamente como PENDENTE</strong>.<br />
                  2. A vaga só muda para <strong>CONFIRMADA</strong> após o pagamento dos <strong>2 jogadores</strong>.<br />
                  3. O Admin pode recusar a vaga a qualquer momento (com <strong>ressarcimento automático</strong> caso algum atleta já tenha pago).
                </p>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-slate-500 mb-1">
                  Regra da Categoria do Torneio:
                </label>
                <select
                  value={activeTournament.category}
                  onChange={(e) =>
                    updateTournamentConfig(activeTournament.id, {
                      category: e.target.value as TournamentCategory,
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
                >
                  {Object.entries(TOURNAMENT_CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSubmitPair} className="space-y-3.5 text-xs">
              <AthleteEmailSelector
                label={isSingles ? 'Atleta da inscrição individual' : 'Atleta 1 da dupla'}
                athletes={athletes}
                selectedEmail={player1}
                enrolledEmails={enrolledAthleteEmails}
                onSelectAthlete={(athlete) => setPlayer1((athlete?.email || '').trim().toLowerCase())}
              />
              {!isSingles && (
                <AthleteEmailSelector
                  label="Atleta 2 da dupla"
                  athletes={athletes}
                  selectedEmail={player2}
                  excludeEmail={player1}
                  enrolledEmails={enrolledAthleteEmails}
                  onSelectAthlete={(athlete) => setPlayer2((athlete?.email || '').trim().toLowerCase())}
                />
              )}
              <div className={`rounded-xl border p-3 ${validation.isValid ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-rose-300 bg-rose-50 text-rose-950'}`}>
                <strong className="block">{validation.reason}</strong>
                <span className="mt-1 block text-[11px] opacity-80">{validation.ruleSummary}</span>
              </div>
              <button
                type="submit"
                disabled={!validation.isValid || isSubmittingPair || currentPairs.filter((pair) => pair.enrollmentStatus !== 'rejected').length >= activeTournament.maxPairs}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-xs font-extrabold text-slate-950 transition-colors enabled:hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isSubmittingPair ? 'Processando inscrição…' : 'Inscrever dupla'}
              </button>
            </form>
          </div>

          {/* Registered Pairs List + Individual 2-Player Payment + Admin Rejection & Refund */}
          <div className="aquarium-glass lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">
                  Controle de Vagas, Pagamento por Atleta (2/2) & Aprovação Admin
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                    ✓ Confirmadas (2/2 Pagos):{' '}
                    {currentPairs.filter((p) => p.enrollmentStatus === 'confirmed').length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                    ⏳ Pendentes:{' '}
                    {
                      currentPairs.filter(
                        (p) => !p.enrollmentStatus || p.enrollmentStatus === 'pending'
                      ).length
                    }
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                    🚫 Recusadas / Ressarcidas:{' '}
                    {currentPairs.filter((p) => p.enrollmentStatus === 'rejected').length}
                  </span>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar inscrito..."
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-2">Vaga</th>
                    <th className="py-2.5 px-2">Atleta 1 (Pgto Individual)</th>
                    {!isSingles && <th className="py-2.5 px-2">Atleta 2 (Pgto Individual)</th>}
                    <th className="py-2.5 px-2 text-center">Presença</th>
                    <th className="py-2.5 px-2">Status da Vaga</th>
                    <th className="py-2.5 px-2 text-right">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPairs.map((pair) => {
                    const isRejected = pair.enrollmentStatus === 'rejected';
                    const p1Paid = pair.player1Paid ?? pair.isPaid;
                    const p2Paid = pair.player2Paid ?? pair.isPaid;
                    const isConfirmed = !isRejected && p1Paid && p2Paid;
                    const paidCount = (p1Paid ? 1 : 0) + (p2Paid ? 1 : 0);

                    return (
                      <tr
                        key={pair.id}
                        className={`transition-colors ${
                          isRejected ? 'bg-rose-50/40 opacity-80' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-2 font-mono font-bold text-slate-900">#{pair.seed}</td>

                        {/* Player 1 + Individual Payment Toggle */}
                        <td className="py-3 px-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  isRejected ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {pair.player1}
                              </span>
                              <AthleteLevelBadge level={pair.player1Level || 'iniciante'} size="xs" />
                            </div>
                            {!isRejected && (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = togglePairPlayerPayment(pair.id, 1);
                                  if (res?.enrollmentStatus === 'confirmed') {
                                    triggerToast(
                                      `✅ Os 2 jogadores pagaram! Vaga de ${pair.player1} & ${pair.player2} CONFIRMADA!`
                                    );
                                  } else {
                                    triggerToast(
                                      `Status de pagamento de ${pair.player1} atualizado.`
                                    );
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition-colors ${
                                  p1Paid
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                                title="Clique para alternar o pagamento do Atleta 1"
                              >
                                {p1Paid ? '✓ Atleta 1: PAGO' : '⏳ Atleta 1: Pendente (Marcar Pago)'}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Player 2 + Individual Payment Toggle */}
                        {!isSingles && (
                          <td className="py-3 px-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-bold ${
                                    isRejected ? 'line-through text-slate-400' : 'text-slate-900'
                                  }`}
                                >
                                  {pair.player2}
                                </span>
                                <AthleteLevelBadge level={pair.player2Level || 'iniciante'} size="xs" />
                              </div>
                              {!isRejected && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = togglePairPlayerPayment(pair.id, 2);
                                    if (res?.enrollmentStatus === 'confirmed') {
                                      triggerToast(
                                        `✅ Os 2 jogadores pagaram! Vaga de ${pair.player1} & ${pair.player2} CONFIRMADA!`
                                      );
                                    } else {
                                      triggerToast(
                                        `Status de pagamento de ${pair.player2} atualizado.`
                                      );
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold cursor-pointer transition-colors ${
                                    p2Paid
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}
                                  title="Clique para alternar o pagamento do Atleta 2"
                                >
                                  {p2Paid ? '✓ Atleta 2: PAGO' : '⏳ Atleta 2: Pendente (Marcar Pago)'}
                                </button>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Presence Check-in */}
                        <td className="py-3 px-2 text-center">
                          {!isRejected ? (
                            <button
                              type="button"
                              onClick={() => togglePairPresence(pair.id)}
                              className={`px-2 py-1 rounded-lg font-bold text-[10px] cursor-pointer ${
                                pair.isPresent !== false
                                  ? 'bg-slate-900 text-amber-400'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {pair.isPresent !== false ? '✓ Presente' : 'Ausente'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </td>

                        {/* Enrollment & Refund Status */}
                        <td className="py-3 px-2">
                          {isRejected ? (
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-black text-[10px] uppercase">
                                🚫 VAGA RECUSADA PELO ADMIN
                              </span>
                              {pair.refundStatus === 'refunded' && (
                                <span className="block text-[10px] font-bold text-emerald-700">
                                  💰 Dinheiro Ressarcido aos Atletas
                                </span>
                              )}
                            </div>
                          ) : isConfirmed ? (
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 font-black text-[10px] uppercase">
                                ✓ VAGA CONFIRMADA (2/2 PAGOS)
                              </span>
                              <span className="block text-[10px] text-slate-500">
                                Garantida na chave oficial
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-black text-[10px] uppercase">
                                ⏳ VAGA PENDENTE ({paidCount}/2 PAGOS)
                              </span>
                              <span className="block text-[10px] text-amber-800">
                                Vaga reservada · Falta pagamento de {2 - paidCount} atleta(s)
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Admin Reject / Restore Action */}
                        <td className="py-3 px-2 text-right">
                          {!isRejected ? (
                            <button
                              type="button"
                              onClick={() => {
                                const rej = rejectPairEnrollment(pair.id);
                                if (rej?.refundStatus === 'refunded') {
                                  triggerToast(
                                    `🚫 Vaga de ${pair.player1} & ${pair.player2} recusada pelo Admin! O valor já pago foi marcado para RESSARCIMENTO imediato.`
                                  );
                                } else {
                                  triggerToast(
                                    `🚫 Vaga pendente de ${pair.player1} & ${pair.player2} recusada pelo Admin.`
                                  );
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] cursor-pointer transition-colors"
                              title="Admin pode recusar a vaga a qualquer momento (ressarcindo valores pagos)"
                            >
                              Recusar Vaga
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                restorePairEnrollment(pair.id);
                                triggerToast(
                                  `Vaga de ${pair.player1} & ${pair.player2} restaurada pelo Admin.`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer transition-colors"
                            >
                              Restaurar Vaga
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
