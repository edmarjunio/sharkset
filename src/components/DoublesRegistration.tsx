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
    addOrUpdateAthlete,
    changeAthleteLevel,
    updateTournamentConfig,
  } = useApp();

  const [subView, setSubView] = useState<'ranking_atletas' | 'inscricao_duplas'>('inscricao_duplas');

  // Modals for operational actions (separated from visualization)
  const [isAddAthleteModalOpen, setIsAddAthleteModalOpen] = useState<boolean>(false);

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

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];
  const isSingles = activeTournament?.modalityFormat === 'simples';

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
    if (!activeTournament) return invalid('Nenhum torneio cadastrado para inscrição.');
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
  }, [isSingles, activeTournament?.category, selectedPlayer1, selectedPlayer2, tenant.city]);

  const currentPairs = useMemo(() => {
    return activeTournament ? registeredPairs.filter((p) => p.tournamentId === activeTournament.id) : [];
  }, [registeredPairs, activeTournament?.id]);

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

  const scopeTabs: { id: RankingScope; label: string; emoji: string }[] = [
    { id: 'geral', label: 'Geral', emoji: '🌍' },
    { id: 'pais', label: 'País', emoji: '🏳️' },
    { id: 'estado', label: 'Estado', emoji: '📍' },
    { id: 'cidade', label: 'Cidade', emoji: '🏙️' },
    { id: 'arena', label: 'Arena', emoji: '🏟️' },
  ];

  if (!activeTournament) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-slate-300" role="status">
        <h1 className="text-xl font-bold text-white">Nenhum torneio cadastrado</h1>
        <p className="mt-2">Cadastre um torneio para abrir inscrições de atletas ou duplas.</p>
      </div>
    );
  }

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

    </div>
  );
};
