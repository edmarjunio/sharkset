import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  AthleteLevel,
  BracketMatch,
  SemiFormat,
  TournamentCategory,
  TournamentModalityFormat,
} from '../types';
import { generateMatchCallWhatsAppLink } from '../services/whatsappAdapter';
import { computeTournamentStandings, getPodium } from '../services/bracketEngine';
import {
  ATHLETE_LEVEL_LABELS,
  TOURNAMENT_CATEGORY_LABELS,
  validatePairCategory,
} from '../services/rankingValidator';
import { evaluateMatchNearCompletion } from '../services/smartAlertEngine';
import { RefereeConsoleModal } from './RefereeConsoleModal';
import { FutevoleiVisualBracketCanvas } from './FutevoleiVisualBracketCanvas';
import {
  Trophy,
  MessageSquare,
  RotateCcw,
  Check,
  Sparkles,
  UserCheck,
  Sliders,
  Plus,
  MapPin,
  Calendar,
  Users,
  FileText,
  Award,
  AlertCircle,
  BellRing,
  Radio,
  Shuffle,
  ArrowUp,
  ArrowDown,
  Play,
  ShieldAlert,
  Timer,
} from 'lucide-react';

export const DoubleEliminationBracket: React.FC = () => {
  const {
    tenant,
    tournaments,
    activeTournamentId,
    setActiveTournamentId,
    tournamentMatches,
    registeredPairs,
    registerDouble,
    togglePairPlayerPayment,
    togglePairPresence,
    startTournamentWithDraw,
    createTournament,
    handleAdvanceMatch,
    updateLiveRefereeMatch,
    notifyLiveMatchProgress,
    handleResetMatch,
    handleOverrideMatch,
    regenerateBracket,
    updateTournamentConfig,
    athletes,
    userProfile,
    setActiveTab,
    setArenaSubTab,
    availableTenants,
  } = useApp();

  const [activeStageTab, setActiveStageTab] = useState<
    'all' | 'standings' | 'winners' | 'losers' | 'final'
  >('all');
  const [bracketViewMode, setBracketViewMode] = useState<'chaveamento' | 'lista'>('chaveamento');
  const [editingMatch, setEditingMatch] = useState<BracketMatch | null>(null);
  const [refereeModalMatchId, setRefereeModalMatchId] = useState<string | null>(null);

  // Start Tournament & Draw Modal State (Present Pairs + Random or Manual Slot Placement)
  const [showStartDrawModal, setShowStartDrawModal] = useState(false);
  const [drawMode, setDrawMode] = useState<'random' | 'manual'>('random');
  const [manualSlotOrder, setManualSlotOrder] = useState<string[]>([]);

  const [inputScore1, setInputScore1] = useState<number>(18);
  const [inputScore2, setInputScore2] = useState<number>(14);
  const [overrideTeam1Id, setOverrideTeam1Id] = useState<string>('');
  const [overrideTeam2Id, setOverrideTeam2Id] = useState<string>('');
  const [overrideCourt, setOverrideCourt] = useState<string>('');
  const [overrideTime, setOverrideTime] = useState<string>('');

  // Inline scores state per match card for direct 1-click entry
  const [inlineScores, setInlineScores] = useState<Record<string, { s1: string; s2: string }>>({});

  // Create or Edit Tournament Modal State
  const [showTournamentModal, setShowTournamentModal] = useState<'create' | 'edit' | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('2026-10-25');
  const [formLocation, setFormLocation] = useState('');
  const [formModality, setFormModality] = useState<TournamentModalityFormat>('duplas');
  const [formCategory, setFormCategory] = useState<TournamentCategory>('iniciante_serie_c');
  const [formSemiFormat, setFormSemiFormat] = useState<SemiFormat>('semi_direta');
  const [formMaxParticipants, setFormMaxParticipants] = useState<number>(8);
  const [formFee, setFormFee] = useState<number>(120);
  const [formRules, setFormRules] = useState('');
  const [formResponsible, setFormResponsible] = useState('');

  // Quick Registration Modal inside Tournament View
  const [showQuickEnrollModal, setShowQuickEnrollModal] = useState(false);
  const [enrollP1, setEnrollP1] = useState('');
  const [enrollLvl1, setEnrollLvl1] = useState<AthleteLevel>('serie_c');
  const [enrollP2, setEnrollP2] = useState('');
  const [enrollLvl2, setEnrollLvl2] = useState<AthleteLevel>('iniciante');
  const [enrollPhone, setEnrollPhone] = useState('');

  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];
  const isSingles = activeTournament.modalityFormat === 'simples';

  const currentMatches = tournamentMatches.filter((m) => m.tournamentId === activeTournament.id);
  const pairsInTourn = registeredPairs.filter((p) => p.tournamentId === activeTournament.id);
  const activePairsInTourn = pairsInTourn.filter((p) => p.enrollmentStatus !== 'rejected');
  const presentPairsInTourn = activePairsInTourn.filter((p) => p.isPresent !== false);
  const confirmedPairsCount = activePairsInTourn.filter((p) => p.enrollmentStatus === 'confirmed').length;

  const liveMatches = useMemo(() => {
    return currentMatches.filter(
      (m) =>
        m.status === 'in_progress' ||
        (m.status !== 'completed' && m.liveReferee && ((m.score1 ?? 0) > 0 || (m.score2 ?? 0) > 0))
    );
  }, [currentMatches]);

  const activeRefereeMatch = useMemo(() => {
    if (!refereeModalMatchId) return null;
    return currentMatches.find((m) => m.id === refereeModalMatchId) || null;
  }, [currentMatches, refereeModalMatchId]);

  const openStartDrawModal = () => {
    const initialIds = presentPairsInTourn.map((p) => p.id);
    setManualSlotOrder(initialIds);
    setShowStartDrawModal(true);
  };

  const moveManualPair = (index: number, direction: -1 | 1) => {
    setManualSlotOrder((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleConfirmStartTournamentDraw = () => {
    if (presentPairsInTourn.length < 2) {
      triggerToast('Marque pelo menos 2 duplas como PRESENTES para iniciar o torneio e gerar a tabela.');
      return;
    }
    const presentIds = presentPairsInTourn.map((p) => p.id);
    const orderedIds =
      drawMode === 'manual'
        ? [
            ...manualSlotOrder.filter((id) => presentIds.includes(id)),
            ...presentIds.filter((id) => !manualSlotOrder.includes(id)),
          ]
        : presentIds;

    startTournamentWithDraw(activeTournament.id, drawMode, orderedIds);
    setShowStartDrawModal(false);
    triggerToast(
      drawMode === 'random'
        ? `Torneio iniciado! Tabela gerada com Sorteio Aleatório para ${presentPairsInTourn.length} duplas presentes!`
        : `Torneio iniciado! Tabela gerada com Alocação Manual nas posições escolhidas para ${presentPairsInTourn.length} duplas presentes!`
    );
  };

  // Automatic Tournament Standings generated from match results
  const standings = useMemo(() => {
    return computeTournamentStandings(currentMatches, activePairsInTourn);
  }, [currentMatches, activePairsInTourn]);

  const winnersMatches = currentMatches.filter((m) => m.stage === 'winners');
  const losersMatches = currentMatches.filter((m) => m.stage === 'losers');
  const semiMatches = currentMatches.filter((m) => m.stage === 'semifinals');
  const grandFinalMatches = currentMatches.filter(
    (m) => m.stage === 'grand_final' || m.stage === 'super_final'
  );

  const podium = getPodium(currentMatches);

  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4800);
  };

  const formatParticipantName = (p?: { player1: string; player2: string }) => {
    if (!p) return 'Aguardando definição';
    if (isSingles || p.player2.toLowerCase() === 'individual (1x1)') {
      return p.player1;
    }
    return `${p.player1} & ${p.player2}`;
  };

  // Open Create or Edit Tournament Modal
  const openCreateModal = () => {
    setFormName('');
    setFormDate('2026-10-25');
    setFormLocation(`${tenant.name} - ${tenant.city}/${tenant.state}`);
    setFormModality('duplas');
    setFormCategory('iniciante_serie_c');
    setFormSemiFormat('semi_direta');
    setFormMaxParticipants(8);
    setFormFee(120);
    setFormRules(
      'Sets de 18 pontos (diferença mínima de 2 pontos, teto em 21). Semifinal direta sem repescagem. Pontuação automática para o Ranking Oficial de Futevôlei.'
    );
    setFormResponsible(userProfile.name);
    setShowTournamentModal('create');
  };

  const openEditModal = () => {
    setFormName(activeTournament.name);
    setFormDate(activeTournament.date);
    setFormLocation(activeTournament.location || `${tenant.name} - ${tenant.city}/${tenant.state}`);
    setFormModality(activeTournament.modalityFormat || 'duplas');
    setFormCategory(activeTournament.category);
    setFormSemiFormat(activeTournament.semiFormat);
    setFormMaxParticipants(activeTournament.maxPairs);
    setFormFee(activeTournament.registrationFee);
    setFormRules(
      activeTournament.specificRules ||
        'Sets de 18 pontos (diferença de 2 pontos). Semifinal direta sem repescagem.'
    );
    setFormResponsible(activeTournament.responsibleName);
    setShowTournamentModal('edit');
  };

  const handleSaveTournamentModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (showTournamentModal === 'create') {
      const created = createTournament({
        name: formName.trim(),
        sport: 'futevolei',
        category: formCategory,
        modalityFormat: formModality,
        semiFormat: formSemiFormat,
        date: formDate,
        location: formLocation.trim(),
        specificRules: formRules.trim(),
        maxPairs: formMaxParticipants,
        registrationFee: formFee,
        responsibleName: formResponsible.trim() || userProfile.name,
        responsiblePhone: userProfile.phone,
      });
      triggerToast(`Torneio "${created.name}" (${formModality.toUpperCase()}) criado com sucesso!`);
    } else if (showTournamentModal === 'edit') {
      updateTournamentConfig(activeTournament.id, {
        name: formName.trim(),
        date: formDate,
        location: formLocation.trim(),
        modalityFormat: formModality,
        category: formCategory,
        semiFormat: formSemiFormat,
        maxPairs: formMaxParticipants,
        specificRules: formRules.trim(),
        responsibleName: formResponsible.trim(),
      });
      triggerToast(`Configurações e regras do torneio "${formName.trim()}" atualizadas!`);
    }

    setShowTournamentModal(null);
  };

  // Validate Quick Enroll
  const enrollValidation = useMemo(() => {
    if (isSingles) {
      return {
        isValid: true,
        reason: `Inscrição Individual (Simples 1x1) liberada para nível ${ATHLETE_LEVEL_LABELS[enrollLvl1]}.`,
        ruleSummary: 'Formato Simples 1x1.',
      };
    }
    return validatePairCategory(activeTournament.category, enrollLvl1, enrollLvl2);
  }, [isSingles, activeTournament.category, enrollLvl1, enrollLvl2]);

  const handleQuickEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pairsInTourn.length >= activeTournament.maxPairs) {
      triggerToast(`Limite máximo de ${activeTournament.maxPairs} participantes atingido!`);
      return;
    }
    if (!enrollValidation.isValid || !enrollP1.trim()) return;

    const p2Name = isSingles ? 'Individual (1x1)' : enrollP2.trim();
    if (!isSingles && !p2Name) return;

    const newEntry = registerDouble({
      tournamentId: activeTournament.id,
      player1: enrollP1.trim(),
      player1Level: enrollLvl1,
      player2: p2Name,
      player2Level: isSingles ? enrollLvl1 : enrollLvl2,
      phone: enrollPhone.trim() || userProfile.phone,
      category: activeTournament.category,
      paymentMethod: 'pix',
    });

    setEnrollP1('');
    setEnrollP2('');
    setShowQuickEnrollModal(false);
    triggerToast(
      `Inscrição #${newEntry.seed} confirmada na chave e adicionada à Classificação do Torneio!`
    );
  };

  const getInlineScore = (match: BracketMatch, side: 's1' | 's2'): string => {
    if (inlineScores[match.id]?.[side] !== undefined) {
      return inlineScores[match.id][side];
    }
    const existing = side === 's1' ? match.score1 : match.score2;
    return existing !== undefined ? String(existing) : '';
  };

  const handleInlineScoreChange = (match: BracketMatch, side: 's1' | 's2', val: string) => {
    const nextS1Str = side === 's1' ? val : getInlineScore(match, 's1');
    const nextS2Str = side === 's2' ? val : getInlineScore(match, 's2');
    setInlineScores((prev) => ({
      ...prev,
      [match.id]: {
        s1: nextS1Str,
        s2: nextS2Str,
      },
    }));

    const parsed1 = parseInt(nextS1Str, 10);
    const parsed2 = parseInt(nextS2Str, 10);
    if (!isNaN(parsed1) && !isNaN(parsed2)) {
      updateLiveRefereeMatch(match.id, (prev) => ({
        ...prev,
        score1: parsed1,
        score2: parsed2,
        status: prev.status === 'completed' ? 'completed' : 'in_progress',
      }));
    }
  };

  const handleInlineSubmit = (match: BracketMatch, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!match.team1 || !match.team2) {
      triggerToast('Defina os participantes antes de confirmar o placar.');
      return;
    }

    const s1Raw = getInlineScore(match, 's1');
    const s2Raw = getInlineScore(match, 's2');
    const s1 = s1Raw === '' ? 18 : parseInt(s1Raw, 10);
    const s2 = s2Raw === '' ? 14 : parseInt(s2Raw, 10);

    if (isNaN(s1) || isNaN(s2) || s1 === s2) {
      triggerToast('Insira um placar válido sem empate (ex: 18 x 14) para avançar o vencedor.');
      return;
    }

    const winningTeam: 1 | 2 = s1 > s2 ? 1 : 2;
    const winner = winningTeam === 1 ? match.team1 : match.team2;
    handleAdvanceMatch(match.id, winningTeam, s1, s2);
    triggerToast(
      `Jogo ${match.matchNumber} finalizado (${s1}x${s2}): ${formatParticipantName(winner)} avançou! Classificação do torneio e Ranking de Futevôlei atualizados automaticamente!`
    );
  };

  const handleOpenMatchEditor = (match: BracketMatch) => {
    setEditingMatch(match);
    setInputScore1(match.score1 ?? 18);
    setInputScore2(match.score2 ?? 14);
    setOverrideTeam1Id(match.team1?.id || '');
    setOverrideTeam2Id(match.team2?.id || '');
    setOverrideCourt(match.courtName || 'Quadra 1 - Central');
    setOverrideTime(match.scheduledTime || '14:00');
  };

  const handleSaveFullEditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    const newT1 = pairsInTourn.find((p) => p.id === overrideTeam1Id);
    const newT2 = pairsInTourn.find((p) => p.id === overrideTeam2Id);

    handleOverrideMatch(editingMatch.id, {
      team1: newT1,
      team2: newT2,
      courtName: overrideCourt,
      scheduledTime: overrideTime,
    });

    if (newT1 && newT2 && inputScore1 !== inputScore2) {
      const winningTeam: 1 | 2 = inputScore1 > inputScore2 ? 1 : 2;
      setTimeout(() => {
        handleAdvanceMatch(editingMatch.id, winningTeam, inputScore1, inputScore2);
      }, 10);
      triggerToast(
        `Jogo ${editingMatch.matchNumber} salvo! Classificação do torneio e Ranking atualizados automaticamente!`
      );
    } else {
      triggerToast(`Configuração do Jogo ${editingMatch.matchNumber} salva!`);
    }

    setEditingMatch(null);
  };

  const handleSwitchSemiFormat = (newFormat: SemiFormat) => {
    updateTournamentConfig(activeTournament.id, { semiFormat: newFormat });
    triggerToast(
      newFormat === 'semi_direta'
        ? 'Formato alterado para Semifinal Direta (Padrão Futevôlei: a partir da semi ninguém pode perder mais)!'
        : 'Formato alterado para Semi com Chance (Padrão Challonge: perdedor da semi cai pra repescagem)!'
    );
  };

  const renderMatchCard = (match: BracketMatch) => {
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'in_progress';
    const isReady = !!match.team1 && !!match.team2;

    const team1Won = isCompleted && match.winnerId === match.team1?.id;
    const team2Won = isCompleted && match.winnerId === match.team2?.id;

    // Live check if match is within 10 points of finishing (e.g. score >= 8 in an 18-point set)
    const liveS1 = parseInt(getInlineScore(match, 's1'), 10) || (match.score1 ?? 0);
    const liveS2 = parseInt(getInlineScore(match, 's2'), 10) || (match.score2 ?? 0);
    const nearEndEval = evaluateMatchNearCompletion(match, currentMatches, liveS1, liveS2, 18);

    const currentServerName =
      match.liveReferee?.serviceOrderLabels?.[match.liveReferee.serverRotationIndex];

    let routingNote = '';
    if (match.stage === 'winners') {
      routingNote = match.nextMatchLoserId ? 'Perdedor cai p/ Repescagem' : 'Vencedor avança';
    } else if (match.stage === 'losers') {
      routingNote = 'Perdedor eliminado (2ª derrota)';
    } else if (match.stage === 'semifinals') {
      routingNote = 'Mata-Mata Direto (Perdeu, sai)';
    } else {
      routingNote = 'Valendo o Título Geral';
    }

    return (
      <div
        key={match.id}
        className={`bg-white border rounded-2xl p-3.5 transition-all shadow-xs ${
          isLive
            ? 'border-amber-400 ring-2 ring-amber-400/30'
            : isCompleted
            ? 'border-slate-300 ring-1 ring-slate-100'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-slate-500 pb-2 mb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-800">Jogo {match.matchNumber}</span>
            {isLive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase animate-pulse">
                AO VIVO
              </span>
            )}
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-[11px] font-mono text-slate-500">{match.courtName || 'Quadra 1'}</span>
          </div>

          <div className="flex items-center gap-1">
            {isReady && (
              <button
                type="button"
                onClick={() => setRefereeModalMatchId(match.id)}
                className="px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                title="Abrir Tela do Árbitro (computar pontos, ordem de saque, pedidos de tempo)"
              >
                <ShieldAlert className="w-3 h-3" />
                Árbitro
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenMatchEditor(match)}
              className="p-1 text-slate-400 hover:text-slate-800 rounded cursor-pointer"
              title="Editar participantes, horário ou placar livremente"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-time Referee Info Bar inside Match Card (Service Order & Timeouts) */}
        {match.liveReferee && !isCompleted && isReady && (
          <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] flex items-center justify-between gap-2">
            <span className="truncate font-bold text-amber-300">
              🏐 Sacando: {currentServerName || '1º Sacador'}
            </span>
            <span className="font-mono text-slate-300 shrink-0">
              Tempos: {match.liveReferee.team1TimeoutsUsed}/1 · {match.liveReferee.team2TimeoutsUsed}/1
            </span>
          </div>
        )}

        <form onSubmit={(e) => handleInlineSubmit(match, e)} className="space-y-1.5">
          {/* Team 1 */}
          <div
            className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
              team1Won
                ? 'bg-amber-100/70 font-bold text-slate-900 border border-amber-300'
                : 'bg-slate-50 text-slate-700 border border-slate-100'
            }`}
          >
            <div
              onClick={() => handleOpenMatchEditor(match)}
              className="flex items-center gap-1.5 truncate pr-2 flex-1 cursor-pointer"
            >
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                {match.team1 ? `#${match.team1.seed}` : '—'}
              </span>
              <span className="truncate font-medium">
                {formatParticipantName(match.team1)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {team1Won && <Trophy className="w-3 h-3 text-amber-600 shrink-0" />}
              <input
                type="number"
                min={0}
                max={99}
                disabled={!isReady}
                placeholder="-"
                value={getInlineScore(match, 's1')}
                onChange={(e) => handleInlineScoreChange(match, 's1', e.target.value)}
                className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* Team 2 */}
          <div
            className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
              team2Won
                ? 'bg-amber-100/70 font-bold text-slate-900 border border-amber-300'
                : 'bg-slate-50 text-slate-700 border border-slate-100'
            }`}
          >
            <div
              onClick={() => handleOpenMatchEditor(match)}
              className="flex items-center gap-1.5 truncate pr-2 flex-1 cursor-pointer"
            >
              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                {match.team2 ? `#${match.team2.seed}` : '—'}
              </span>
              <span className="truncate font-medium">
                {formatParticipantName(match.team2)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {team2Won && <Trophy className="w-3 h-3 text-amber-600 shrink-0" />}
              <input
                type="number"
                min={0}
                max={99}
                disabled={!isReady}
                placeholder="-"
                value={getInlineScore(match, 's2')}
                onChange={(e) => handleInlineScoreChange(match, 's2', e.target.value)}
                className="w-12 h-7 text-center font-mono font-bold text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* 1-Click Alert for Next Match Players when <= 10 points left */}
          {!isCompleted && isReady && (
            <button
              type="button"
              onClick={() => {
                const msg = notifyLiveMatchProgress(match.id, liveS1 || 10, liveS2 || 8);
                if (msg) triggerToast(`🔔 Push enviado! ${msg}`);
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-extrabold text-[11px] flex items-center justify-between transition-colors cursor-pointer"
              title="Notificar jogadores do próximo jogo que faltam <= 10 pontos para acabar"
            >
              <span className="flex items-center gap-1">
                <BellRing className="w-3 h-3 text-amber-600" />
                Faltam {nearEndEval.pointsRemaining || 8} pts p/ acabar
              </span>
              <span className="underline">Notificar Próximo Jogo</span>
            </button>
          )}

          <div className="pt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 truncate max-w-[155px]" title={routingNote}>
              {routingNote}
            </span>

            <div className="flex items-center gap-1">
              {isReady && (
                <a
                  href={generateMatchCallWhatsAppLink(match, activeTournament.name, tenant.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Chamar jogadores no WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </a>
              )}

              {isReady && (
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                  title="Confirmar placar e popular automaticamente a próxima partida"
                >
                  <Check className="w-3 h-3" />
                  {isCompleted ? 'Atualizar' : 'Confirmar'}
                </button>
              )}

              {isCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    handleResetMatch(match.id);
                    triggerToast(`Jogo ${match.matchNumber} voltou atrás (resetado).`);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Voltar atrás / desfazer resultado"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="p-3.5 bg-slate-900 text-white border border-slate-800 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-slate-400 hover:text-white p-1 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ultra-Intuitive 3-Step Visual Guide + R$ 20 / Table & R$ 99 / Month Conversion Strip */}
      <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded bg-slate-950 text-amber-400 font-black uppercase text-[10px]">
              TABELA OFICIAL SHARK SET · FÁCIL DE USAR POR QUALQUER PESSOA
            </span>
            <span className="font-bold text-emerald-700">
              {tournaments.length} campeonatos ativos em {availableTenants.length} arenas simultâneas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
            <button
              type="button"
              onClick={() => setShowQuickEnrollModal(true)}
              className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-all cursor-pointer"
            >
              <span className="font-black text-emerald-950 block">PASSO 1 · Inscrever Dupla</span>
              <span className="text-[11px] text-emerald-800">
                Garanta a vaga na hora (confirma com pagamento dos 2 atletas)
              </span>
            </button>

            <button
              type="button"
              onClick={openStartDrawModal}
              className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-left transition-all cursor-pointer"
            >
              <span className="font-black text-amber-950 block">PASSO 2 · Sortear ou Posicionar</span>
              <span className="text-[11px] text-amber-900">
                Sorteio aleatório ou escolha manual das duplas presentes
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const target = liveMatches[0] || currentMatches[0];
                if (target) setRefereeModalMatchId(target.id);
              }}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-left transition-all cursor-pointer"
            >
              <span className="font-black text-slate-950 block">PASSO 3 · Placar & Súmula Ao Vivo</span>
              <span className="text-[11px] text-slate-700">
                Toque em qualquer jogo para somar pontos, saque e tempo ao vivo
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row xl:flex-col gap-2 shrink-0 border-t xl:border-t-0 xl:border-l border-slate-200 pt-3 xl:pt-0 xl:pl-4">
          <button
            type="button"
            onClick={() => setActiveTab('saas_hub')}
            className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Comprar Tabela (R$ 20) ou Plano Arena (R$ 99/mês)
          </button>
          <button
            type="button"
            onClick={() => {
              setArenaSubTab('aulas');
              setActiveTab('scheduler');
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition-all cursor-pointer text-center"
          >
            Ir para Aulas, Alunos & Mensalidades →
          </button>
        </div>
      </div>

      {/* Tournament Management Header — High-Contrast SHARK SET Visual Hierarchy */}
      <div className="bg-slate-950 text-white border border-slate-800 rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black uppercase text-[10px]">
                SHARK SET · {isSingles ? 'SIMPLES (1x1)' : 'DUPLAS (2x2)'}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-extrabold text-amber-400">
                {TOURNAMENT_CATEGORY_LABELS[activeTournament.category]}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                {activeTournament.date}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {activeTournament.location || `${tenant.name} (${tenant.city})`}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="font-extrabold text-emerald-400">
                Vagas: {activePairsInTourn.length} / {activeTournament.maxPairs} ({confirmedPairsCount} confirmadas · {presentPairsInTourn.length} presentes)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {activeTournament.name}
            </h1>

            {activeTournament.specificRules && (
              <p className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-3 max-w-3xl">
                <strong className="text-amber-400">Regras Específicas:</strong> {activeTournament.specificRules}
              </p>
            )}
          </div>

          {/* Eye-Catching Action Buttons: Start Tournament Draw, Switch Tournament, Quick Enroll, Edit Rules, New Tournament */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              value={activeTournamentId}
              onChange={(e) => setActiveTournamentId(e.target.value)}
              className="px-3.5 py-2.5 text-xs font-extrabold bg-slate-900 text-white border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <button
              onClick={openStartDrawModal}
              className="px-4 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              INICIAR TORNEIO / TABELA ({presentPairsInTourn.length} PRESENTES)
            </button>

            <button
              onClick={() => setShowQuickEnrollModal(true)}
              className="px-4 py-2.5 text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              INSCREVER {isSingles ? 'JOGADOR (1x1)' : 'DUPLA (2x2)'}
            </button>

            <button
              onClick={openEditModal}
              className="px-3.5 py-2.5 text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Regras & Config
            </button>

            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 text-xs font-black text-slate-950 bg-white hover:bg-slate-100 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              CRIAR NOVO TORNEIO
            </button>
          </div>
        </div>

        {/* Real-Time Live Match Scoreboard Banner (Visible to all spectators & players on the bracket page) */}
        {liveMatches.length > 0 && (
          <div className="bg-slate-900/95 border-2 border-amber-400/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase animate-pulse">
                  <Radio className="w-3.5 h-3.5" />
                  PLACAR AO VIVO EM TEMPO REAL
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Qualquer jogador nesta página acompanha os pontos, ordem de saque e pedidos de tempo ao vivo.
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-400">
                Sincronização Instantânea Ativa
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {liveMatches.map((lm) => {
                const refState = lm.liveReferee;
                const currentServer =
                  refState?.serviceOrderLabels?.[refState.serverRotationIndex] || lm.team1?.player1;
                const lastPoint = refState?.pointHistory?.[0];
                return (
                  <div
                    key={lm.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-amber-400">
                        Jogo {lm.matchNumber} · {lm.stageName} ({lm.courtName || 'Quadra Central'})
                      </span>
                      <button
                        type="button"
                        onClick={() => setRefereeModalMatchId(lm.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Abrir Súmula do Árbitro
                      </button>
                    </div>

                    <div className="grid grid-cols-7 items-center gap-2 bg-slate-900 rounded-xl p-3 border border-slate-800">
                      <div className="col-span-3">
                        <div className="text-xs font-extrabold text-white truncate">
                          {formatParticipantName(lm.team1)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tempos: {refState?.team1TimeoutsUsed ?? 0}/1
                        </div>
                      </div>

                      <div className="col-span-1 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono font-black text-base tabular-nums">
                          {lm.score1 ?? 0}x{lm.score2 ?? 0}
                        </span>
                      </div>

                      <div className="col-span-3 text-right">
                        <div className="text-xs font-extrabold text-white truncate">
                          {formatParticipantName(lm.team2)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tempos: {refState?.team2TimeoutsUsed ?? 0}/1
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                      <span className="font-bold text-emerald-400">
                        🏐 Sacando agora: {currentServer}
                      </span>
                      {refState?.activeTimeout ? (
                        <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          Pedido de Tempo: {refState.activeTimeout.label}
                        </span>
                      ) : lastPoint ? (
                        <span className="text-slate-400 truncate">
                          Último lance ({lastPoint.scoreAfter}): <strong className="text-white">{lastPoint.scorerName}</strong> ({lastPoint.skill})
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Trocas de quadra: {refState?.courtSwapsCount ?? 0}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Format Switcher: Semi Direta (Futevôlei) vs Semi com Chance (Challonge) */}
        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5 text-xs">
            <span className="font-extrabold text-amber-400 uppercase tracking-wider block text-[11px]">
              Formato da Semifinal & Pontuação Automática no Ranking SHARK SET:
            </span>
            <span className="text-slate-300">
              Clique em qualquer partida para lançar ou editar o placar. A <strong>Classificação do Torneio</strong> e o <strong>Ranking Oficial</strong> atualizam instantaneamente.
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => handleSwitchSemiFormat('semi_direta')}
              className={`px-3.5 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTournament.semiFormat === 'semi_direta'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              ⚽ Semi Direta (Futevôlei)
            </button>
            <button
              onClick={() => handleSwitchSemiFormat('semi_com_chance')}
              className={`px-3.5 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                activeTournament.semiFormat === 'semi_com_chance'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🏆 Semi com Chance (Challonge)
            </button>
          </div>
        </div>

        {/* Podium Highlight */}
        {podium.champion && (
          <div className="pt-4 border-t border-slate-100 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                  Pódio Oficial Homologado
                </span>
                <span className="text-base font-extrabold text-slate-900">
                  🥇 1º Lugar: {formatParticipantName(podium.champion)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-600">
              {podium.runnerUp && (
                <div>
                  <span className="text-slate-400 block">🥈 2º Lugar (Vice):</span>
                  <span className="font-bold text-slate-800">
                    {formatParticipantName(podium.runnerUp)}
                  </span>
                </div>
              )}
              {podium.thirdPlace && (
                <div>
                  <span className="text-slate-400 block">🥉 3º Lugar:</span>
                  <span className="font-bold text-slate-800">
                    {formatParticipantName(podium.thirdPlace)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dual View Mode Switcher (Chaveamento Oficial c/ Infinity Scroll vs Visualização em Lista) + Stage Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-900 uppercase tracking-wider px-2">
            Modo de Visualização da Tabela:
          </span>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl">
            <button
              type="button"
              onClick={() => setBracketViewMode('chaveamento')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                bracketViewMode === 'chaveamento'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🏆 1. Em Chaveamento (Tabela Oficial c/ Infinity Scroll)
            </button>
            <button
              type="button"
              onClick={() => setBracketViewMode('lista')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                bracketViewMode === 'lista'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📋 2. Em Lista (Por Fase / Rodada)
            </button>
          </div>
        </div>

        {/* Stage & Standings Filter */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveStageTab('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tabela Completa
          </button>
          <button
            onClick={() => setActiveStageTab('standings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'standings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Classificação ({standings.length})
          </button>
          <button
            onClick={() => {
              setBracketViewMode('lista');
              setActiveStageTab('winners');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'winners' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vencedores ({winnersMatches.length})
          </button>
          <button
            onClick={() => {
              setBracketViewMode('lista');
              setActiveStageTab('losers');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'losers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Repescagem ({losersMatches.length})
          </button>
          <button
            onClick={() => {
              setBracketViewMode('lista');
              setActiveStageTab('final');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeStageTab === 'final' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semis & Final
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VISUALIZAÇÃO 1: CHAVEAMENTO OFICIAL DE FUTEVÔLEI COM INFINITY SCROLL   */}
      {/* ===================================================================== */}
      {activeStageTab !== 'standings' && bracketViewMode === 'chaveamento' && (
        <FutevoleiVisualBracketCanvas
          matches={currentMatches}
          semiFormat={activeTournament.semiFormat}
          isSingles={isSingles}
          formatParticipantName={formatParticipantName}
          getInlineScore={getInlineScore}
          onInlineScoreChange={handleInlineScoreChange}
          onInlineSubmit={handleInlineSubmit}
          onOpenRefereeModal={(mId) => setRefereeModalMatchId(mId)}
          onOpenMatchEditor={handleOpenMatchEditor}
        />
      )}

      {/* ===================================================================== */}
      {/* TABELA DE CLASSIFICAÇÃO AUTOMÁTICA DO TORNEIO                         */}
      {/* ===================================================================== */}
      {(activeStageTab === 'all' || activeStageTab === 'standings') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Classificação Automática do Torneio (Tempo Real)
              </h2>
              <p className="text-xs text-slate-500">
                Gerada automaticamente conforme os resultados dos jogos são inseridos nas partidas abaixo.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              {currentMatches.filter((m) => m.status === 'completed').length} de {currentMatches.length} jogos concluídos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Pos</th>
                  <th className="py-2.5 px-3">{isSingles ? 'Jogador (Simples)' : 'Dupla Participante'}</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-center">J</th>
                  <th className="py-2.5 px-3 text-center">V</th>
                  <th className="py-2.5 px-3 text-center">D</th>
                  <th className="py-2.5 px-3 text-center">Pró / Contra</th>
                  <th className="py-2.5 px-3 text-center">Saldo</th>
                  <th className="py-2.5 px-3 text-center">Aprov.</th>
                  <th className="py-2.5 px-3 text-right">Pts Ranking Ganhos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standings.map((row) => (
                  <tr key={row.pair.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-extrabold text-slate-900">
                      {row.position}º
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">
                        {formatParticipantName(row.pair)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Seed #{row.pair.seed} · {ATHLETE_LEVEL_LABELS[row.pair.player1Level]}
                        {!isSingles ? ` + ${ATHLETE_LEVEL_LABELS[row.pair.player2Level]}` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-bold text-[11px] ${
                          row.statusBadge.includes('Campeão')
                            ? 'text-amber-700'
                            : row.statusBadge === 'Invicto'
                            ? 'text-emerald-700'
                            : row.statusBadge.includes('Eliminado')
                            ? 'text-rose-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {row.statusBadge}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{row.matchesPlayed}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{row.wins}</td>
                    <td className="py-3 px-3 text-center font-mono text-rose-600">{row.losses}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {row.pointsFor} : {row.pointsAgainst}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold">{row.winRate}%</td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                      +{row.rankingPointsEarned} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISUALIZAÇÃO 2: EM LISTA (CARDS POR FASE / RODADA) */}
      {activeStageTab !== 'standings' && bracketViewMode === 'lista' && (
        <div className="space-y-8">
          {/* SECTION 1: CHAVE DOS VENCEDORES */}
          {(activeStageTab === 'all' || activeStageTab === 'winners') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Chave dos Vencedores (Principal)
                </h2>
                <span className="text-xs text-slate-400">
                  Insira os placares para avançar vencedores e gerar a classificação
                </span>
              </div>

              <div
                className={`grid grid-cols-1 md:grid-cols-2 ${
                  activeTournament.semiFormat === 'semi_com_chance' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
                } gap-4`}
              >
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                    Rodada 1: Quartas de Final (J1 a J4)
                  </div>
                  {winnersMatches.filter((m) => m.round === 1).map((m) => renderMatchCard(m))}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                    {activeTournament.semiFormat === 'semi_direta'
                      ? 'Rodada 2: Vale Vaga Direta na Semifinal (J7 e J8)'
                      : 'Rodada 2: Semifinal Vencedores (J7 e J8)'}
                  </div>
                  {winnersMatches.filter((m) => m.round === 2).map((m) => renderMatchCard(m))}
                </div>

                {activeTournament.semiFormat === 'semi_com_chance' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                      Rodada 3: Final dos Vencedores (J11)
                    </div>
                    {winnersMatches.filter((m) => m.round === 3).map((m) => renderMatchCard(m))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: CHAVE DOS PERDEDORES (REPESCAGEM / BURACO) */}
          {(activeStageTab === 'all' || activeStageTab === 'losers') && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                  Chave dos Perdedores (Repescagem / Buraco)
                </h2>
                <span className="text-xs text-slate-400">Quem perde 2 vezes está eliminado</span>
              </div>

              <div
                className={`grid grid-cols-1 md:grid-cols-2 ${
                  activeTournament.semiFormat === 'semi_com_chance' ? 'lg:grid-cols-4' : 'lg:grid-cols-2'
                } gap-4`}
              >
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                    Repescagem R1 (Perdedores da R1 - J5 e J6)
                  </div>
                  {losersMatches.filter((m) => m.round === 1).map((m) => renderMatchCard(m))}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                    {activeTournament.semiFormat === 'semi_direta'
                      ? 'Repescagem R2: Vale Vaga na Semifinal Direta (J9 e J10)'
                      : 'Repescagem R2: Cruzamento c/ Perdedores da Semi (J9 e J10)'}
                  </div>
                  {losersMatches.filter((m) => m.round === 2).map((m) => renderMatchCard(m))}
                </div>

                {activeTournament.semiFormat === 'semi_com_chance' && (
                  <>
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                        Repescagem R3: Semifinal Perdedores (J12)
                      </div>
                      {losersMatches.filter((m) => m.round === 3).map((m) => renderMatchCard(m))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                        Repescagem R4: Final Perdedores (J13)
                      </div>
                      {losersMatches.filter((m) => m.round === 4).map((m) => renderMatchCard(m))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: FASE FINAL */}
          {(activeStageTab === 'all' || activeStageTab === 'final') && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  {activeTournament.semiFormat === 'semi_direta'
                    ? 'Semifinais Diretas (Mata-Mata) & Grande Final'
                    : 'Grande Final (Campeão Vencedores vs Campeão Repescagem)'}
                </h2>
              </div>

              {activeTournament.semiFormat === 'semi_direta' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                      Semifinais Diretas (2 Invictos vs 2 da Repescagem)
                    </div>
                    {semiMatches.map((m) => renderMatchCard(m))}
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">
                      Grande Final (Jogo Único pelo Título)
                    </div>
                    {grandFinalMatches.map((m) => renderMatchCard(m))}
                  </div>
                </div>
              ) : (
                <div className="max-w-md mx-auto">
                  {grandFinalMatches.map((m) => renderMatchCard(m))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL A: CREATE OR EDIT TOURNAMENT (NOME, DATA, LOCAL, SIMPLES/DUPLAS, REGRAS, LIMITE) */}
      {/* ===================================================================== */}
      {showTournamentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveTournamentModal} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-700">
                    Gestão de Torneios de Futevôlei
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {showTournamentModal === 'create'
                      ? 'Criar Novo Torneio de Futevôlei'
                      : 'Gerenciar & Editar Configurações do Torneio'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTournamentModal(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome do Torneio:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Copa Regional de Futevôlei Mineiros"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data do Torneio:</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local / Arena:</label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Ex: SHARK SET Arena Matriz - Mineiros/GO"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Formato: Simples (1x1) vs Duplas (2x2) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Formato de Participação (Simples vs Duplas):
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormModality('duplas')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formModality === 'duplas'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-bold block">Duplas (2x2 Tradicional)</span>
                    <span className="text-[11px] opacity-80 block">
                      Validação de equilíbrio de pareamento entre os 2 parceiros.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormModality('simples')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      formModality === 'simples'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="font-bold block">Simples (1x1 / Desafio Individual)</span>
                    <span className="text-[11px] opacity-80 block">
                      Inscrição individual por jogador com pontuação direta no Ranking.
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria / Série:</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TournamentCategory)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                  >
                    {Object.entries(TOURNAMENT_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Limite de Participantes:</label>
                  <select
                    value={formMaxParticipants}
                    onChange={(e) => setFormMaxParticipants(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                  >
                    <option value={4}>4 Vagas</option>
                    <option value={8}>8 Vagas (Padrão Buraco 4)</option>
                    <option value={12}>12 Vagas</option>
                    <option value={16}>16 Vagas</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Taxa de Inscrição (R$):</label>
                  <input
                    type="number"
                    value={formFee}
                    onChange={(e) => setFormFee(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Regras Específicas do Torneio:
                </label>
                <textarea
                  rows={3}
                  value={formRules}
                  onChange={(e) => setFormRules(e.target.value)}
                  placeholder="Defina pontuação dos sets (ex: 18 pts), regras de saque, tempo técnico, critério de desempate..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTournamentModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {showTournamentModal === 'create' ? 'Criar Torneio Oficial' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL B: SISTEMA DE INSCRIÇÃO RÁPIDA NO TORNEIO (SIMPLES OU DUPLAS)   */}
      {/* ===================================================================== */}
      {showQuickEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleQuickEnrollSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">
                    Sistema de Inscrição ({pairsInTourn.length}/{activeTournament.maxPairs} Vagas)
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Inscrever {isSingles ? 'Jogador (Simples 1x1)' : 'Dupla (2x2)'} em {activeTournament.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickEnrollModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isSingles ? 'Nome do Jogador:' : 'Atleta 1:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={enrollP1}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEnrollP1(val);
                      const found = athletes.find((a) => a.name.toLowerCase() === val.toLowerCase());
                      if (found) setEnrollLvl1(found.level);
                    }}
                    placeholder="Ex: Edmar Júnio"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nível Ranking:</label>
                  <select
                    value={enrollLvl1}
                    onChange={(e) => setEnrollLvl1(e.target.value as AthleteLevel)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Atleta 2 (Parceiro):</label>
                    <input
                      type="text"
                      required
                      value={enrollP2}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEnrollP2(val);
                        const found = athletes.find((a) => a.name.toLowerCase() === val.toLowerCase());
                        if (found) setEnrollLvl2(found.level);
                      }}
                      placeholder="Ex: Juninho Silva"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nível Parceiro:</label>
                    <select
                      value={enrollLvl2}
                      onChange={(e) => setEnrollLvl2(e.target.value as AthleteLevel)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
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

              <div
                className={`p-3 rounded-xl border flex items-start gap-2 ${
                  enrollValidation.isValid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">{enrollValidation.reason}</span>
                  <span className="text-[11px] opacity-80 block">{enrollValidation.ruleSummary}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp de Contato:</label>
                <input
                  type="tel"
                  value={enrollPhone}
                  onChange={(e) => setEnrollPhone(e.target.value)}
                  placeholder="(64) 99988-1122"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickEnrollModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!enrollValidation.isValid || pairsInTourn.length >= activeTournament.maxPairs}
                  className={`px-5 py-2.5 text-xs font-semibold rounded-xl ${
                    enrollValidation.isValid && pairsInTourn.length < activeTournament.maxPairs
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Confirmar Inscrição na Chave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Unfrozen Match Editor Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-700">
                  Edição Livre de Partida (Nada Congelado)
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Jogo {editingMatch.matchNumber} · {editingMatch.stageName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFullEditor} className="py-4 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block font-bold text-slate-800">Lado 1 (Substituir ou manter):</label>
                <div className="flex items-center gap-2">
                  <select
                    value={overrideTeam1Id}
                    onChange={(e) => setOverrideTeam1Id(e.target.value)}
                    className="flex-1 px-2.5 py-2 bg-white border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="">-- Aguardando / Vazio --</option>
                    {pairsInTourn.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.seed} - {formatParticipantName(p)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputScore1}
                    onChange={(e) => setInputScore1(parseInt(e.target.value, 10) || 0)}
                    className="w-20 px-2.5 py-2 text-center font-mono font-bold text-base bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block font-bold text-slate-800">Lado 2 (Substituir ou manter):</label>
                <div className="flex items-center gap-2">
                  <select
                    value={overrideTeam2Id}
                    onChange={(e) => setOverrideTeam2Id(e.target.value)}
                    className="flex-1 px-2.5 py-2 bg-white border border-slate-200 rounded-lg font-semibold"
                  >
                    <option value="">-- Aguardando / Vazio --</option>
                    {pairsInTourn.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.seed} - {formatParticipantName(p)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={inputScore2}
                    onChange={(e) => setInputScore2(parseInt(e.target.value, 10) || 0)}
                    className="w-20 px-2.5 py-2 text-center font-mono font-bold text-base bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quadra do Jogo:</label>
                  <input
                    type="text"
                    value={overrideCourt}
                    onChange={(e) => setOverrideCourt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Horário:</label>
                  <input
                    type="text"
                    value={overrideTime}
                    onChange={(e) => setOverrideTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleResetMatch(editingMatch.id);
                    setEditingMatch(null);
                    triggerToast(`Partida ${editingMatch.matchNumber} resetada.`);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Zerar / Voltar Atrás
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMatch(null)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar & Atualizar Classificação
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Tournament & Dynamic Draw Builder Modal (Present Pairs + Random or Manual Slot Placement) */}
      {showStartDrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black uppercase text-[10px]">
                  INICIAR TORNEIO & GERAR TABELA OFICIAL
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Tabela para Duplas Presentes ({presentPairsInTourn.length} presentes de {activePairsInTourn.length} ativas)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirme as duplas presentes na arena e escolha entre <strong>Seleção Aleatória (Sorteio)</strong> ou <strong>Colocar as Duplas Onde Quiser</strong> na chave.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStartDrawModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Check-in de Presença e Pagamento dos 2 Jogadores */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  1. Check-in de Presença e Status da Vaga (2 Pagamentos)
                </h4>
                <span className="text-[11px] font-bold text-emerald-700">
                  {presentPairsInTourn.length} duplas marcadas como PRESENTES
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
                {activePairsInTourn.map((pair) => {
                  const isPresent = pair.isPresent !== false;
                  const isConfirmed = pair.enrollmentStatus === 'confirmed';
                  return (
                    <div
                      key={pair.id}
                      className={`p-3 flex flex-wrap items-center justify-between gap-2 text-xs ${
                        isPresent ? 'bg-white' : 'bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">#{pair.seed}</span>
                        <div>
                          <div className="font-extrabold text-slate-900">
                            {pair.player1} & {pair.player2}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                isConfirmed ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isConfirmed ? '✓ Vaga Confirmada (2/2 Pagos)' : '⏳ Vaga Pendente'}
                            </span>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => togglePairPlayerPayment(pair.id, 1)}
                              className={`underline cursor-pointer ${
                                pair.player1Paid ? 'text-emerald-700 font-bold' : 'text-amber-700'
                              }`}
                            >
                              {pair.player1}: {pair.player1Paid ? 'Pago' : 'Pendente'}
                            </button>
                            <span>/</span>
                            <button
                              type="button"
                              onClick={() => togglePairPlayerPayment(pair.id, 2)}
                              className={`underline cursor-pointer ${
                                pair.player2Paid ? 'text-emerald-700 font-bold' : 'text-amber-700'
                              }`}
                            >
                              {pair.player2}: {pair.player2Paid ? 'Pago' : 'Pendente'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          togglePairPresence(pair.id);
                          setManualSlotOrder((prev) =>
                            isPresent ? prev.filter((id) => id !== pair.id) : [...prev, pair.id]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                          isPresent
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {isPresent ? '✓ Presente no Torneio' : 'Ausente (Fora da Tabela)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Choose Random Draw vs Manual Placement */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                2. Como deseja posicionar as {presentPairsInTourn.length} duplas presentes na tabela?
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDrawMode('random')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    drawMode === 'random'
                      ? 'bg-slate-950 text-white border-slate-950 ring-2 ring-amber-400'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-sm">
                    <Shuffle className="w-4 h-4 text-amber-400" />
                    Seleção Aleatória (Sorteio)
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      drawMode === 'random' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    O sistema embaralha automaticamente todas as duplas presentes e monta os confrontos da 1ª rodada.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDrawMode('manual');
                    const presentIds = presentPairsInTourn.map((p) => p.id);
                    setManualSlotOrder((prev) => [
                      ...prev.filter((id) => presentIds.includes(id)),
                      ...presentIds.filter((id) => !prev.includes(id)),
                    ]);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    drawMode === 'manual'
                      ? 'bg-slate-950 text-white border-slate-950 ring-2 ring-amber-400'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-sm">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Colocar as Duplas Onde Quiser (Manual)
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      drawMode === 'manual' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Defina exatamente a posição de cada dupla nos confrontos da 1ª rodada antes de liberar os jogos.
                  </p>
                </button>
              </div>

              {drawMode === 'manual' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800">
                      Ordem Manual dos Confrontos (1ª Rodada):
                    </span>
                    <span className="text-slate-500">
                      Use as setas ↑ ↓ para colocar cada dupla no confronto desejado
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {manualSlotOrder
                      .filter((id) => presentPairsInTourn.some((p) => p.id === id))
                      .map((pairId, idx, arr) => {
                        const pairObj = presentPairsInTourn.find((p) => p.id === pairId);
                        if (!pairObj) return null;
                        const matchNum = Math.floor(idx / 2) + 1;
                        const slotSide = idx % 2 === 0 ? 'Lado A' : 'Lado B';
                        return (
                          <div
                            key={pairObj.id}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="truncate">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-black text-[10px] mr-1.5">
                                Jogo {matchNum} ({slotSide})
                              </span>
                              <span className="font-bold text-slate-900">
                                {pairObj.player1} & {pairObj.player2}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveManualPair(idx, -1)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                title="Subir posição"
                              >
                                <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => moveManualPair(idx, 1)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                                title="Descer posição"
                              >
                                <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Assim que o resultado de cada partida é confirmado, a próxima fase é populada automaticamente.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowStartDrawModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStartTournamentDraw}
                  className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  Gerar Tabela p/ {presentPairsInTourn.length} Duplas Presentes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Referee Console Modal (Points, Service Order, Timeouts, Court Swaps, Real-Time Broadcast) */}
      {activeRefereeMatch && (
        <RefereeConsoleModal
          match={activeRefereeMatch}
          arenaName={tenant.name}
          onClose={() => setRefereeModalMatchId(null)}
          onUpdateLiveMatch={(matchId, updater) => {
            updateLiveRefereeMatch(matchId, updater);
          }}
          onConfirmFinalResult={(matchId, winningTeam, s1, s2) => {
            handleAdvanceMatch(matchId, winningTeam, s1, s2);
            setRefereeModalMatchId(null);
            triggerToast(
              `Partida finalizada pelo árbitro (${s1}x${s2})! Vencedor avançou automaticamente para a próxima fase!`
            );
          }}
          onNotify10PointsRemaining={(matchId, s1, s2) => {
            const msg = notifyLiveMatchProgress(matchId, s1, s2);
            if (msg) triggerToast(`🔔 Push enviado! ${msg}`);
          }}
        />
      )}
    </div>
  );
};
