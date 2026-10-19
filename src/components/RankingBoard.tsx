import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AthleteLevel, AthleteProfile, ExperienceCategory, RankingScope, SportType } from '../types';
import {
  auth,
  fetchTopAthletesFromFirestore,
  seedAthletesToFirestore,
  signInWithGooglePopup,
} from '../lib/firebase';
import {
  ATHLETE_LEVEL_LABELS,
  calculateFutevoleiMatchPoints,
  extractAvailableRankingDimensions,
  filterAndRankAthletesByScope,
} from '../services/rankingValidator';
import { AthleteLevelBadge } from './AthleteLevelBadge';
import { FreeBroadcastPanel } from './FreeBroadcastPanel';
import {
  Trophy,
  Search,
  Filter,
  RefreshCw,
  Database,
  AlertCircle,
  ArrowUpDown,
  Sparkles,
  ShieldCheck,
  MapPin,
  Download,
  UserPlus,
  Zap,
  X,
  TrendingUp,
} from 'lucide-react';

export const RankingBoard: React.FC = () => {
  const {
    athletes: localAthletes,
    tenant,
    availableTenants,
    setActiveTab,
    addOrUpdateAthlete,
    awardAthletePoints,
    rankingLogs,
  } = useApp();

  const [firestoreAthletes, setFirestoreAthletes] = useState<AthleteProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Operational Modals (separated from visualization)
  const [isAddAthleteModalOpen, setIsAddAthleteModalOpen] = useState<boolean>(false);
  const [isRecordMatchModalOpen, setIsRecordMatchModalOpen] = useState<boolean>(false);

  // 5 Segmented Scopes: GERAL | PAÍS | ESTADO | CIDADE | ARENA
  const [rankingScope, setRankingScope] = useState<RankingScope>('geral');
  const [selectedCountry, setSelectedCountry] = useState<string>('Brasil');
  const [selectedState, setSelectedState] = useState<string>('GO');
  const [selectedCity, setSelectedCity] = useState<string>('Mineiros');
  const [selectedArenaId, setSelectedArenaId] = useState<string>(tenant.id);

  // Filters & Sorting
  const [selectedCategory, setSelectedCategory] = useState<AthleteLevel | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'points' | 'winRate' | 'wins' | 'titles'>('points');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // New Athlete Modal Form State
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

  // Record Match Modal Form State
  const [simWinnerId, setSimWinnerId] = useState<string>(localAthletes[0]?.id || '');
  const [simLoserId, setSimLoserId] = useState<string>(localAthletes[4]?.id || localAthletes[1]?.id || '');
  const [simWinScore, setSimWinScore] = useState<number>(18);
  const [simLoseScore, setSimLoseScore] = useState<number>(12);

  // Load from Firestore on mount
  const loadAthletesFromFirestore = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const data = await fetchTopAthletesFromFirestore(100);
      if (data && data.length > 0) {
        setFirestoreAthletes(data);
      } else {
        setFirestoreAthletes(localAthletes);
      }
    } catch {
      setFirestoreAthletes(localAthletes);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAthletesFromFirestore();
  }, [localAthletes]);

  // Handle 1-Click Sync to Firestore
  const handleSyncToFirestore = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        await signInWithGooglePopup();
      }
      const count = await seedAthletesToFirestore(localAthletes);
      setStatusMessage(`✅ Sucesso! ${count} atletas foram sincronizados e gravados no Firestore!`);
      await loadAthletesFromFirestore();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na sincronização';
      setStatusMessage(`Aviso: ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute Active Athletes List (from Firestore or Fallback)
  const sourceAthletes = useMemo(() => {
    return firestoreAthletes.length > 0 ? firestoreAthletes : localAthletes;
  }, [firestoreAthletes, localAthletes]);

  const dimensions = useMemo(
    () => extractAvailableRankingDimensions(sourceAthletes),
    [sourceAthletes]
  );

  // Category-specific rankings computation
  const categoryRankMap = useMemo(() => {
    const map = new Map<string, number>();
    const grouped = new Map<AthleteLevel, AthleteProfile[]>();

    sourceAthletes.forEach((ath) => {
      const list = grouped.get(ath.level) || [];
      list.push(ath);
      grouped.set(ath.level, list);
    });

    grouped.forEach((list) => {
      list.sort((a, b) => {
        if ((b.points || 0) !== (a.points || 0)) {
          return (b.points || 0) - (a.points || 0);
        }
        const wrA = (a.matchesPlayed || 0) > 0 ? (a.wins || 0) / (a.matchesPlayed || 1) : 0;
        const wrB = (b.matchesPlayed || 0) > 0 ? (b.wins || 0) / (b.matchesPlayed || 1) : 0;
        return wrB - wrA;
      });

      list.forEach((ath, idx) => {
        map.set(`${ath.id}_${ath.level}`, idx + 1);
      });
    });

    return map;
  }, [sourceAthletes]);

  // Scope-filtered & Sorted Athletes
  const processedAthletes = useMemo(() => {
    const scoped = filterAndRankAthletesByScope(sourceAthletes, {
      scope: rankingScope,
      country: selectedCountry,
      state: selectedState,
      city: selectedCity,
      arenaId: selectedArenaId,
      levelFilter: selectedCategory,
      searchQuery: searchTerm,
    });

    const list = [...scoped];

    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortBy === 'points') {
        valA = a.points || 0;
        valB = b.points || 0;
      } else if (sortBy === 'winRate') {
        valA = (a.matchesPlayed || 0) > 0 ? ((a.wins || 0) / a.matchesPlayed!) * 100 : 0;
        valB = (b.matchesPlayed || 0) > 0 ? ((b.wins || 0) / b.matchesPlayed!) * 100 : 0;
      } else if (sortBy === 'wins') {
        valA = a.wins || 0;
        valB = b.wins || 0;
      } else if (sortBy === 'titles') {
        valA = a.titlesCount || 0;
        valB = b.titlesCount || 0;
      }

      if (sortDirection === 'desc') {
        return valB - valA;
      }
      return valA - valB;
    });

    return list;
  }, [
    sourceAthletes,
    rankingScope,
    selectedCountry,
    selectedState,
    selectedCity,
    selectedArenaId,
    selectedCategory,
    searchTerm,
    sortBy,
    sortDirection,
  ]);

  const simWinnerAth = sourceAthletes.find((a) => a.id === simWinnerId) || sourceAthletes[0];
  const simLoserAth = sourceAthletes.find((a) => a.id === simLoserId) || sourceAthletes[1];

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

    const addedName = newAthName;
    setNewAthName('');
    setNewAthPhone('');
    setIsAddAthleteModalOpen(false);
    setStatusMessage(
      `✅ Jogador ${addedName} homologado no Ranking (${newAthCountry} · ${newAthState} · ${newAthCity})!`
    );
  };

  const handleApplySimulatedMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simWinnerAth || !simLoserAth || !simCalc) return;
    if (simWinnerAth.id === simLoserAth.id) {
      setStatusMessage('Selecione dois jogadores diferentes para registrar o confronto.');
      return;
    }

    awardAthletePoints(simWinnerAth.id, simCalc.winnerPoints, false);
    awardAthletePoints(simLoserAth.id, simCalc.loserPoints, false);

    setIsRecordMatchModalOpen(false);
    setStatusMessage(
      `✅ Partida registrada! ${simWinnerAth.name} recebeu +${simCalc.winnerPoints} pts (${simWinScore}x${simLoseScore} contra ${simLoserAth.name}).`
    );
  };

  const exportRankingCSV = () => {
    const lines: string[] = ['\uFEFF'];
    lines.push('RANKING OFICIAL DE ATLETAS SHARK SET - CLOUD FIRESTORE');
    lines.push(`Gerado em:;${new Date().toLocaleString('pt-BR')}`);
    lines.push(
      `Categoria Selecionada:;${
        selectedCategory === 'all' ? 'Todas' : ATHLETE_LEVEL_LABELS[selectedCategory]
      }`
    );
    lines.push('');
    lines.push(
      'Pos Geral;Pos Categoria;Atleta;Categoria;Pontos;Jogos;Vitórias;Derrotas;Taxa de Vitória (Win Rate %);Títulos;Cidade;Arena'
    );

    processedAthletes.forEach((ath, idx) => {
      const losses = Math.max(0, (ath.matchesPlayed || 0) - (ath.wins || 0));
      const winRate =
        (ath.matchesPlayed || 0) > 0
          ? (((ath.wins || 0) / ath.matchesPlayed!) * 100).toFixed(1)
          : '0.0';
      const catRank = categoryRankMap.get(`${ath.id}_${ath.level}`) || '-';

      lines.push(
        `${idx + 1}º;${catRank}º;${ath.name};${ATHLETE_LEVEL_LABELS[ath.level]};${
          ath.points || 0
        };${ath.matchesPlayed || 0};${ath.wins || 0};${losses};${winRate}%;${
          ath.titlesCount || 0
        };${ath.city || 'Mineiros'};${ath.arenaName || tenant.name}`
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranking_shark_set_${selectedCategory}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scopeTabs: { id: RankingScope; label: string; emoji: string }[] = [
    { id: 'geral', label: 'Geral', emoji: '🌍' },
    { id: 'pais', label: 'País', emoji: '🏳️' },
    { id: 'estado', label: 'Estado', emoji: '📍' },
    { id: 'cidade', label: 'Cidade', emoji: '🏙️' },
    { id: 'arena', label: 'Arena', emoji: '🏟️' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 text-[#F7FAFD]">
      {/* ===================================================================== */}
      {/* LEVEL 1: UNIFIED COMPACT HEADER + ACTION MODAL TRIGGERS               */}
      {/* ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#12C7BB] font-black uppercase tracking-wider text-[11px]">
              RANKING SHARK SET OFICIAL
            </span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-slate-300 font-semibold">
              {sourceAthletes.length} Jogadores Homologados
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            RANKING SHARK SET OFICIAL{' '}
            <span className="text-base sm:text-lg font-bold text-[#5BC3FA]">
              ({sourceAthletes.length} Jogadores Homologados)
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
            Alterne entre os escopos abaixo. Pontuação calculada por performance. Escolha sua categoria no cadastro. A promoção exige a pontuação da categoria, pelo menos 6 partidas, 4 vitórias e 60% de aproveitamento. Após 30 dias sem partida válida, o progresso ativo zera; o histórico da categoria permanece.
          </p>
        </div>

        {/* Action Buttons on Top Right */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            onClick={exportRankingCSV}
            className="px-3 py-2.5 rounded-lg bg-[#030B17]/80 hover:bg-[#0B254E] text-slate-200 font-bold text-xs border border-slate-700/70 transition-colors flex items-center gap-1.5"
            title="Baixar planilha CSV do ranking"
          >
            <Download className="w-4 h-4 text-[#12C7BB]" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={handleSyncToFirestore}
            disabled={isSyncing}
            className="px-3 py-2.5 rounded-lg bg-[#030B17]/80 hover:bg-[#0B254E] text-slate-200 font-bold text-xs border border-slate-700/70 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Sincronizar com Cloud Firestore"
          >
            <Database className="w-4 h-4 text-[#0987CE]" />
            <span className="hidden xl:inline">
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </span>
          </button>

          <button
            type="button"
            onClick={loadAthletesFromFirestore}
            disabled={isLoading}
            className="p-2.5 rounded-lg bg-[#030B17]/80 hover:bg-[#0B254E] text-slate-200 border border-slate-700/70 transition-colors"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0987CE]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status notification bar */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-[#05182C] border border-[#145A9B]/60 flex items-center justify-between text-xs text-slate-200">
          <span className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-[#12C7BB] shrink-0" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LEVEL 2: TABS ATTACHED DIRECTLY TO THE TOP OF CLASSIFICATION TABLE    */}
      {/* ===================================================================== */}
      <div>
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

        {/* ===================================================================== */}
        {/* LEVEL 3: 100% FULL-WIDTH CLASSIFICATION TABLE & FILTER TOOLBAR        */}
        {/* ===================================================================== */}
        <div className="aquarium-glass bg-[#05182C] border border-t-0 border-[#145A9B]/60 rounded-b-2xl rounded-tr-2xl shadow-2xl overflow-hidden">
          {/* Search & Dropdown Filters Toolbar */}
          <div className="p-4 bg-[#041426]/90 border-b border-[#145A9B]/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar atleta, cidade ou arena..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 text-xs font-medium bg-[#030D1A] border border-[#145A9B]/60 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Contextual Scope Dropdown (Country / State / City / Arena) */}
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

            {/* Category & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#12C7BB]" />
              <span className="font-bold text-slate-300">Filtros:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as AthleteLevel | 'all')}
                className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
              >
                <option value="all">Todas as Categorias ({sourceAthletes.length})</option>
                <option value="profissional">Profissional</option>
                <option value="serie_a">Série A</option>
                <option value="serie_b">Série B</option>
                <option value="serie_c">Série C</option>
                <option value="iniciante">Iniciante</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'points' | 'winRate' | 'wins' | 'titles')}
                className="px-3 py-2 text-xs font-bold bg-[#030D1A] border border-[#145A9B]/60 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
              >
                <option value="points">Ordenar: Pontos</option>
                <option value="winRate">Ordenar: Win Rate %</option>
                <option value="wins">Ordenar: Vitórias</option>
                <option value="titles">Ordenar: Títulos</option>
              </select>

              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="p-2 rounded-lg bg-[#030D1A] border border-[#145A9B]/60 text-slate-200 hover:bg-[#0B254E] transition-colors"
                title="Inverter ordem"
              >
                <ArrowUpDown className="w-4 h-4 text-[#0987CE]" />
              </button>
            </div>
          </div>

          {/* 100% Width Classification Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#030E1C] border-b border-[#145A9B]/50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16">#</th>
                  <th className="py-3.5 px-4">Atleta</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Cidade / Arena</th>
                  <th className="py-3.5 px-4 text-center">Jogos</th>
                  <th className="py-3.5 px-4">Win Rate</th>
                  <th className="py-3.5 px-4 text-right">Pts</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#145A9B]/30 text-xs">
                {processedAthletes.map((athlete, index) => {
                  const matchesPlayed = athlete.matchesPlayed || 0;
                  const wins = athlete.wins || 0;
                  const losses = Math.max(0, matchesPlayed - wins);
                  const winRateNumber = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;
                  const winRateFormatted = winRateNumber.toFixed(0);

                  const categoryRank =
                    categoryRankMap.get(`${athlete.id}_${athlete.level}`) || index + 1;
                  const isCatLeader = categoryRank === 1;

                  return (
                    <tr
                      key={athlete.id}
                      className={`hover:bg-[#0B254E]/50 transition-colors ${
                        index === 0 ? 'bg-[#0B254E]/25' : ''
                      }`}
                    >
                      {/* # Position */}
                      <td className="py-3.5 px-4 font-black">
                        {index === 0 ? (
                          <span className="w-7 h-7 rounded-md bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs">
                            1º
                          </span>
                        ) : index === 1 ? (
                          <span className="w-7 h-7 rounded-md bg-slate-200 text-slate-900 flex items-center justify-center font-black text-xs">
                            2º
                          </span>
                        ) : index === 2 ? (
                          <span className="w-7 h-7 rounded-md bg-amber-700/80 text-amber-100 flex items-center justify-center font-black text-xs">
                            3º
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold pl-1.5">{index + 1}º</span>
                        )}
                      </td>

                      {/* Athlete Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-white text-sm flex items-center gap-2">
                          <span>{athlete.name}</span>
                          {(athlete.titlesCount || 0) > 0 && (
                            <span className="text-xs font-bold text-amber-400" title="Títulos conquistados">
                              🏆 {athlete.titlesCount}
                            </span>
                          )}
                          {athlete.highestHistoricalLevel && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[#12C7BB]/15 text-[#12C7BB] font-bold"
                              title="Passaporte Único Blindado: nunca rebaixa para categorias inferiores"
                            >
                              🛡️ Passaporte
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          {isCatLeader && <Trophy className="w-3 h-3 text-amber-400" />}
                          #{categoryRank} na categoria {ATHLETE_LEVEL_LABELS[athlete.level]}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <AthleteLevelBadge level={athlete.level} size="sm" />
                      </td>

                      {/* City / Arena */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-100 block">
                          {athlete.arenaName || tenant.name}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#0987CE]" />
                          {(athlete.city || 'Mineiros').split(' - ')[0]} - {athlete.state || 'GO'}
                        </span>
                      </td>

                      {/* Matches (W - L) */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-extrabold text-white text-sm block">
                          {matchesPlayed}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          <strong className="text-emerald-400">{wins}V</strong> -{' '}
                          <strong className="text-rose-400">{losses}D</strong>
                        </span>
                      </td>

                      {/* Win Rate % with Visual Bar */}
                      <td className="py-3.5 px-4 min-w-[150px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-extrabold text-white text-sm">
                            {winRateFormatted}%
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase ${
                              winRateNumber >= 75
                                ? 'text-emerald-300'
                                : winRateNumber >= 50
                                ? 'text-[#5BC3FA]'
                                : 'text-slate-400'
                            }`}
                          >
                            {winRateNumber >= 75
                              ? 'Excelente'
                              : winRateNumber >= 50
                              ? 'Positivo'
                              : 'Regular'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#030B17] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              winRateNumber >= 75
                                ? 'bg-emerald-400'
                                : winRateNumber >= 50
                                ? 'bg-[#0987CE]'
                                : 'bg-slate-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(4, winRateNumber))}%` }}
                          />
                        </div>
                      </td>

                      {/* Total Points */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="text-base font-black text-amber-400">
                          {athlete.points || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block">pts</span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveTab('register_dupla')}
                          className="px-3 py-1.5 rounded-md bg-[#071D3D] hover:bg-[#0B254E] text-slate-200 border border-slate-700 font-bold text-[11px] transition-colors"
                          title="Inscrever este atleta no campeonato"
                        >
                          Inscrever →
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {processedAthletes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="font-bold text-slate-200">
                        Nenhum atleta encontrado para esta seleção.
                      </p>
                      <p className="text-xs text-slate-400">
                        Tente limpar o filtro de busca ou selecionar outra categoria.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rules Explanatory Footer: Anti-Sandbagging & Cross-City Logic */}
      <div className="aquarium-glass bg-[#05182C] text-slate-300 border border-[#145A9B]/60 rounded-2xl p-4 text-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0987CE]/20 text-[#0987CE] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-white text-sm">
              Passaporte Único SHARK SET & Regras Anti-Sandbagging
            </h4>
            <p className="text-slate-300 text-xs mt-0.5">
              Se você joga Série A na sua cidade, não pode se inscrever como iniciante em outra arena. As pontuações são consolidadas no Cloud Firestore.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('tournaments')}
          className="px-4 py-2 rounded-lg bg-[#071D3D] hover:bg-[#0B254E] text-white border border-slate-700 font-bold text-xs shrink-0 transition-all"
        >
          Ver Tabela dos Torneios →
        </button>
      </div>

      {/* Secondary Collapsible / Bottom Free Broadcast Studio */}
      <details className="aquarium-glass bg-[#05182C] border border-[#145A9B]/50 rounded-2xl p-4">
        <summary className="cursor-pointer font-bold text-xs text-slate-300 hover:text-white flex items-center justify-between">
          <span>📹 Transmissão Livre & Câmera da Quadra (Opcional — Não Altera Ranking)</span>
          <span className="text-[#12C7BB]">Expandir ▾</span>
        </summary>
        <div className="pt-4 mt-3 border-t border-[#145A9B]/40">
          <FreeBroadcastPanel />
        </div>
      </details>

      {/* ===================================================================== */}
      {/* MODAL 1: CADASTRAR JOGADOR NO RANKING                                 */}
      {/* ===================================================================== */}
      {isAddAthleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rb-modal-add-athlete-title"
        >
          <div className="aquarium-glass w-full max-w-lg bg-[#05182C] border border-[#145A9B] rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#145A9B]/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0987CE]/20 text-[#12C7BB] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="rb-modal-add-athlete-title" className="text-base font-black text-white">
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
          aria-labelledby="rb-modal-record-match-title"
        >
          <div className="aquarium-glass w-full max-w-2xl bg-[#05182C] border border-[#145A9B] rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#145A9B]/50">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="rb-modal-record-match-title" className="text-base font-black text-white flex items-center gap-2">
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
                    {sourceAthletes.map((a) => (
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
                    {sourceAthletes.map((a) => (
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
    </div>
  );
};

