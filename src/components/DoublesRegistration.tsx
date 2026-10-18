import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  AthleteLevel,
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
  validatePairWithUnifiedPassport,
} from '../services/rankingValidator';
import { AthleteLevelBadge } from './AthleteLevelBadge';
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

  const [subView, setSubView] = useState<'ranking_atletas' | 'inscricao_duplas'>('ranking_atletas');

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
  const [level1, setLevel1] = useState<AthleteLevel>('serie_c');
  const [player2, setPlayer2] = useState('');
  const [level2, setLevel2] = useState<AthleteLevel>('iniciante');
  const [phone, setPhone] = useState('');
  const [paymentMethod] = useState<'pix' | 'cartao' | 'arena'>('pix');
  const [searchQuery, setSearchQuery] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // New Athlete Ranking registration state
  const [newAthName, setNewAthName] = useState('');
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
    const matched1 = athletes.find((a) => a.name.toLowerCase() === player1.trim().toLowerCase());
    const matched2 = athletes.find((a) => a.name.toLowerCase() === player2.trim().toLowerCase());

    if (isSingles) {
      const check1 = evaluateAthleteAntiSandbagging(matched1, level1, tenant.city);
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

    return validatePairWithUnifiedPassport(
      activeTournament.category,
      player1,
      level1,
      player2,
      level2,
      athletes,
      tenant.city
    );
  }, [isSingles, activeTournament.category, player1, level1, player2, level2, athletes, tenant.city]);

  const currentPairs = useMemo(() => {
    return registeredPairs.filter((p) => p.tournamentId === activeTournament.id);
  }, [registeredPairs, activeTournament.id]);

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
    if (!validation.isValid) return;
    if (!player1.trim() || (!isSingles && !player2.trim()) || !phone.trim()) return;

    const newPair = registerDouble({
      tournamentId: activeTournament.id,
      player1: player1.trim(),
      player1Level: level1,
      player2: isSingles ? 'Individual (1x1)' : player2.trim(),
      player2Level: isSingles ? level1 : level2,
      phone: phone.trim(),
      category: activeTournament.category,
      paymentMethod,
      player1Paid: false,
      player2Paid: false,
    });

    setPlayer1('');
    setPlayer2('');
    setPhone('');
    triggerToast(
      `Vaga #${newPair.seed} reservada como PENDENTE em ${activeTournament.name}! A vaga será confirmada assim que os 2 atletas confirmarem o pagamento.`
    );
  };

  const handleAddAthlete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAthName.trim()) return;

    const chosenArena =
      availableTenants.find((a) => a.id === newAthArenaId) ||
      dimensions.arenas.find((a) => a.id === newAthArenaId);

    addOrUpdateAthlete({
      name: newAthName.trim(),
      phone: newAthPhone.trim() || '64999990000',
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

    setNewAthName('');
    setNewAthPhone('');
    triggerToast(
      `Jogador ${newAthName} homologado no Ranking (${newAthCountry} · ${newAthState} · ${newAthCity} · ${
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

    triggerToast(
      `Ranking atualizado automaticamente! ${simWinnerAth.name} ganhou +${simCalc.winnerPoints} pts (venceu oponente ${ATHLETE_LEVEL_LABELS[simLoserAth.level]} por ${simWinScore}x${simLoseScore}).`
    );
  };

  const activeScopeSubtitle = useMemo(() => {
    switch (rankingScope) {
      case 'pais':
        return `Classificação Nacional — País: ${selectedCountry}`;
      case 'estado':
        return `Classificação Estadual — UF: ${selectedState}`;
      case 'cidade':
        return `Classificação Municipal — Cidade: ${selectedCity}`;
      case 'arena': {
        const ar = dimensions.arenas.find((a) => a.id === selectedArenaId);
        return `Classificação Interna da Arena — ${ar?.name || tenant.name}`;
      }
      case 'geral':
      default:
        return 'Classificação Geral Unificada (Todos os Países, Estados, Cidades e Arenas)';
    }
  }, [rankingScope, selectedCountry, selectedState, selectedCity, selectedArenaId, dimensions.arenas, tenant.name]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & View Switcher — High-Contrast SHARK SET Visual Hierarchy */}
      <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-[#0987CE] text-white font-black uppercase text-[10px] shadow-xs">
                SHARK SET RANKING OFICIAL
              </span>
              <span aria-hidden="true" className="text-[#145A9B]">·</span>
              <span className="font-extrabold text-[#12C7BB]">
                5 Escopos: Geral · País · Estado · Cidade · Arena
              </span>
              <span aria-hidden="true" className="text-[#145A9B]">·</span>
              <span className="font-semibold text-white">{athletes.length} Jogadores Homologados</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ranking SHARK SET Multi-Escopo & Inscrições
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Alterne em 1 clique entre <strong>RANKING GERAL</strong>, <strong>POR PAÍS</strong>, <strong>POR ESTADO</strong>, <strong>POR CIDADE</strong> e <strong>POR ARENA</strong>. Pontuação calculada automaticamente por performance e nível do oponente.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                regenerateBracket(activeTournament.id);
                setActiveTab('tournaments');
              }}
              className="px-4 py-2.5 text-xs font-black text-slate-950 bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md"
            >
              <Trophy className="w-4 h-4 fill-slate-950" />
              ABRIR TABELA & CLASSIFICAÇÃO
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* High-Visibility Sub-Tabs */}
        <div className="pt-3 border-t border-[#145A9B]/60 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('ranking_athletes')}
            className="px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer bg-[#071D3D] text-[#12C7BB] hover:bg-[#0B254E] border border-[#145A9B] flex items-center gap-1.5 shadow-xs"
          >
            <Trophy className="w-3.5 h-3.5 text-[#12C7BB]" />
            LÍDERES & WIN RATES (RANKING BOARD FIRESTORE) →
          </button>
          <button
            onClick={() => setSubView('ranking_atletas')}
            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
              subView === 'ranking_atletas'
                ? 'bg-[#0987CE] text-white shadow-md'
                : 'bg-[#071D3D] text-slate-300 hover:text-white border border-[#145A9B]'
            }`}
          >
            🏆 RANKINGS: GERAL · PAÍS · ESTADO · CIDADE · ARENA ({athletes.length})
          </button>
          <button
            onClick={() => setSubView('inscricao_duplas')}
            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
              subView === 'inscricao_duplas'
                ? 'bg-[#0987CE] text-white shadow-md'
                : 'bg-[#071D3D] text-slate-300 hover:text-white border border-[#145A9B]'
            }`}
          >
            ✍️ INSCREVER NO TORNEIO & VALIDAR DUPLA ({currentPairs.length}/{activeTournament.maxPairs})
          </button>
        </div>
      </div>

      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 font-bold p-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: SISTEMA DE RANKING SEGMENTADO (5 ESCOPOS)                 */}
      {/* ===================================================================== */}
      {subView === 'ranking_atletas' && (
        <div className="space-y-6">
          {/* 5-SCOPE SEGMENTATION BAR: GERAL | PAÍS | ESTADO | CIDADE | ARENA */}
          <div className="aquarium-glass bg-[#071D3D] text-[#F7FAFD] border border-[#145A9B] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0987CE] block">
                  SEPARAÇÃO OFICIAL DE RANKING (1 CLIQUE)
                </span>
                <h2 className="text-base font-black text-white">
                  Escolha a Visão do Ranking: {RANKING_SCOPE_LABELS[rankingScope]}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'geral', label: '1. RANKING GERAL', icon: Globe },
                    { id: 'pais', label: '2. RANKING POR PAÍS', icon: Flag },
                    { id: 'estado', label: '3. RANKING POR ESTADO', icon: MapPin },
                    { id: 'cidade', label: '4. RANKING POR CIDADE', icon: MapPin },
                    { id: 'arena', label: '5. RANKING POR ARENA', icon: Building2 },
                  ] as { id: RankingScope; label: string; icon: React.FC<{ className?: string }> }[]
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = rankingScope === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setRankingScope(tab.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#0987CE] text-white shadow-xs'
                          : 'bg-[#030B17] hover:bg-[#0B254E] text-slate-300 border border-[#145A9B]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Scope Selector Pills (Country / State / City / Arena) */}
            {rankingScope !== 'geral' && (
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                {rankingScope === 'pais' && (
                  <>
                    <span className="font-bold text-slate-400 mr-1">Selecione o País:</span>
                    {dimensions.countries.map((country) => (
                      <button
                        key={country}
                        onClick={() => setSelectedCountry(country)}
                        className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors ${
                          selectedCountry === country
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        🌍 {country}
                      </button>
                    ))}
                  </>
                )}

                {rankingScope === 'estado' && (
                  <>
                    <span className="font-bold text-slate-400 mr-1">Selecione o Estado (UF):</span>
                    {dimensions.states.map((st) => (
                      <button
                        key={st}
                        onClick={() => setSelectedState(st)}
                        className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors ${
                          selectedState === st
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        📍 Estado: {st}
                      </button>
                    ))}
                  </>
                )}

                {rankingScope === 'cidade' && (
                  <>
                    <span className="font-bold text-slate-400 mr-1">Selecione a Cidade:</span>
                    {dimensions.cities.map((city) => (
                      <button
                        key={city}
                        onClick={() => setSelectedCity(city)}
                        className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors ${
                          selectedCity === city
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        🏙️ {city}
                      </button>
                    ))}
                  </>
                )}

                {rankingScope === 'arena' && (
                  <>
                    <span className="font-bold text-slate-400 mr-1">Selecione a Arena:</span>
                    {dimensions.arenas.map((arena) => (
                      <button
                        key={arena.id}
                        onClick={() => setSelectedArenaId(arena.id)}
                        className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors ${
                          selectedArenaId === arena.id
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        🏟️ {arena.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Interactive Match Points Simulator (Performance + Opponent Level) */}
          <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Cálculo Dinâmico de Pontos (Performance + Nível do Oponente)
                </h2>
                <p className="text-xs text-slate-500">
                  Vencer um oponente de nível superior concede bônus extra de dificuldade, somado ao saldo de pontos do placar.
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-700 font-bold">
                Atualiza todos os 5 Rankings Simultaneamente
              </span>
            </div>

            <form
              onSubmit={handleApplySimulatedMatch}
              className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jogador Vencedor:</label>
                <select
                  value={simWinnerId}
                  onChange={(e) => setSimWinnerId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                >
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({ATHLETE_LEVEL_LABELS[a.level]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Oponente Enfrentado:</label>
                <select
                  value={simLoserId}
                  onChange={(e) => setSimLoserId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                >
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({ATHLETE_LEVEL_LABELS[a.level]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placar do Jogo:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={simWinScore}
                    onChange={(e) => setSimWinScore(parseInt(e.target.value, 10) || 18)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-center"
                  />
                  <span className="font-bold text-slate-400">x</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={simLoseScore}
                    onChange={(e) => setSimLoseScore(parseInt(e.target.value, 10) || 12)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-center"
                  />
                </div>
              </div>

              {simCalc && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px]">
                  <span className="font-extrabold text-emerald-900 block">
                    Vencedor recebe: +{simCalc.winnerPoints} pts
                  </span>
                  <span className="text-emerald-700 block truncate" title={simCalc.explanation}>
                    Perf: +{simCalc.performanceBonus} | Oponente: +{simCalc.opponentDifficultyBonus}
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Registrar Resultado no Ranking
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add New Athlete to Ranking with Country, State, City, Arena */}
            <div className="space-y-6">
              <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-5 shadow-xs h-fit space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <UserPlus className="w-4 h-4 text-slate-700" />
                  Cadastrar Jogador no Ranking
                </h3>

                <form onSubmit={handleAddAthlete} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nome do Jogador:</label>
                    <input
                      type="text"
                      required
                      value={newAthName}
                      onChange={(e) => setNewAthName(e.target.value)}
                      placeholder="Ex: Rodrigo Mineiros"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Data de Nascimento:</label>
                      <input
                        type="date"
                        value={newAthBirthDate}
                        onChange={(e) => setNewAthBirthDate(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Experiência:</label>
                      <select
                        value={newAthExp}
                        onChange={(e) => setNewAthExp(e.target.value as ExperienceCategory)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                      >
                        <option value="amador">Amador</option>
                        <option value="profissional">Profissional</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Série / Nível Técnico:</label>
                    <select
                      value={newAthLevel}
                      onChange={(e) => setNewAthLevel(e.target.value as AthleteLevel)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                    >
                      {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">País:</label>
                      <input
                        type="text"
                        value={newAthCountry}
                        onChange={(e) => setNewAthCountry(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Estado (UF):</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={newAthState}
                        onChange={(e) => setNewAthState(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Cidade:</label>
                      <input
                        type="text"
                        value={newAthCity}
                        onChange={(e) => setNewAthCity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Arena Base:</label>
                      <select
                        value={newAthArenaId}
                        onChange={(e) => setNewAthArenaId(e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
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
                    <label className="block font-semibold text-slate-700 mb-1">WhatsApp:</label>
                    <input
                      type="tel"
                      value={newAthPhone}
                      onChange={(e) => setNewAthPhone(e.target.value)}
                      placeholder="(64) 99999-0000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Homologar Jogador no Ranking
                  </button>
                </form>
              </div>

              {/* Log de Atualizações Automáticas do Ranking */}
              <div className="aquarium-glass bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Últimos Jogos Contabilizados ({rankingLogs.length})
                </h3>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
                  {rankingLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>
                          Jogo #{log.matchNumber} · {log.timestamp}
                        </span>
                        <span className="font-bold text-emerald-700">+{log.pointsAwardedWinner} pts</span>
                      </div>
                      <p className="font-bold text-slate-900">
                        {log.winnerNames} <span className="font-mono text-amber-700">({log.score})</span>{' '}
                        {log.loserNames}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">{log.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Official Ranking Table with Scope Position, Global Position, Location & Auto-Promotion */}
            <div className="aquarium-glass lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-amber-400 font-black text-[10px] uppercase">
                      {RANKING_SCOPE_LABELS[rankingScope]}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      {rankedAthletes.length} atleta(s) listado(s)
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{activeScopeSubtitle}</h3>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                    placeholder="Buscar atleta, cidade ou arena..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Technical Level Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setRankingFilterLevel('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                      rankingFilterLevel === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Todas as Séries
                  </button>
                  {(['iniciante', 'serie_c', 'serie_b', 'serie_a', 'profissional'] as AthleteLevel[]).map(
                    (lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setRankingFilterLevel(lvl)}
                        className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                          rankingFilterLevel === lvl ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {ATHLETE_LEVEL_LABELS[lvl]}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Posição ({rankingScope.toUpperCase()})</th>
                      <th className="py-2.5 px-3">Jogador · País / Estado / Cidade / Arena</th>
                      <th className="py-2.5 px-3">Série / Badge</th>
                      <th className="py-2.5 px-3">Pontos & Evolução</th>
                      <th className="py-2.5 px-3 text-center">V / J (Aprov.)</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rankedAthletes.map((ath) => {
                      const promo = getRankingPromotionSuggestion(ath.points, ath.titlesCount, ath.level);
                      const winRate =
                        ath.matchesPlayed > 0 ? Math.round((ath.wins / ath.matchesPlayed) * 100) : 0;

                      return (
                        <tr key={ath.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-7 h-7 rounded-lg font-mono font-extrabold text-xs flex items-center justify-center ${
                                  ath.scopePosition === 1
                                    ? 'bg-amber-400 text-amber-950'
                                    : ath.scopePosition === 2
                                    ? 'bg-slate-200 text-slate-900'
                                    : ath.scopePosition === 3
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {ath.scopePosition}º
                              </span>
                              {rankingScope !== 'geral' && (
                                <span
                                  className="text-[10px] font-mono text-slate-400"
                                  title="Posição no Ranking Geral"
                                >
                                  (#{ath.globalPosition} Geral)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{ath.name}</span>
                            <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-700">
                                {ath.country || 'Brasil'}
                              </span>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                                {ath.state || 'GO'}
                              </span>
                              <span>·</span>
                              <span>{(ath.city || 'Mineiros').split(' - ')[0]}</span>
                              <span>·</span>
                              <span className="text-amber-700 font-semibold">
                                {ath.arenaName || 'SHARK SET Arena Matriz'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex flex-col items-start gap-1">
                              <AthleteLevelBadge level={ath.level} size="sm" />
                              <select
                                value={ath.level}
                                onChange={(e) => {
                                  const nextLvl = e.target.value as AthleteLevel;
                                  changeAthleteLevel(ath.id, nextLvl);
                                  triggerToast(
                                    `Nível de ${ath.name} alterado para ${ATHLETE_LEVEL_LABELS[nextLvl]}.`
                                  );
                                }}
                                className="text-[10px] text-slate-400 bg-transparent underline cursor-pointer focus:outline-none"
                              >
                                {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                                  <option key={k} value={k}>
                                    Mudar p/ {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1 max-w-[180px]">
                              <div className="flex items-center justify-between font-mono text-xs">
                                <strong className="text-slate-900 text-sm">{ath.points} pts</strong>
                                {ath.lastPointsDelta && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    +{ath.lastPointsDelta} últ.
                                  </span>
                                )}
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    promo.shouldPromote ? 'bg-amber-500' : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${promo.progressPercent}%` }}
                                />
                              </div>
                              <span
                                className="text-[10px] text-slate-400 block truncate"
                                title={promo.explanation}
                              >
                                {promo.explanation}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center font-mono">
                            <span className="font-bold text-slate-900 block">
                              {ath.wins}V / {ath.matchesPlayed}J
                            </span>
                            <span className="text-[10px] text-emerald-700 font-bold">{winRate}% aprov.</span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {promo.shouldPromote && (
                                <button
                                  onClick={() => {
                                    changeAthleteLevel(ath.id, promo.recommendedLevel);
                                    triggerToast(
                                      `🎉 ${ath.name} promovido para ${ATHLETE_LEVEL_LABELS[promo.recommendedLevel]}!`
                                    );
                                  }}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-xs"
                                >
                                  Promover p/ {ATHLETE_LEVEL_LABELS[promo.recommendedLevel]}
                                </button>
                              )}
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
              <button
                type="button"
                onClick={() => {
                  setPlayer1('Lucas Pingo');
                  setLevel1('iniciante');
                  setPlayer2('Juninho Silva');
                  setLevel2('iniciante');
                  triggerToast(
                    '🛡️ Teste Anti-Sandbagging: Lucas Pingo é Série A em Mineiros/GO e tentou se inscrever como Iniciante — veja o bloqueio automático no formulário!'
                  );
                }}
                className="px-3.5 py-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[#12C7BB] font-bold text-xs cursor-pointer"
              >
                🛡️ Testar Bloqueio Série A em Outra Cidade
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
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    {isSingles ? 'Jogador (Simples 1x1):' : 'Atleta 1:'}
                  </label>
                  <AthleteLevelBadge level={level1} size="xs" />
                </div>
                <input
                  type="text"
                  required
                  list="athletes-datalist"
                  value={player1}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlayer1(val);
                    const matched = athletes.find((a) => a.name.toLowerCase() === val.toLowerCase());
                    if (matched) setLevel1(matched.level);
                  }}
                  placeholder="Digite ou escolha do ranking"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Nível no Ranking:</span>
                  <select
                    value={level1}
                    onChange={(e) => setLevel1(e.target.value as AthleteLevel)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                  >
                    {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!isSingles && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Atleta 2 (Parceiro):</label>
                    <AthleteLevelBadge level={level2} size="xs" />
                  </div>
                  <input
                    type="text"
                    required
                    list="athletes-datalist"
                    value={player2}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlayer2(val);
                      const matched = athletes.find((a) => a.name.toLowerCase() === val.toLowerCase());
                      if (matched) setLevel2(matched.level);
                    }}
                    placeholder="Digite ou escolha do ranking"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Nível no Ranking:</span>
                    <select
                      value={level2}
                      onChange={(e) => setLevel2(e.target.value as AthleteLevel)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                    >
                      {Object.entries(ATHLETE_LEVEL_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <datalist id="athletes-datalist">
                {athletes.map((a) => (
                  <option key={a.id} value={a.name}>
                    {ATHLETE_LEVEL_LABELS[a.level]} ({a.points} pts)
                  </option>
                ))}
              </datalist>

              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  validation.isValid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{validation.reason}</span>
                    <span className="text-[11px] opacity-80 block mt-0.5">{validation.ruleSummary}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp de Contato:</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (64) 99988-1122"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={
                  !validation.isValid ||
                  currentPairs.filter((p) => p.enrollmentStatus !== 'rejected').length >=
                    activeTournament.maxPairs
                }
                className={`w-full py-2.5 px-4 text-xs font-extrabold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                  validation.isValid &&
                  currentPairs.filter((p) => p.enrollmentStatus !== 'rejected').length <
                    activeTournament.maxPairs
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="w-4 h-4" />
                {currentPairs.filter((p) => p.enrollmentStatus !== 'rejected').length >=
                activeTournament.maxPairs
                  ? 'Limite de Vagas Atingido'
                  : 'Garantir Vaga (Fica Pendente até Pagamento 2/2)'}
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
