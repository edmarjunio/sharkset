import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AthleteLevel, AthleteProfile } from '../types';
import {
  auth,
  fetchTopAthletesFromFirestore,
  seedAthletesToFirestore,
  signInWithGooglePopup,
} from '../lib/firebase';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import { SharksetLogo } from './SharksetLogo';
import { FreeBroadcastPanel } from './FreeBroadcastPanel';
import {
  Trophy,
  Award,
  Flame,
  Search,
  Filter,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  Sparkles,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Download,
  Share2,
} from 'lucide-react';

export const RankingBoard: React.FC = () => {
  const { athletes: localAthletes, tenant, setActiveTab } = useApp();

  const [firestoreAthletes, setFirestoreAthletes] = useState<AthleteProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [firestoreStatus, setFirestoreStatus] = useState<
    'connected' | 'offline_fallback' | 'synced' | 'error'
  >('connected');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filters & Sorting
  const [selectedCategory, setSelectedCategory] = useState<AthleteLevel | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'points' | 'winRate' | 'wins' | 'titles'>('points');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Load from Firestore on mount
  const loadAthletesFromFirestore = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const data = await fetchTopAthletesFromFirestore(100);
      if (data && data.length > 0) {
        setFirestoreAthletes(data);
        setFirestoreStatus('connected');
        setStatusMessage(`${data.length} atletas carregados diretamente do Cloud Firestore.`);
      } else {
        // If Firestore collection has no items yet, fallback to local initial data
        setFirestoreAthletes(localAthletes);
        setFirestoreStatus('offline_fallback');
        setStatusMessage('Base do Firestore inicializada. Clique em "Sincronizar com Firestore" para gravar os registros na nuvem.');
      }
    } catch {
      // Graceful fallback to rich local athletes
      setFirestoreAthletes(localAthletes);
      setFirestoreStatus('offline_fallback');
      setStatusMessage('Usando dados locais de alta performance. Faça login com Google para persistência ao vivo.');
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
      setFirestoreStatus('synced');
      setStatusMessage(`✅ Sucesso! ${count} atletas foram sincronizados e gravados no Firestore!`);
      await loadAthletesFromFirestore();
    } catch (err: unknown) {
      setFirestoreStatus('error');
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

  // Category-specific rankings computation (determines each player's rank within their specific category)
  const categoryRankMap = useMemo(() => {
    const map = new Map<string, number>();
    const grouped = new Map<AthleteLevel, AthleteProfile[]>();

    sourceAthletes.forEach((ath) => {
      const list = grouped.get(ath.level) || [];
      list.push(ath);
      grouped.set(ath.level, list);
    });

    grouped.forEach((list) => {
      // Sort within category by points desc, then win rate desc
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

  // Filtered & Sorted Athletes
  const processedAthletes = useMemo(() => {
    let list = [...sourceAthletes];

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter((ath) => ath.level === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (ath) =>
          ath.name.toLowerCase().includes(term) ||
          ath.city?.toLowerCase().includes(term) ||
          ath.arenaName?.toLowerCase().includes(term)
      );
    }

    // Sort
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
  }, [sourceAthletes, selectedCategory, searchTerm, sortBy, sortDirection]);

  const exportRankingCSV = () => {
    const lines: string[] = ['\uFEFF'];
    lines.push('RANKING OFICIAL DE ATLETAS SHARK SET - CLOUD FIRESTORE');
    lines.push(`Gerado em:;${new Date().toLocaleString('pt-BR')}`);
    lines.push(`Categoria Selecionada:;${selectedCategory === 'all' ? 'Todas' : ATHLETE_LEVEL_LABELS[selectedCategory]}`);
    lines.push('');
    lines.push('Pos Geral;Pos Categoria;Atleta;Categoria;Pontos;Jogos;Vitórias;Derrotas;Taxa de Vitória (Win Rate %);Títulos;Cidade;Arena');

    processedAthletes.forEach((ath, idx) => {
      const losses = Math.max(0, (ath.matchesPlayed || 0) - (ath.wins || 0));
      const winRate =
        (ath.matchesPlayed || 0) > 0 ? (((ath.wins || 0) / ath.matchesPlayed!) * 100).toFixed(1) : '0.0';
      const catRank = categoryRankMap.get(`${ath.id}_${ath.level}`) || '-';

      lines.push(
        `${idx + 1}º;${catRank}º;${ath.name};${ATHLETE_LEVEL_LABELS[ath.level]};${ath.points || 0};${ath.matchesPlayed || 0};${ath.wins || 0};${losses};${winRate}%;${ath.titlesCount || 0};${ath.city || 'Mineiros'};${ath.arenaName || tenant.name}`
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#F7FAFD]">
      <FreeBroadcastPanel />
      <p className="rounded-xl bg-white p-4 text-sm text-slate-700">Escolha sua categoria no cadastro. A promoção exige a pontuação da categoria, pelo menos 6 partidas, 4 vitórias e 60% de aproveitamento. Após 30 dias sem partida válida, o progresso ativo zera; o histórico da categoria permanece.</p>
      {/* Top Banner & Cloud Firestore Connection Header */}
      <div className="bg-[#071D3D] text-[#F7FAFD] border-2 border-[#145A9B] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient Gradient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0987CE]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-[#0987CE] text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                <Trophy className="w-3.5 h-3.5 text-white" />
                RANKING OFICIAL SHARK SET
              </span>

              {/* Firestore Live Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#030B17] border border-[#145A9B] text-xs">
                <span className="w-2 h-2 rounded-full bg-[#12C7BB] animate-pulse shrink-0" />
                <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                  <Database className="w-3 h-3 text-[#0987CE]" />
                  Firestore: <strong className="text-white">athletes_public</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <SharksetLogo size="sm" />
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Tabela de Líderes & Aproveitamento
              </h1>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Consulte a pontuação em tempo real, <strong>taxa de vitórias (Win Rate %)</strong> e <strong>ranking individual por categoria</strong>. Sistema com Passaporte Único para impedir inscrições abaixo do nível.
            </p>
          </div>

          {/* Quick Actions (Sync Firestore, Refresh, Export) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSyncToFirestore}
              disabled={isSyncing}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] hover:brightness-110 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
              title="Gravar e atualizar os atletas no Cloud Firestore"
            >
              <Database className="w-4 h-4" />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar com Firestore'}
            </button>

            <button
              type="button"
              onClick={loadAthletesFromFirestore}
              disabled={isLoading}
              className="p-3 rounded-xl bg-[#030B17] hover:bg-[#0B254E] text-slate-200 border border-[#145A9B] transition-colors cursor-pointer"
              title="Recarregar dados do Firestore"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0987CE]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={exportRankingCSV}
              className="px-4 py-3 rounded-xl bg-[#030B17] hover:bg-[#0B254E] text-white font-bold text-xs border border-[#145A9B] transition-colors cursor-pointer flex items-center gap-2"
              title="Baixar planilha CSV do ranking"
            >
              <Download className="w-4 h-4 text-[#12C7BB]" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Status notification bar */}
        {statusMessage && (
          <div className="mt-4 pt-4 border-t border-[#145A9B]/60 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0987CE] shrink-0" />
              {statusMessage}
            </span>
            <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
              Total listados: {processedAthletes.length} atletas
            </span>
          </div>
        )}
      </div>

      {/* Top 3 Podium Cards Preview */}
      {processedAthletes.length >= 3 && !searchTerm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 2nd Place */}
          <div className="bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 shadow-lg flex flex-col justify-between order-2 md:order-1 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#030B17] border border-[#145A9B] text-slate-200 font-black text-xl flex items-center justify-center">
                  🥈
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#0987CE] block tracking-wider">
                    2º LUGAR
                  </span>
                  <h3 className="font-extrabold text-white text-base">
                    {processedAthletes[1].name}
                  </h3>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#0987CE]" />
                    {processedAthletes[1].city || 'Mineiros'}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#030B17] border border-[#145A9B] font-black text-[#12C7BB] text-xs">
                {ATHLETE_LEVEL_LABELS[processedAthletes[1].level]}
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-[#145A9B]/60 grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#145A9B]/40">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Pontos</span>
                <span className="text-base font-black text-white">{processedAthletes[1].points}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#12C7BB]/40">
                <span className="text-[10px] text-[#12C7BB] font-bold block uppercase">Win Rate</span>
                <span className="text-base font-black text-[#12C7BB]">
                  {processedAthletes[1].matchesPlayed
                    ? `${(((processedAthletes[1].wins || 0) / processedAthletes[1].matchesPlayed) * 100).toFixed(0)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* 1st Place (Champion) - High Visual Impact Sharkset Blue */}
          <div className="bg-gradient-to-b from-[#0B254E] via-[#071D3D] to-[#030B17] border-2 border-[#0987CE] rounded-3xl p-6 shadow-2xl flex flex-col justify-between order-1 md:order-2 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#0987CE] text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Flame className="w-3 h-3 fill-white" /> LÍDER DO RANKING
            </div>

            <div className="flex items-start justify-between pt-1">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#0987CE] text-white font-black text-2xl flex items-center justify-center shadow-md">
                  🥇
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#5BC3FA] block tracking-wider">
                    1º LUGAR ABSOLUTO
                  </span>
                  <h3 className="font-black text-white text-lg">
                    {processedAthletes[0].name}
                  </h3>
                  <span className="text-xs text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#0987CE]" />
                    {processedAthletes[0].city || 'Mineiros'} · {processedAthletes[0].arenaName || 'SHARK SET'}
                  </span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-[#0987CE] text-white font-black text-xs shadow-md">
                {ATHLETE_LEVEL_LABELS[processedAthletes[0].level]}
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-[#145A9B] grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#145A9B]">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Pontos</span>
                <span className="text-lg font-black text-white">{processedAthletes[0].points}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#12C7BB]/50">
                <span className="text-[10px] text-[#12C7BB] font-bold block uppercase">Win Rate</span>
                <span className="text-lg font-black text-[#12C7BB]">
                  {processedAthletes[0].matchesPlayed
                    ? `${(((processedAthletes[0].wins || 0) / processedAthletes[0].matchesPlayed) * 100).toFixed(0)}%`
                    : '0%'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#0987CE]/50">
                <span className="text-[10px] text-[#5BC3FA] font-bold block uppercase">Títulos</span>
                <span className="text-lg font-black text-[#5BC3FA]">🏆 {processedAthletes[0].titlesCount}</span>
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 shadow-lg flex flex-col justify-between order-3 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#030B17] border border-[#145A9B] text-amber-500 font-black text-xl flex items-center justify-center">
                  🥉
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#0987CE] block tracking-wider">
                    3º LUGAR
                  </span>
                  <h3 className="font-extrabold text-white text-base">
                    {processedAthletes[2].name}
                  </h3>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#0987CE]" />
                    {processedAthletes[2].city || 'Mineiros'}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#030B17] border border-[#145A9B] font-black text-[#12C7BB] text-xs">
                {ATHLETE_LEVEL_LABELS[processedAthletes[2].level]}
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-[#145A9B]/60 grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#145A9B]/40">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Pontos</span>
                <span className="text-base font-black text-white">{processedAthletes[2].points}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#030B17] border border-[#12C7BB]/40">
                <span className="text-[10px] text-[#12C7BB] font-bold block uppercase">Win Rate</span>
                <span className="text-base font-black text-[#12C7BB]">
                  {processedAthletes[2].matchesPlayed
                    ? `${(((processedAthletes[2].wins || 0) / processedAthletes[2].matchesPlayed) * 100).toFixed(0)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs & Filter Toolbar */}
      <div className="bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl p-5 shadow-xl space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#145A9B]/60 pb-3">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/20'
                : 'text-slate-300 hover:bg-[#0B254E]'
            }`}
          >
            Todas as Categorias ({sourceAthletes.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('profissional')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              selectedCategory === 'profissional'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/20'
                : 'text-slate-300 hover:bg-[#0B254E]'
            }`}
          >
            Profissional
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('serie_a')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              selectedCategory === 'serie_a'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/20'
                : 'text-slate-300 hover:bg-[#0B254E]'
            }`}
          >
            Série A
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('serie_b')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              selectedCategory === 'serie_b'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/20'
                : 'text-slate-300 hover:bg-[#0B254E]'
            }`}
          >
            Série B
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('serie_c')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              selectedCategory === 'serie_c'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/20'
                : 'text-slate-300 hover:bg-[#0B254E]'
            }`}
          >
            Série C
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('iniciante')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
              selectedCategory === 'iniciante'
                ? 'bg-[#0987CE] text-white shadow-md shadow-[#0987CE]/20'
                : 'text-slate-300 hover:bg-[#0B254E]'
            }`}
          >
            Iniciante
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar atleta pelo nome ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-medium bg-[#030B17] border border-[#145A9B] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 whitespace-nowrap">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs font-bold bg-[#030B17] border border-[#145A9B] text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
            >
              <option value="points">Pontos (Ranking Oficial)</option>
              <option value="winRate">Taxa de Vitória (Win Rate %)</option>
              <option value="wins">Total de Vitórias</option>
              <option value="titles">Títulos Conquistados</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="p-2 rounded-xl bg-[#030B17] border border-[#145A9B] text-slate-200 hover:bg-[#0B254E] transition-colors cursor-pointer"
              title="Inverter ordem"
            >
              <ArrowUpDown className="w-4 h-4 text-[#0987CE]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Ranking Table with Win Rates & Category Rankings */}
      <div className="bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#030B17] border-b border-[#145A9B] text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-14"># Pos</th>
                <th className="py-3.5 px-4 text-center w-28">Rank Cat.</th>
                <th className="py-3.5 px-4">Atleta & Localização</th>
                <th className="py-3.5 px-4 text-center">Nível Oficial</th>
                <th className="py-3.5 px-4 text-center">Jogos / V-D</th>
                <th className="py-3.5 px-4">Taxa de Vitória (Win Rate)</th>
                <th className="py-3.5 px-4 text-center">Títulos</th>
                <th className="py-3.5 px-4 text-right">Pontos</th>
                <th className="py-3.5 px-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#145A9B]/40 text-xs">
              {processedAthletes.map((athlete, index) => {
                const matchesPlayed = athlete.matchesPlayed || 0;
                const wins = athlete.wins || 0;
                const losses = Math.max(0, matchesPlayed - wins);
                const winRateNumber = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;
                const winRateFormatted = winRateNumber.toFixed(1);

                const categoryRank = categoryRankMap.get(`${athlete.id}_${athlete.level}`) || index + 1;
                const isCatLeader = categoryRank === 1;

                return (
                  <tr
                    key={athlete.id}
                    className={`hover:bg-[#0B254E]/70 transition-colors ${
                      index === 0 ? 'bg-[#0B254E]/40' : ''
                    }`}
                  >
                    {/* Overall Rank Position */}
                    <td className="py-4 px-4 text-center font-mono font-black">
                      {index === 0 ? (
                        <span className="w-8 h-8 rounded-xl bg-[#0987CE] text-white flex items-center justify-center font-black mx-auto shadow-md text-sm">
                          1º
                        </span>
                      ) : index === 1 ? (
                        <span className="w-8 h-8 rounded-xl bg-slate-200 text-slate-900 flex items-center justify-center font-black mx-auto text-sm">
                          2º
                        </span>
                      ) : index === 2 ? (
                        <span className="w-8 h-8 rounded-xl bg-[#145A9B] text-white flex items-center justify-center font-black mx-auto text-sm shadow-xs">
                          3º
                        </span>
                      ) : (
                        <span className="text-slate-400">{index + 1}º</span>
                      )}
                    </td>

                    {/* Category Rank Badge */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[11px] ${
                          isCatLeader
                            ? 'bg-[#0987CE] text-white shadow-xs'
                            : categoryRank === 2
                            ? 'bg-[#030B17] border border-[#145A9B] text-slate-200'
                            : categoryRank === 3
                            ? 'bg-[#030B17] border border-[#0987CE]/40 text-[#0987CE]'
                            : 'bg-[#030B17] text-slate-400'
                        }`}
                        title={`Posição dentro da categoria ${ATHLETE_LEVEL_LABELS[athlete.level]}`}
                      >
                        {isCatLeader && <Trophy className="w-3 h-3 text-[#12C7BB]" />}
                        #{categoryRank} na {ATHLETE_LEVEL_LABELS[athlete.level].split(' ')[0]}
                      </span>
                    </td>

                    {/* Athlete Name & Location */}
                    <td className="py-4 px-4">
                      <div className="font-extrabold text-white text-sm flex items-center gap-2">
                        {athlete.name}
                        {athlete.highestHistoricalLevel && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] bg-[#030B17] text-[#12C7BB] font-bold border border-[#12C7BB]/30"
                            title="Passaporte Único Blindado: nunca rebaixa para categorias inferiores"
                          >
                            🛡️ Passaporte Ativo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#0987CE]" />
                          {athlete.city || 'Mineiros'} - {athlete.state || 'GO'}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-300">{athlete.arenaName || tenant.name}</span>
                      </div>
                    </td>

                    {/* Level / Category */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-[#030B17] border border-[#145A9B] text-[#12C7BB] font-extrabold text-[11px] uppercase tracking-wide">
                        {ATHLETE_LEVEL_LABELS[athlete.level]}
                      </span>
                    </td>

                    {/* Match Record (W - L) */}
                    <td className="py-4 px-4 text-center font-mono">
                      <span className="font-bold text-white">{matchesPlayed} jogos</span>
                      <span className="text-[11px] text-slate-400 block">
                        <strong className="text-emerald-400">{wins}V</strong> -{' '}
                        <strong className="text-rose-400">{losses}D</strong>
                      </span>
                    </td>

                    {/* Win Rate % with Visual Bar */}
                    <td className="py-4 px-4 min-w-[170px]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-black text-white font-mono text-sm">
                          {winRateFormatted}%
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                            winRateNumber >= 75
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : winRateNumber >= 50
                              ? 'bg-[#0987CE]/20 text-[#0987CE] border border-[#0987CE]/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {winRateNumber >= 75 ? 'Excelente' : winRateNumber >= 50 ? 'Positivo' : 'Regular'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#030B17] overflow-hidden border border-[#145A9B]/40">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            winRateNumber >= 75
                              ? 'bg-emerald-400'
                              : winRateNumber >= 50
                              ? 'bg-[#0987CE]'
                              : 'bg-[#145A9B]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(4, winRateNumber))}%` }}
                        />
                      </div>
                    </td>

                    {/* Titles */}
                    <td className="py-4 px-4 text-center font-extrabold text-slate-200">
                      {(athlete.titlesCount || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#12C7BB] font-black">
                          🏆 {athlete.titlesCount}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">-</span>
                      )}
                    </td>

                    {/* Total Points */}
                    <td className="py-4 px-4 text-right">
                      <span className="text-base font-black text-[#12C7BB] font-mono">
                        {athlete.points || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold block">pts</span>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveTab('register_dupla')}
                        className="px-3 py-1.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[11px] transition-colors cursor-pointer shadow-xs"
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
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Nenhum atleta encontrado para esta seleção.</p>
                    <p className="text-xs text-slate-400">Tente limpar o filtro de busca ou selecionar outra categoria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rules Explanatory Footer: Anti-Sandbagging & Cross-City Logic */}
      <div className="bg-[#071D3D] text-slate-300 border-2 border-[#145A9B] rounded-3xl p-5 text-xs flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0987CE]/20 text-[#0987CE] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-white text-sm">
              Passaporte Único SHARK SET & Regras Anti-Sandbagging
            </h4>
            <p className="text-slate-400 text-xs mt-0.5">
              Se você joga Série A na sua cidade, não pode se inscrever como iniciante em outra arena. As pontuações são consolidadas no banco de dados Firestore.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('tournaments')}
          className="px-4 py-2.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs shrink-0 transition-all cursor-pointer shadow-md"
        >
          Ver Tabela dos Torneios →
        </button>
      </div>
    </div>
  );
};
