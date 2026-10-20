import { useRankingAthletes } from '../hooks/useRankingAthletes';
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AthleteLevel, AthleteProfile, ExperienceCategory, RankingScope, SportType } from '../types';
import {
  auth,
  seedAthletesToFirestore,
  signInWithGooglePopup,
} from '../lib/firebase';
import {
  ATHLETE_LEVEL_LABELS,
  calculateFutevoleiMatchPoints,
  extractAvailableRankingDimensions,
  filterAndRankAthletesByScope,
  formatSharksetSince,
  getRankingPromotionSuggestion,
} from '../services/rankingValidator';
import { getInactivityDays, INACTIVITY_DAYS } from '../services/rankingActivity';
import { AthleteLevelBadge } from './AthleteLevelBadge';
import { FreeBroadcastPanel } from './FreeBroadcastPanel';
import { Top10WhatsAppShareModal } from './Top10WhatsAppShareModal';
import { IntegrityReportModal } from './IntegrityReportModal';
import { SharkCardsShowcase } from './SharkCardsShowcase';
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
  ShieldAlert,
  MapPin,
  Download,
  UserPlus,
  Zap,
  X,
  TrendingUp,
  MessageCircle,
  Flame,
  Star,
  Share2,
  Calendar,
} from 'lucide-react';

interface RankingBoardProps {
  initialScope?: RankingScope;
  arenaOnly?: boolean;
}

export const RankingBoard: React.FC<RankingBoardProps> = ({
  initialScope,
  arenaOnly = false,
}) => {
  const {
    athletes: localAthletes,
    tenant,
    availableTenants,
    setActiveTab,
    addOrUpdateAthlete,
    awardAthletePoints,
    rankingLogs,
  } = useApp();

  const { sourceAthletes, isLoading, refresh: loadAthletesFromFirestore } = useRankingAthletes();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Operational Modals (separated from visualization)
  const [isAddAthleteModalOpen, setIsAddAthleteModalOpen] = useState<boolean>(false);
  const [isRecordMatchModalOpen, setIsRecordMatchModalOpen] = useState<boolean>(false);
  const [isShareTop10Open, setIsShareTop10Open] = useState<boolean>(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // 5 Segmented Scopes: GERAL | PAÍS | ESTADO | CIDADE | ARENA
  const [rankingScope, setRankingScope] = useState<RankingScope>(initialScope || 'geral');
  const [selectedCountry, setSelectedCountry] = useState<string>('Brasil');
  const [selectedState, setSelectedState] = useState<string>('GO');
  const [selectedCity, setSelectedCity] = useState<string>('Mineiros');
  const [selectedArenaId, setSelectedArenaId] = useState<string>(tenant.id);

  // View Mode: Cards 3D (TCG) vs Table
  const [rankingViewMode, setRankingViewMode] = useState<'cards' | 'table'>('cards');

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

  const currentScopeLabel = scopeTabs.find((t) => t.id === rankingScope)?.label || 'Geral';
  const currentLeader = processedAthletes[0] || null;


  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4 text-[#F7FAFD]">
      <header className="ranking-header rounded-2xl border border-cyan-800/60 bg-[#041c33]/95 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-cyan-300 mb-1">{currentScopeLabel} · {selectedCategory === 'all' ? 'Todas as categorias' : ATHLETE_LEVEL_LABELS[selectedCategory]}</p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Ranking Sharkset</h1>
            <p className="text-xs text-slate-400 mt-1">Classificação por pontos em jogos e torneios.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 ranking-actions">
            {/* View Mode Toggle: Cards 3D vs Tabela Geral */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-inner">
              <button
                type="button"
                onClick={() => setRankingViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  rankingViewMode === 'cards'
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Cards 3D</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                  TCG
                </span>
              </button>
              <button
                type="button"
                onClick={() => setRankingViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  rankingViewMode === 'table'
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Tabela Geral</span>
              </button>
            </div>

            <button onClick={() => setIsShareTop10Open(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white"><MessageCircle size={16} />Compartilhar Top 10</button>
            <button onClick={loadAthletesFromFirestore} disabled={isLoading} title="Atualizar ranking" aria-label="Atualizar ranking"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /></button>
            <details className="relative"><summary className="cursor-pointer rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold">Gerenciar</summary>
              <div className="ranking-management absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-600 bg-slate-950 p-2 shadow-xl space-y-1">
                <button onClick={() => setIsRecordMatchModalOpen(true)}><Zap size={16} />Registrar partida</button>
                <button onClick={() => setIsAddAthleteModalOpen(true)}><UserPlus size={16} />Cadastrar atleta</button>
                <button onClick={exportRankingCSV}><Download size={16} />Exportar CSV</button>
                <button onClick={handleSyncToFirestore} disabled={isSyncing}><Database size={16} />{isSyncing ? 'Sincronizando…' : 'Sincronizar'}</button>
              </div>
            </details>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2"><Trophy size={15} className="text-amber-400" /><span>Líder: <strong className="text-white">{currentLeader?.name || 'Aguardando jogos'}</strong>{currentLeader && <span className="text-amber-300 ml-2">{(currentLeader.points || 0).toLocaleString('pt-BR')} pts</span>}</span></span>
          <span><strong className="text-white">{processedAthletes.length}</strong> atletas neste escopo</span>
          <details><summary className="cursor-pointer">Regra de atividade</summary><p className="pt-2">Após 30 dias de inatividade, o nível é zerado. Jogue regularmente para manter sua posição.</p></details>
        </div>
      </header>

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

      {rankingViewMode === 'cards' ? (
        <SharkCardsShowcase
          athletes={sourceAthletes}
          rankingLogs={rankingLogs}
          onBookCourtClick={() => setActiveTab('scheduler')}
        />
      ) : (
        <>
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
              <span className="font-bold text-slate-300">Categoria:</span>
              <select
                aria-label="Categoria do ranking"
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
                  <th className="py-3.5 px-4">Cidade - UF</th>
                  <th className="py-3.5 px-4 text-center">Vitória / Derrota</th>
                  <th className="py-3.5 px-4">WinRate</th>
                  <th className="py-3.5 px-4">No SHARKSET desde</th>
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

                  // Evolution calculation: 0-100 XP & Consistency Lock
                  const promo = getRankingPromotionSuggestion(
                    athlete.points || 0,
                    athlete.titlesCount || 0,
                    athlete.level,
                    wins,
                    matchesPlayed
                  );
                  const xpPercent = promo.progressPercent;
                  const hasConsistencyLock = (matchesPlayed >= 5 && winRateNumber >= 60) || ((athlete.titlesCount || 0) >= 1);

                  // Inactivity tracking
                  const inactDays = getInactivityDays(athlete.lastMatchAt);
                  const isResetDue = inactDays !== null && inactDays >= INACTIVITY_DAYS;
                  const isWarningDue = inactDays !== null && inactDays >= 25 && inactDays < INACTIVITY_DAYS;

                  // Top 3 Row Styling
                  const rowBg =
                    index === 0
                      ? 'bg-amber-950/25 border-l-4 border-l-amber-400'
                      : index === 1
                      ? 'bg-slate-800/30 border-l-4 border-l-slate-300'
                      : index === 2
                      ? 'bg-amber-900/20 border-l-4 border-l-amber-600'
                      : 'hover:bg-[#0B254E]/40 border-l-4 border-l-transparent';

                  return (
                    <tr
                      key={athlete.id}
                      className={`transition-colors border-b border-[#145A9B]/20 ${rowBg}`}
                    >
                      {/* # Position */}
                      <td className="py-3.5 px-4 font-black">
                        {index === 0 ? (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-md shadow-amber-500/20 border border-amber-200">
                            1º
                          </div>
                        ) : index === 1 ? (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 flex items-center justify-center font-black text-xs shadow-md shadow-slate-400/20 border border-white/60">
                            2º
                          </div>
                        ) : index === 2 ? (
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 flex items-center justify-center font-black text-xs shadow-md shadow-amber-700/20 border border-amber-500/50">
                            3º
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold pl-1.5">{index + 1}º</span>
                        )}
                      </td>

                      {/* Athlete Name + Evolution & Status */}
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

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            {isCatLeader && <Trophy className="w-3 h-3 text-amber-400" />}
                            #{categoryRank} na categoria {ATHLETE_LEVEL_LABELS[athlete.level]}
                          </span>

                          <span className="text-[10px] text-cyan-300 font-semibold bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-800/50">
                            Joga no SHARKSET desde: {formatSharksetSince(athlete.createdAt)}
                          </span>

                          {/* Activity / Inactivity Status */}
                          {isResetDue ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                              ⚠️ Inativo (+30d) · Nível Resetado
                            </span>
                          ) : isWarningDue ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/50">
                              ⏳ Inativo ({inactDays}d) · Risco Reset
                            </span>
                          ) : inactDays !== null ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                              ✓ Ativo ({inactDays}d)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                              Novo
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category & XP Progress Bar */}
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <AthleteLevelBadge level={athlete.level} size="sm" />
                        
                        {/* XP Progress to Next Level (0 to 100 XP) */}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-300 font-semibold">
                            <span className="flex items-center gap-1 text-cyan-300">
                              <Sparkles className="w-3 h-3 text-cyan-400" />
                              {xpPercent} XP
                            </span>
                            <span className={`text-[10px] font-bold ${hasConsistencyLock ? 'text-emerald-400' : 'text-slate-400'}`} title={hasConsistencyLock ? 'Trava de consistência satisfeita' : 'Requer 5 jogos com 60% win rate ou título'}>
                              {hasConsistencyLock ? '🔒 Consistência OK' : '🔓 Trava pendente'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[#030B17] overflow-hidden border border-cyan-950">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-[#FF6B00] transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(3, xpPercent))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Cidade - UF / Arena */}
                      <td className="py-3.5 px-4">
                        <span className="text-[12px] text-slate-100 font-bold flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#0987CE] shrink-0" />
                          {(athlete.city || 'Mineiros').split(' - ')[0]} - {athlete.state || 'GO'}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {athlete.arenaName || tenant.name}
                        </span>
                      </td>

                      {/* Vitória / Derrota */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-black block">
                          <strong className="text-emerald-400">{wins}V</strong> /{' '}
                          <strong className="text-rose-400">{losses}D</strong>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {matchesPlayed} jogo{matchesPlayed === 1 ? '' : 's'}
                        </span>
                      </td>

                      {/* WinRate % with Visual Bar */}
                      <td className="py-3.5 px-4 min-w-[130px]">
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

                      {/* No SHARKSET desde */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{formatSharksetSince(athlete.createdAt)}</span>
                        </span>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReportTarget({ id: athlete.id, name: athlete.name })}
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 font-bold text-xs transition-colors"
                            title={`Denunciar suspeita de fraude/entrega de pontos para ${athlete.name}`}
                          >
                            <ShieldAlert size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('register_dupla')}
                            className="px-3 py-1.5 rounded-lg bg-[#071D3D] hover:bg-[#0B254E] text-slate-200 border border-slate-700 font-bold text-[11px] transition-transform active:translate-y-0.5 shadow-sm"
                            title="Inscrever este atleta no campeonato"
                          >
                            Inscrever →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {processedAthletes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
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

      {/* Rules Explanatory Footer: Anti-Sandbagging, Amistosos & Anti-Farming */}
      <section className="rounded-3xl border border-cyan-800/40 bg-[#041529]/95 p-6 sm:p-8 text-white space-y-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-800/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                Regras Oficiais do Ranking & Integridade Competitiva
              </h3>
              <p className="text-xs text-slate-400">
                Como pontuar em torneios e amistosos com transmissão, subir de nível e denunciar irregularidades.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('tournaments')}
            className="px-4 py-2.5 rounded-xl bg-[#071D3D] hover:bg-[#0B254E] text-white border border-slate-700 font-bold text-xs shrink-0 transition-all cursor-pointer"
          >
            Ver Tabela dos Torneios →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-4 rounded-2xl bg-[#030E1F] border border-cyan-900/50 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-black">
              <Zap className="w-4 h-4 text-orange-400" />
              <span>Amistosos com Transmissão (Zebra & Underdog)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Vencer uma dupla de categoria superior em jogo transmitido rende até <strong>+55 pts</strong> no ranking! Já o favorito ganha pontuação mínima ao vencer séries inferiores.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#030E1F] border border-cyan-900/50 space-y-2">
            <div className="flex items-center gap-2 text-[#12C7BB] font-black">
              <Sparkles className="w-4 h-4 text-[#12C7BB]" />
              <span>Barra de XP & Trava de Consistência</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Para subir de categoria não basta apenas pontuar: exige-se no mínimo 6 partidas disputadas com 4 vitórias e aproveitamento $\ge 60\%$. Após 30 dias inativo, o nível é resetado.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#030E1F] border border-cyan-900/50 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-black">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Tolerância Zero com Fraude e Conluio</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Viu alguém entregando jogo para amigo subir ou forjando placar? Clique no botão de denúncia (<ShieldAlert className="w-3.5 h-3.5 inline text-rose-400" />) ao lado do atleta. O comitê investiga e anula os pontos.
            </p>
          </div>
        </div>
      </section>

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
      </>
      )}

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

      {/* Official Top 10 WhatsApp Share & High-Res Image Modal */}
      <Top10WhatsAppShareModal
        isOpen={isShareTop10Open}
        onClose={() => setIsShareTop10Open(false)}
        topAthletes={processedAthletes}
        scope={rankingScope}
        scopeLabel={currentScopeLabel}
        category={selectedCategory}
        arenaName={tenant.name}
        cityName={selectedCity}
      />

      {/* Integrity Report Modal (Denúncia de Fraude/Conluio) */}
      {reportTarget && (
        <IntegrityReportModal
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType="athlete"
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onReportSubmitted={(rep) => {
            setStatusMessage(`🚨 Denúncia registrada contra ${rep.targetName}. O caso foi enviado ao comitê de integridade.`);
          }}
        />
      )}
    </div>
  );
};

