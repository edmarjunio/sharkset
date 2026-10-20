import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { BracketMatch, PointSkillType, RefereeCardEvent, RefereePointEvent, RefereeTimeoutEvent } from '../types';
import { BroadcastOverlay } from './BroadcastOverlay';
import { projectBroadcastMatch } from '../services/broadcastMatchProjection';
import { matchScoreboard, scoreboardRules, scoreboardWinner, type ScoreboardState } from '../services/broadcastScoreboard';
import { usePublishedScoreboard } from '../hooks/usePublishedScoreboard';
import type { MatchRules, MatchSet } from '../types';
import { buildDefaultRefereeState } from '../services/bracketEngine';
import { buildServiceOrder, pairAthletes, teamAtServiceIndex } from '../services/serviceOrder';
import { auth, db } from '../lib/firebase';
import {
  BellRing,
  Check,
  Clock,
  Link2,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  ShieldAlert,
  Timer,
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
  onConfirmFinalResult: (matchId: string, winningTeam: 1 | 2, score1: number, score2: number, sets?: MatchSet[], rules?: MatchRules) => void;
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
  const remoteScore = usePublishedScoreboard(match.linkedBroadcastId || '');
  const board = remoteScore.broadcast || matchScoreboard(match);
  const finalWinner = scoreboardWinner(board);

  const refState = match.liveReferee || buildDefaultRefereeState(match);
  const cardsHistory = refState.cardsHistory || [];
  const score1 = board.score1;
  const score2 = board.score2;
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

  // Official Service Setup helpers
  const athletes1 = pairAthletes(match.team1, 'Dupla 1');
  const athletes2 = pairAthletes(match.team2, 'Dupla 2');
  const currentOpener1: 0 | 1 = refState.firstServers?.team1 ?? 0;
  const currentOpener2: 0 | 1 = refState.firstServers?.team2 ?? 0;
  const currentStartingTeam: 1 | 2 = refState.serviceOrderTeams?.[0] ?? refState.servingTeam ?? 1;

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


  const handleSelectBroadcast = async (broadcastId: string) => {
    if (!broadcastId) { onUpdateLiveMatch(match.id, previous => ({ ...previous, linkedBroadcastId: undefined })); return; }
    const broadcast = availableBroadcasts.find(item => item.id === broadcastId);
    if (!broadcast || broadcast.ownerId !== ownerUid) { setSyncNotice('Somente o dono da transmissão pode vincular e operar o placar.'); return; }
    if (tournamentMatches.some(item => item.id !== match.id && item.linkedBroadcastId === broadcastId && item.status !== 'completed')) { setSyncNotice('Esta transmissão está vinculada a outro jogo em andamento.'); return; }
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/broadcasts/' + broadcastId, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ revision: broadcast.revision || 0, team1: team1Label.slice(0,80), team2: team2Label.slice(0,80), stage: match.stage, stageName: match.stageName, matchId: match.id, ...scoreboardRules(matchScoreboard(match)) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível vincular a transmissão.');
      onUpdateLiveMatch(match.id, previous => ({ ...previous, linkedBroadcastId: broadcastId }));
      setSyncNotice('Transmissão vinculada. O placar publicado é a fonte de verdade; pontos locais não foram copiados.');
    } catch (failure) { setSyncNotice(failure instanceof Error ? failure.message : 'Não foi possível vincular.'); }
  };
  const applyLocalBoard = (next: ScoreboardState) => {
    onUpdateLiveMatch(match.id, previous => projectBroadcastMatch(previous, next, selectedSkill));
  };

  const handleConfigureService = (firstTeam: 1 | 2, op1: 0 | 1, op2: 0 | 1) => {
    const order = buildServiceOrder(match, firstTeam, { team1: op1, team2: op2 });
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      const nextServing = teamAtServiceIndex(order, currentRef.serverRotationIndex);
      return {
        ...prev,
        liveReferee: {
          ...currentRef,
          ...order,
          servingTeam: nextServing,
          updatedAt: nowTime,
        },
      };
    });
  };

  const handleSelectServerRotation = (idx: 0 | 1 | 2 | 3) => {
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      const nextServingTeam = teamAtServiceIndex(currentRef, idx);
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
    if (!finalWinner) return;
    const sets = (board.setHistory || []).map(([score1, score2]) => ({ score1, score2 }));
    onConfirmFinalResult(match.id, finalWinner, score1, score2, sets, scoreboardRules(board));
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 overflow-y-auto py-4 sm:py-6">
      <div className="aquarium-glass bg-slate-950 text-white border border-slate-800 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Top Bar: Match Identity + Live Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                SÚMULA DO ÁRBITRO · AO VIVO
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 font-mono font-bold text-xs">
                Jogo #{match.matchNumber} · {match.stageName}
              </span>
              <span className="text-xs text-slate-400">
                {match.courtName || 'Quadra Central'} ({arenaName})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer"
            title="Fechar Painel do Árbitro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            GIANT SCOREBOARD: FIXED POSITION SO BUTTONS NEVER MOVE UNDER ARBITRATION
            Placed at top of the modal body so dynamic alerts below do not push it.
           ========================================================================= */}
        <BroadcastOverlay key={match.id} state={board} team1={team1Label} team2={team2Label}
          disabled={match.status === 'completed' || !match.team1 || !match.team2 || (!!match.linkedBroadcastId && (!canDriveLinkedScore || !remoteScore.broadcast))}
          canUndo={remoteScore.broadcast?.undoAvailable}
          onCommand={match.linkedBroadcastId && canDriveLinkedScore ? action => remoteScore.command(action).then(next => applyLocalBoard(next)) : undefined}
          onChange={match.linkedBroadcastId ? undefined : patch => applyLocalBoard({ ...matchScoreboard(match), ...patch })} />
        {remoteScore.error && <p role="alert" className="text-sm text-rose-300">{remoteScore.error}</p>}
        <div className="grid grid-cols-2 gap-3">{(['team1','team2'] as const).map((team, index) => <button key={team} type="button" onClick={() => handleRequestTimeout(team)} className="watch-control"><Timer size={16} />Tempo Dupla {index === 0 ? 'A' : 'B'}</button>)}</div>

        {/* =========================================================================
            STATUS & ALERT RIBBON (Below Scoreboard so it never pushes score buttons)
           ========================================================================= */}
        {refState.activeTimeout ? (
          <div className="p-3.5 rounded-2xl bg-amber-400 text-slate-950 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Timer className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-black text-xs uppercase block">
                  ⏱️ {refState.activeTimeout.label} EM ANDAMENTO (Início: {refState.activeTimeout.startedAt})
                </span>
                <span className="text-[11px] font-bold">
                  Jogo pausado no placar {score1} x {score2}. Notificado ao vivo na tabela.
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
        ) : shouldSwapCourt ? (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 flex items-center justify-between gap-2 text-xs animate-in fade-in">
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
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Partida em andamento · Soma: <strong className="text-white">{totalPoints}</strong> pts · Próxima troca de lado aos <strong className="text-white">{(Math.floor(totalPoints / 6) + 1) * 6}</strong> pts
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Sacando agora: <strong className="text-amber-300">{currentServerLabel}</strong>
            </span>
          </div>
        )}

        {/* Sync Notice Alert Banner if any */}
        {syncNotice && (
          <div className="p-2.5 rounded-xl bg-sky-950 border border-sky-400/50 text-sky-200 text-xs flex items-center gap-2 animate-in fade-in">
            <Radio className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
            <span>{syncNotice}</span>
          </div>
        )}

        {/* Fundamento do Próximo Ponto */}
        <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
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

        {/* =========================================================================
            TRANSMISSÃO OFICIAL DA PARTIDA (VINCULAR PLACAR À TRANSMISSÃO AO VIVO)
           ========================================================================= */}
        <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-sky-400" />
                Vincular Placar à Transmissão Oficial da Partida
              </h4>
              <p className="text-[11px] text-slate-400">
                Se o torneio tiver transmissões oficiais, selecione abaixo qual delas transmitirá este jogo. O placar sincroniza a cada ponto.
              </p>
            </div>


          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <select
                aria-label="Vincular transmissão oficial da partida"
                value={match.linkedBroadcastId || ''}
                onChange={(e) => handleSelectBroadcast(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-hidden focus:border-sky-400"
              >
                <option value="">Nenhuma transmissão vinculada (Apenas Súmula Local / Tabela)</option>
                {availableBroadcasts.map((b) => {
                  const matchUsing = tournamentMatches.find(
                    (m) => m.id !== match.id && m.linkedBroadcastId === b.id
                  );
                  return (
                    <option key={b.id} value={b.id}>
                      {b.title} {b.isLive ? '🔴 AO VIVO' : '⚪ Standby'}
                      {matchUsing ? ` (Em uso no Jogo #${matchUsing.matchNumber})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {linkedBroadcast && (
              <div className="px-3 py-1.5 rounded-xl bg-sky-950/80 border border-sky-400/40 text-xs flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-sky-200">
                  Conectado à <strong>{linkedBroadcast.title}</strong>
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                    linkedBroadcast.isLive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {linkedBroadcast.isLive ? 'No Ar' : 'Standby'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            IDENTIFICAÇÃO DO SAQUE & ORDEM OFICIAL DOS 4 SACADORES
           ========================================================================= */}
        <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>🏐</span> Identificação do Saque Inicial & Ordem Oficial (4 Sacadores)
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Marque quem começou sacando de cada dupla. A ordem oficial de 4 sacadores é calculada e rotaciona automaticamente a cada virada de bola.
            </p>
          </div>

          {/* Interactive Opener Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80">
            {/* Step 1: Who won coin toss and serves first */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                1. Quem Começou Sacando a Partida?
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleConfigureService(1, currentOpener1, currentOpener2)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                    currentStartingTeam === 1
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Dupla 1
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigureService(2, currentOpener1, currentOpener2)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                    currentStartingTeam === 2
                      ? 'bg-emerald-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  Dupla 2
                </button>
              </div>
            </div>

            {/* Step 2: Opener for Team 1 */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                2. Primeiro Sacador (Dupla 1):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleConfigureService(currentStartingTeam, 0, currentOpener2)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                    currentOpener1 === 0
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                  title={athletes1[0]}
                >
                  {athletes1[0]}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigureService(currentStartingTeam, 1, currentOpener2)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                    currentOpener1 === 1
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                  title={athletes1[1]}
                >
                  {athletes1[1]}
                </button>
              </div>
            </div>

            {/* Step 3: Opener for Team 2 */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                3. Primeiro Sacador (Dupla 2):
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleConfigureService(currentStartingTeam, currentOpener1, 0)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                    currentOpener2 === 0
                      ? 'bg-emerald-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                  title={athletes2[0]}
                >
                  {athletes2[0]}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigureService(currentStartingTeam, currentOpener1, 1)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all truncate ${
                    currentOpener2 === 1
                      ? 'bg-emerald-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                  title={athletes2[1]}
                >
                  {athletes2[1]}
                </button>
              </div>
            </div>
          </div>

          {/* 4-Player Calculated Service Sequence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300">
                Ordem da Rotação (Clique em qualquer atleta se precisar corrigir manualmente):
              </span>
              <button
                type="button"
                onClick={() =>
                  handleSelectServerRotation(((refState.serverRotationIndex + 1) % 4) as 0 | 1 | 2 | 3)
                }
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Avançar Sacador (+1)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {refState.serviceOrderLabels.map((label, idx) => {
                const isCurrent = refState.serverRotationIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectServerRotation(idx as 0 | 1 | 2 | 3)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                      isCurrent
                        ? 'bg-amber-400/20 border-amber-400 text-white font-black shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black shrink-0 ml-1">
                        SACANDO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* =========================================================================
            CONTROLES DE QUADRA & HISTÓRICO DE PONTOS
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Controles Oficiais de Quadra
            </h4>

            <div className="space-y-2">
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
                  Registrar Troca de Lado de Quadra
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
                  Chamar Próximo Jogo (Push Notification)
                </span>
                <span className="text-[10px] font-mono">Faltam {Math.max(0, targetPoints - Math.max(score1, score2))} pts</span>
              </button>
            </div>
          </div>

          <div className="aquarium-glass bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Histórico Recente de Pontos ({refState.pointHistory.length} lances)
            </h4>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {refState.pointHistory.length === 0 ? (
                <p className="text-[11px] text-slate-500 py-3 text-center">Nenhum ponto computado ainda.</p>
              ) : (
                refState.pointHistory.slice(0, 6).map((pt) => (
                  <div
                    key={pt.id}
                    className="text-[11px] flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800/80"
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

        {/* =========================================================================
            CARTÕES DISCIPLINARES (AMARELO / VERMELHO)
           ========================================================================= */}
        <div className="aquarium-glass bg-slate-900 border border-amber-400/30 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Cartão Amarelo / Advertência Disciplinar para Jogador
              </h4>
              <p className="text-[11px] text-slate-400">
                Selecione o motivo e clique no cartão para registrar na súmula oficial.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold">Motivo:</span>
              <select
                aria-label="Motivo da advertência disciplinar"
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
                      className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] cursor-pointer transition-colors"
                      title={`Aplicar Cartão Amarelo para ${pl.name}`}
                    >
                      🟨
                    </button>
                    <button
                      type="button"
                      onClick={() => handleIssueCard(pl.team, pl.name, 'red')}
                      className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] cursor-pointer transition-colors"
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
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Ao confirmar o resultado final, os vencedores e perdedores avançam <strong>automaticamente</strong> na chave oficial.
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
              disabled={!finalWinner || remoteScore.pending > 0}
              onClick={handleFinishMatch}
              className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${
                finalWinner
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
