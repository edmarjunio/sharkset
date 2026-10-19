import { useRankingAthletes } from '../hooks/useRankingAthletes';
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
import { Top10WhatsAppShareModal } from './Top10WhatsAppShareModal';
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
  MessageCircle,
  Flame,
  Star,
  Share2,
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

  const [firestoreAthletes, setFirestoreAthletes] = useState<AthleteProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Operational Modals (separated from visualization)
  const [isAddAthleteModalOpen, setIsAddAthleteModalOpen] = useState<boolean>(false);
  const [isRecordMatchModalOpen, setIsRecordMatchModalOpen] = useState<boolean>(false);
  const [isShareTop10Open, setIsShareTop10Open] = useState<boolean>(false);

  // 5 Segmented Scopes: GERAL | PAÍS | ESTADO | CIDADE | ARENA
  const [rankingScope, setRankingScope] = useState<RankingScope>(initialScope || 'geral');
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

