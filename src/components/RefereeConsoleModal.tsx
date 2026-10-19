import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { BracketMatch, PointSkillType, RefereeCardEvent, RefereePointEvent, RefereeTimeoutEvent } from '../types';
import { buildDefaultRefereeState } from '../services/bracketEngine';
import { buildServiceOrder, pairAthletes, teamAtServiceIndex } from '../services/serviceOrder';
import { auth, db } from '../lib/firebase';
import {
  Award,
  BellRing,
  Check,
  Clock,
  Flame,
  Link2,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Timer,
  Trophy,
  Undo2,
  X,
  Zap,
} from 'lucide-react';

interface RefereeConsoleModalProps {
  match: BracketMatch;
  arenaName: string;
  /** Arena (tenant) id: its broadcasts are offered for linking. */
  arenaId?: string;
  /** All matches of the tournament, used to prevent one broadcast from serving two matches. */
  tournamentMatches?: BracketMatch[];
  onClose: () => void;
  onUpdateLiveMatch: (matchId: string, updater: (prev: BracketMatch) => BracketMatch) => void;
  onConfirmFinalResult: (matchId: string, winningTeam: 1 | 2, score1: number, score2: number) => void;
  onNotify10PointsRemaining: (matchId: string, score1: number, score2: number) => void;
}

interface LinkableBroadcast {
  id: string;
  ownerId: string;
  title: string;
  isLive: boolean;
  revision: number;
}

const SKILL_LABELS: Record<PointSkillType, { label: string; badge: string }> = {
  normal: { label: 'Ponto de Rally', badge: '🏐 Rally' },
  shark_attack: { label: 'Shark Attack', badge: '🦈 Shark Attack' },
  ace: { label: 'Ace de Saque', badge: '🎯 Ace' },
  pingo: { label: 'Pingo na Areia', badge: '💧 Pingo' },
  erro_adv: { label: 'Erro Adversário', badge: '⚠️ Erro Adv.' },
};

export const RefereeConsoleModal: React.FC<RefereeConsoleModalProps> = ({
  match,
  arenaName,
  arenaId,
  tournamentMatches = [],
  onClose,
  onUpdateLiveMatch,
  onConfirmFinalResult,
  onNotify10PointsRemaining,
}) => {
  const [selectedSkill, setSelectedSkill] = useState<PointSkillType>('normal');
  const [cardReason, setCardReason] = useState<string>('Reclamação com arbitragem');
  const [broadcastsByArena, setBroadcastsByArena] = useState<LinkableBroadcast[]>([]);
  const [broadcastsByOwner, setBroadcastsByOwner] = useState<LinkableBroadcast[]>([]);
  const [syncNotice, setSyncNotice] = useState<string>('');
  const revisionRef = useRef(0);
  const syncQueue = useRef<{ busy: boolean; pending: { s1: number; s2: number } | null }>({ busy: false, pending: null });

  const refState = match.liveReferee || buildDefaultRefereeState(match);
  const cardsHistory = refState.cardsHistory || [];
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const totalPoints = score1 + score2;
  const targetPoints = refState.targetPoints || 18;
  const shouldSwapCourt = totalPoints > 0 && totalPoints % 6 === 0;

  const team1Label = match.team1
    ? match.team1.player2.toLowerCase() === 'individual (1x1)'
      ? match.team1.player1
      : `${match.team1.player1} & ${match.team1.player2}`
    : 'Dupla 1';

  const team2Label = match.team2
    ? match.team2.player2.toLowerCase() === 'individual (1x1)'
      ? match.team2.player1
      : `${match.team2.player1} & ${match.team2.player2}`
    : 'Dupla 2';

  const currentServerLabel =
    refState.serviceOrderLabels[refState.serverRotationIndex] || refState.serviceOrderLabels[0];

  // ---- Official broadcast linking (one tournament can have several broadcasts; each match picks its own) ----
  useEffect(() => {
    if (!arenaId) return;
    return onSnapshot(
      query(collection(db, 'broadcasts'), where('arenaId', '==', arenaId)),
      (snapshot) => setBroadcastsByArena(snapshot.docs.map((d) => d.data() as LinkableBroadcast)),
      () => setBroadcastsByArena([])
    );
  }, [arenaId]);

  const ownerUid = auth.currentUser?.uid;
  useEffect(() => {
    if (!ownerUid) return;
    return onSnapshot(
      query(collection(db, 'broadcasts'), where('ownerId', '==', ownerUid)),
      (snapshot) => setBroadcastsByOwner(snapshot.docs.map((d) => d.data() as LinkableBroadcast)),
      () => setBroadcastsByOwner([])
    );
  }, [ownerUid]);

  const availableBroadcasts = Array.from(
    new Map([...broadcastsByArena, ...broadcastsByOwner].map((b) => [b.id, b])).values()
  );
  const linkedBroadcast = availableBroadcasts.find((b) => b.id === match.linkedBroadcastId);
  const canDriveLinkedScore = Boolean(linkedBroadcast && ownerUid && linkedBroadcast.ownerId === ownerUid);
  if (linkedBroadcast) revisionRef.current = Math.max(revisionRef.current, linkedBroadcast.revision);

  const handleScorePoint = (scoringTeam: 1 | 2) => {
    const nextScore1 = scoringTeam === 1 ? score1 + 1 : score1;
    const nextScore2 = scoringTeam === 2 ? score2 + 1 : score2;
    const nextTotal = nextScore1 + nextScore2;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      const wasServingTeam = currentRef.servingTeam;

      // Official Futevôlei Service Rotation Rule:
      // If the receiving team wins the point (side-out / virada de bola), advance to the next server in the 4-player rotation!
      let nextRotationIdx = currentRef.serverRotationIndex;
      if (scoringTeam !== wasServingTeam) {
        nextRotationIdx = ((currentRef.serverRotationIndex + 1) % 4) as 0 | 1 | 2 | 3;
      }

      const nextServingTeam: 1 | 2 = nextRotationIdx === 0 || nextRotationIdx === 2 ? 1 : 2;
      const autoSwap = nextTotal > 0 && nextTotal % 6 === 0;

      const scorerName = scoringTeam === 1 ? team1Label : team2Label;
      const pointEv: RefereePointEvent = {
        id: `pt-${Date.now()}`,
        timestamp: nowTime,
        scoringTeam,
        scorerName,
        serverName: currentRef.serviceOrderLabels[currentRef.serverRotationIndex],
        skill: selectedSkill,
        scoreAfter: `${nextScore1} x ${nextScore2}`,
      };

      return {
        ...prev,
        status: 'in_progress',
        score1: nextScore1,
        score2: nextScore2,
        liveReferee: {
          ...currentRef,
          servingTeam: nextServingTeam,
          serverRotationIndex: nextRotationIdx,
          courtSwapsCount: autoSwap ? currentRef.courtSwapsCount + 1 : currentRef.courtSwapsCount,
          currentSidesSwapped: autoSwap ? !currentRef.currentSidesSwapped : currentRef.currentSidesSwapped,
          activeTimeout: null,
          updatedAt: nowTime,
          pointHistory: [pointEv, ...currentRef.pointHistory].slice(0, 30),
        },
      };
    });

    // If match reaches 8 points (10 points left to 18), automatically trigger the 10-points-remaining notification
    const maxScore = Math.max(nextScore1, nextScore2);
    if (targetPoints - maxScore === 10 || targetPoints - maxScore === 5) {
      onNotify10PointsRemaining(match.id, nextScore1, nextScore2);
    }

    setSelectedSkill('normal');
  };

  const handleDecrementPoint = (team: 1 | 2) => {
    const nextScore1 = team === 1 ? Math.max(0, score1 - 1) : score1;
    const nextScore2 = team === 2 ? Math.max(0, score2 - 1) : score2;
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        score1: nextScore1,
        score2: nextScore2,
        liveReferee: {
          ...currentRef,
          updatedAt: nowTime,
          pointHistory: currentRef.pointHistory.slice(1),
        },
      };
    });
  };

  const handleSelectServerRotation = (idx: 0 | 1 | 2 | 3) => {
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nextServingTeam: 1 | 2 = idx === 0 || idx === 2 ? 1 : 2;
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        status: 'in_progress',
        liveReferee: {
          ...currentRef,
          servingTeam: nextServingTeam,
          serverRotationIndex: idx,
          updatedAt: nowTime,
        },
      };
    });
  };

  const handleRequestTimeout = (requestedBy: 'team1' | 'team2' | 'technical') => {
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const label =
      requestedBy === 'team1'
        ? `Tempo Pedido: ${team1Label}`
        : requestedBy === 'team2'
        ? `Tempo Pedido: ${team2Label}`
        : 'Tempo Técnico Oficial';

    const timeoutEv: RefereeTimeoutEvent = {
      id: `to-${Date.now()}`,
      timestamp: nowTime,
      requestedBy,
      teamName: label,
      scoreAtTimeout: `${score1} x ${score2}`,
    };

    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        status: 'in_progress',
        liveReferee: {
          ...currentRef,
          team1TimeoutsUsed:
            requestedBy === 'team1' ? currentRef.team1TimeoutsUsed + 1 : currentRef.team1TimeoutsUsed,
          team2TimeoutsUsed:
            requestedBy === 'team2' ? currentRef.team2TimeoutsUsed + 1 : currentRef.team2TimeoutsUsed,
          activeTimeout: {
            type: requestedBy,
            label,
            startedAt: nowTime,
          },
          updatedAt: nowTime,
          timeoutHistory: [timeoutEv, ...currentRef.timeoutHistory],
        },
      };
    });
  };

  const handleClearActiveTimeout = () => {
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        liveReferee: {
          ...currentRef,
          activeTimeout: null,
        },
      };
    });
  };

  const handleManualCourtSwap = () => {
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        liveReferee: {
          ...currentRef,
          courtSwapsCount: currentRef.courtSwapsCount + 1,
          currentSidesSwapped: !currentRef.currentSidesSwapped,
          updatedAt: nowTime,
        },
      };
    });
  };

  const handleIssueCard = (team: 1 | 2, playerName: string, cardType: 'yellow' | 'red' = 'yellow') => {
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const newCard: RefereeCardEvent = {
      id: `card-${Date.now()}`,
      timestamp: nowTime,
      team,
      playerName,
      cardType,
      reason: cardReason,
      scoreAtCard: `${score1} x ${score2}`,
    };

    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        status: 'in_progress',
        liveReferee: {
          ...currentRef,
          updatedAt: nowTime,
          cardsHistory: [newCard, ...(currentRef.cardsHistory || [])],
        },
      };
    });
  };

  const handleRemoveCard = (cardId: string) => {
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        liveReferee: {
          ...currentRef,
          cardsHistory: (currentRef.cardsHistory || []).filter((c) => c.id !== cardId),
        },
      };
    });
  };

  const handleFinishMatch = () => {
    if (score1 === score2) return;
    const winningTeam: 1 | 2 = score1 > score2 ? 1 : 2;
    onConfirmFinalResult(match.id, winningTeam, score1, score2);
    onClose();
  };

  const matchPlayers: { team: 1 | 2; name: string }[] = [
    { team: 1, name: match.team1?.player1 || 'Atleta 1 (Dupla 1)' },
    ...(match.team1?.player2 && match.team1.player2.toLowerCase() !== 'individual (1x1)'
      ? [{ team: 1 as const, name: match.team1.player2 }]
      : []),
    { team: 2, name: match.team2?.player1 || 'Atleta 1 (Dupla 2)' },
    ...(match.team2?.player2 && match.team2.player2.toLowerCase() !== 'individual (1x1)'
      ? [{ team: 2 as const, name: match.team2.player2 }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto">
        {/* Top Bar: Match Identity + Live Broadcast Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                SÚMULA DO ÁRBITRO · TRANSMISSÃO EM TEMPO REAL
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 font-mono font-bold text-xs">
                Jogo #{match.matchNumber} · {match.stageName}
              </span>
              <span className="text-xs text-slate-400">
                {match.courtName || 'Quadra Central'} ({arenaName})
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cada ponto, troca de sacador ou pedido de tempo aparece instantaneamente na tela da tabela para todos os jogadores.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
            title="Fechar Painel do Árbitro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Timeout Alert Banner */}
        {refState.activeTimeout && (
          <div className="p-3.5 rounded-2xl bg-amber-400 text-slate-950 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Timer className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-black text-xs uppercase block">
                  ⏱️ {refState.activeTimeout.label} EM ANDAMENTO (Início: {refState.activeTimeout.startedAt})
                </span>
                <span className="text-[11px] font-bold">
                  Jogo pausado no placar {score1} x {score2}. Todos os atletas na página da tabela estão vendo este aviso.
                </span>
              </div>
            </div>
            <button
              onClick={handleClearActiveTimeout}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-amber-400 font-black text-xs cursor-pointer hover:bg-slate-900"
            >
              Retomar Partida (Fim do Tempo)
            </button>
          </div>
        )}

        {/* Court Swap Every 6 Points Alert */}
        {shouldSwapCourt && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold">
              <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                🔄 TROCA DE LADO DE QUADRA! Soma de pontos atingiu {totalPoints} (múltiplo de 6).
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-300">
              Trocas realizadas: {refState.courtSwapsCount}
            </span>
          </div>
        )}

        {/* GIANT SCOREBOARD + 1-CLICK POINT COMPUTATION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Team 1 Score Card */}
          <div
            className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between gap-4 ${
              refState.servingTeam === 1
                ? 'bg-slate-900 border-amber-400 shadow-lg'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                    DUPLA 1 #{match.team1?.seed || 1}
                  </span>
                  {refState.servingTeam === 1 && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                      🏐 COM O SAQUE
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-white mt-1.5">{team1Label}</h3>
              </div>

              <span className="text-xs font-mono text-slate-400">
                Tempos: {refState.team1TimeoutsUsed}/{refState.maxTimeoutsPerTeam}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 my-1">
              <button aria-label="Diminuir 1 ponto da dupla 1" title="Diminuir 1 ponto da dupla 1"
                type="button"
                onClick={() => handleDecrementPoint(1)}
                className="score-control score-control-subtract aquarium-glass w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="text-6xl font-mono font-black tracking-tighter text-white tabular-nums">
                  {score1}
                </span>
                <span className="block text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                  Pontos (Set até {targetPoints})
                </span>
              </div>

              <button aria-label="Adicionar 1 ponto da dupla 1" title="Adicionar 1 ponto da dupla 1"
                type="button"
                onClick={() => handleScorePoint(1)}
                className="score-control score-control-add px-5 h-16 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-6 h-6 stroke-[3]" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleRequestTimeout('team1')}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                Pedir Tempo ({refState.team1TimeoutsUsed}/{refState.maxTimeoutsPerTeam})
              </button>
            </div>
          </div>

          {/* Team 2 Score Card */}
          <div
            className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between gap-4 ${
              refState.servingTeam === 2
                ? 'bg-slate-900 border-amber-400 shadow-lg'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                    DUPLA 2 #{match.team2?.seed || 2}
                  </span>
                  {refState.servingTeam === 2 && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                      🏐 COM O SAQUE
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-white mt-1.5">{team2Label}</h3>
              </div>

              <span className="text-xs font-mono text-slate-400">
                Tempos: {refState.team2TimeoutsUsed}/{refState.maxTimeoutsPerTeam}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 my-1">
              <button aria-label="Diminuir 1 ponto da dupla 2" title="Diminuir 1 ponto da dupla 2"
                type="button"
                onClick={() => handleDecrementPoint(2)}
                className="score-control score-control-subtract aquarium-glass w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>

              <div className="text-center">
                <span className="text-6xl font-mono font-black tracking-tighter text-white tabular-nums">
                  {score2}
                </span>
                <span className="block text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                  Pontos (Set até {targetPoints})
                </span>
              </div>

              <button aria-label="Adicionar 1 ponto da dupla 2" title="Adicionar 1 ponto da dupla 2"
                type="button"
                onClick={() => handleScorePoint(2)}
                className="score-control score-control-add px-5 h-16 rounded-2xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 text-slate-950 font-black text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-6 h-6 stroke-[3]" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleRequestTimeout('team2')}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Timer className="w-3.5 h-3.5 text-emerald-400" />
                Pedir Tempo ({refState.team2TimeoutsUsed}/{refState.maxTimeoutsPerTeam})
              </button>
            </div>
          </div>
        </div>

        {/* Fundamento do Próximo Ponto (Opcional 1-Clique) */}
        <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Fundamento do Ponto (Opcional antes de clicar em +1):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(SKILL_LABELS) as PointSkillType[]).map((skillKey) => (
              <button
                key={skillKey}
                type="button"
                onClick={() => setSelectedSkill(skillKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  selectedSkill === skillKey
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {SKILL_LABELS[skillKey].badge}
              </button>
            ))}
          </div>
        </div>

        {/* SERVICE ORDER ROTATION (4 SERVERS) & COURT / TIMEOUT CONTROLS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 4-Player Service Order Control */}
          <div className="aquarium-glass lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Ordem Oficial de Saque (Rotação Automática na Virada de Bola)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Sacando agora: <strong className="text-white">{currentServerLabel}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleSelectServerRotation(((refState.serverRotationIndex + 1) % 4) as 0 | 1 | 2 | 3)
                }
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Rodar Sacador
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {refState.serviceOrderLabels.map((label, idx) => {
                const isCurrent = refState.serverRotationIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectServerRotation(idx as 0 | 1 | 2 | 3)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                      isCurrent
                        ? 'bg-amber-400/15 border-amber-400 text-white font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black shrink-0">
                        SACANDO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Match Controls & Live Feed */}
          <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Controles de Quadra & Tempo
              </h4>

              <button
                type="button"
                onClick={() => handleRequestTimeout('technical')}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-sky-300 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Tempo Técnico Oficial
                </span>
                <span className="text-[10px] font-mono">60s</span>
              </button>

              <button
                type="button"
                onClick={handleManualCourtSwap}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-emerald-300 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Registrar Troca de Lado
                </span>
                <span className="text-[10px] font-mono">{refState.courtSwapsCount}x</span>
              </button>

              <button
                type="button"
                onClick={() => onNotify10PointsRemaining(match.id, score1, score2)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-400/30 text-xs font-bold text-amber-300 flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5" />
                  Chamar Próximo Jogo (Push)
                </span>
                <span className="text-[10px] font-mono">Faltam {Math.max(0, targetPoints - Math.max(score1, score2))} pts</span>
              </button>
            </div>

            {/* Recent Point History */}
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Histórico Ao Vivo ({refState.pointHistory.length} lances):
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                {refState.pointHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Nenhum ponto computado ainda.</p>
                ) : (
                  refState.pointHistory.slice(0, 5).map((pt) => (
                    <div
                      key={pt.id}
                      className="text-[11px] flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800/80"
                    >
                      <span className="truncate text-slate-200">
                        <strong>{pt.scoreAfter}</strong> · {pt.scorerName}
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold shrink-0 ml-1">
                        {SKILL_LABELS[pt.skill]?.badge || 'Ponto'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CARTÃO AMARELO / DISCIPLINA OFICIAL PARA JOGADOR */}
        <div className="aquarium-glass bg-slate-900 border border-amber-400/30 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Cartão Amarelo / Advertência Disciplinar para Jogador
              </h4>
              <p className="text-[11px] text-slate-400">
                Clique no jogador abaixo para aplicar Cartão Amarelo (aparece ao vivo na tabela e na transmissão).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold">Motivo:</span>
              <select
                value={cardReason}
                onChange={(e) => setCardReason(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white"
              >
                <option value="Reclamação com arbitragem">Reclamação com arbitragem</option>
                <option value="Retardar início do saque">Retardar início do saque</option>
                <option value="Invasão / Toque acintoso na rede">Invasão / Toque na rede</option>
                <option value="Conduta antidesportiva">Conduta antidesportiva</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {matchPlayers.map((pl, i) => {
              const playerCards = cardsHistory.filter((c) => c.playerName === pl.name);
              return (
                <div
                  key={`${pl.name}-${i}`}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 block">
                      Dupla {pl.team}
                    </span>
                    <span className="text-xs font-black text-white truncate block">
                      {pl.name}
                    </span>
                    {playerCards.length > 0 && (
                      <span className="text-[10px] font-bold text-amber-400 block mt-0.5">
                        🟨 {playerCards.length}x Amarelo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleIssueCard(pl.team, pl.name, 'yellow')}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] cursor-pointer transition-colors"
                      title={`Aplicar Cartão Amarelo para ${pl.name}`}
                    >
                      🟨 Amarelo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIssueCard(pl.team, pl.name, 'red')}
                      className="px-2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] cursor-pointer transition-colors"
                      title={`Aplicar Cartão Vermelho para ${pl.name}`}
                    >
                      🟥
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {cardsHistory.length > 0 && (
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-amber-300">
                Cartões Registrados na Súmula:
              </span>
              {cardsHistory.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-400/40 text-[11px] text-white"
                >
                  <span>{c.cardType === 'yellow' ? '🟨' : '🟥'}</span>
                  <strong>{c.playerName}</strong>
                  <span className="text-slate-400">({c.reason} · {c.scoreAtCard})</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(c.id)}
                    className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer font-bold"
                    title="Remover cartão"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Confirm Final Result & Populate Next Bracket Matches */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Ao confirmar o resultado final, o vencedor e o perdedor são <strong>populados automaticamente</strong> nas próximas fases da chave.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
            >
              Continuar Depois (Manter Ao Vivo)
            </button>

            <button
              type="button"
              disabled={score1 === score2}
              onClick={handleFinishMatch}
              className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${
                score1 !== score2
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 cursor-pointer shadow-md'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              ENCERRAR PARTIDA & AVANÇAR NA CHAVE ({score1} x {score2})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


