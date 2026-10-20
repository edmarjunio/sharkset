import React, { useState, useMemo } from 'react';
import { BracketMatch, PointSkillType, RefereePointEvent, TeamPair } from '../types';
import { BroadcastOverlay } from './BroadcastOverlay';
import { projectBroadcastMatch } from '../services/broadcastMatchProjection';
import { matchScoreboard } from '../services/broadcastScoreboard';
import { usePublishedScoreboard } from '../hooks/usePublishedScoreboard';
import { auth } from '../lib/firebase';
import { buildDefaultRefereeState } from '../services/bracketEngine';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import {
  X,
  Radio,
  MapPin,
  Clock,
  ShieldAlert,
  Trophy,
  MessageSquare,
  Send,
  Plus,
  Minus,
  Check,
  RefreshCw,
  Timer,
  Users,
  Sparkles,
  Award,
  Share2,
  Swords,
  UserCheck,
  Edit3,
  Zap,
} from 'lucide-react';

interface MatchCommentItem {
  id: string;
  author: string;
  roleBadge: string;
  text: string;
  timestamp: string;
}

interface MatchLiveDetailsModalProps {
  match: BracketMatch;
  tournamentName: string;
  arenaName: string;
  isSingles?: boolean;
  onClose: () => void;
  onUpdateLiveMatch: (matchId: string, updater: (prev: BracketMatch) => BracketMatch) => void;
  onConfirmFinalResult: (matchId: string, winningTeam: 1 | 2, score1: number, score2: number) => void;
  onOpenFullRefereeConsole: (matchId: string) => void;
  onOpenMvpAndHistory: (p1?: TeamPair | null, p2?: TeamPair | null, matchId?: string) => void;
  onOpenShareMatch: (match: BracketMatch) => void;
}

const SKILL_BADGES: Record<PointSkillType, { label: string; badge: string; color: string }> = {
  normal: { label: 'Ponto de Rally', badge: '🏐 Rally', color: 'bg-[#0987CE]/20 text-[#5BC3FA] border-[#0987CE]/40' },
  shark_attack: { label: 'Shark Attack', badge: '🦈 Shark Attack', color: 'bg-[#12C7BB]/20 text-[#12C7BB] border-[#12C7BB]/40' },
  ace: { label: 'Ace de Saque', badge: '🎯 Ace', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  pingo: { label: 'Pingo na Areia', badge: '💧 Pingo', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  erro_adv: { label: 'Erro Adversário', badge: '⚠️ Erro Adv.', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
};

const QUICK_REACTIONS = [
  '🦈 Shark Attack monstro!',
  '🔥 Que defesa absurda no fundo!',
  '💧 Pingo cirúrgico na linha de 2m!',
  '🎯 Ace cravado no fundo!',
  '👏 Jogão digno de final!',
];

export const MatchLiveDetailsModal: React.FC<MatchLiveDetailsModalProps> = ({
  match,
  tournamentName,
  arenaName,
  isSingles = false,
  onClose,
  onUpdateLiveMatch,
  onConfirmFinalResult,
  onOpenFullRefereeConsole,
  onOpenMvpAndHistory,
  onOpenShareMatch,
}) => {
  const remoteScore = usePublishedScoreboard(match.linkedBroadcastId || '');
  const broadcastState = remoteScore.broadcast || matchScoreboard(match);
  const remoteOperator = !!remoteScore.broadcast && remoteScore.broadcast.ownerId === auth.currentUser?.uid;
  const refState = match.liveReferee || buildDefaultRefereeState(match);
  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const totalPoints = score1 + score2;
  const targetPoints = refState.targetPoints || 18;
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'in_progress';
  const isReady = !!match.team1 && !!match.team2;

  const [selectedSkill, setSelectedSkill] = useState<PointSkillType>('normal');
  const [editingRefereeName, setEditingRefereeName] = useState<boolean>(false);
  const [refereeNameInput, setRefereeNameInput] = useState<string>(refState.refereeName || 'Árbitro Oficial SHARK SET');

  // Chat state per match (persisted in localStorage so comments stay alive)
  const storageKey = `sharkset_v6_match_chat_${match.id}`;
  const [comments, setComments] = useState<MatchCommentItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [commentInput, setCommentInput] = useState<string>('');
  const [commentAuthor, setCommentAuthor] = useState<string>('Torcedor Shark Set');

  const formatTeamName = (p?: TeamPair) => {
    if (!p) return 'Aguardando definição';
    if (isSingles || p.player2.toLowerCase() === 'individual (1x1)') return p.player1;
    return `${p.player1} & ${p.player2}`;
  };

  const team1Label = formatTeamName(match.team1);
  const team2Label = formatTeamName(match.team2);

  const currentServerLabel =
    refState.serviceOrderLabels[refState.serverRotationIndex] || refState.serviceOrderLabels[0];

  // Aggregate technical stats from pointHistory
  const matchStats = useMemo(() => {
    const history = refState.pointHistory || [];
    return {
      sharkAttacks: history.filter((p) => p.skill === 'shark_attack').length,
      aces: history.filter((p) => p.skill === 'ace').length,
      pingos: history.filter((p) => p.skill === 'pingo').length,
      rallies: history.filter((p) => p.skill === 'normal').length,
      errors: history.filter((p) => p.skill === 'erro_adv').length,
    };
  }, [refState.pointHistory]);

  const handleSaveRefereeName = () => {
    if (!refereeNameInput.trim()) return;
    onUpdateLiveMatch(match.id, (prev) => {
      const curr = prev.liveReferee || buildDefaultRefereeState(prev);
      return {
        ...prev,
        liveReferee: {
          ...curr,
          refereeName: refereeNameInput.trim(),
        },
      };
    });
    setEditingRefereeName(false);
  };

  const handleQuickAddPoint = (scoringTeam: 1 | 2) => {
    if (!isReady) return;
    const nextScore1 = scoringTeam === 1 ? score1 + 1 : score1;
    const nextScore2 = scoringTeam === 2 ? score2 + 1 : score2;
    const nextTotal = nextScore1 + nextScore2;
    const nowTime = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      const wasServingTeam = currentRef.servingTeam;
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
          updatedAt: nowTime,
          pointHistory: [pointEv, ...currentRef.pointHistory].slice(0, 40),
        },
      };
    });
  };

  const handleQuickSubtractPoint = (team: 1 | 2) => {
    if (!isReady) return;
    onUpdateLiveMatch(match.id, (prev) => {
      const currentRef = prev.liveReferee || buildDefaultRefereeState(prev);
      const nextS1 = team === 1 ? Math.max(0, (prev.score1 ?? 0) - 1) : prev.score1 ?? 0;
      const nextS2 = team === 2 ? Math.max(0, (prev.score2 ?? 0) - 1) : prev.score2 ?? 0;
      return {
        ...prev,
        score1: nextS1,
        score2: nextS2,
        liveReferee: {
          ...currentRef,
          updatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      };
    });
  };

  const handlePostComment = (textToSend?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = (textToSend ?? commentInput).trim();
    if (!content) return;

    const newMsg: MatchCommentItem = {
      id: `msg-${Date.now()}`,
      author: commentAuthor.trim() || 'Torcedor Shark Set',
      roleBadge: 'Ao Vivo no Chat',
      text: content,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextList = [newMsg, ...comments];
    setComments(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {
      // ignore
    }
    if (!textToSend) setCommentInput('');
  };

  const [commentAsReferee, setCommentAsReferee] = useState<boolean>(true);

  const handlePostCommentWithRole = (textToSend?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = (textToSend ?? commentInput).trim();
    if (!content) return;

    const isRef = commentAsReferee;
    const authorLabel = isRef
      ? refState.refereeName || 'Árbitro Oficial SHARK SET'
      : commentAuthor.trim() || 'Torcedor Shark Set';

    const newMsg: MatchCommentItem = {
      id: `msg-${Date.now()}`,
      author: authorLabel,
      roleBadge: isRef ? '👑 ÁRBITRO & DONO DA TRANSMISSÃO' : 'Ao Vivo no Chat',
      text: content,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextList = [newMsg, ...comments];
    setComments(nextList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextList));
    } catch {
      // ignore
    }
    if (!textToSend) setCommentInput('');
  };

  const stageThemeLabel =
    match.stage === 'winners'
      ? { badge: 'Chave dos Vencedores (Principal)', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
      : match.stage === 'losers'
      ? { badge: 'Chave dos Perdedores (Repescagem)', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
      : match.stage === 'third_place'
      ? { badge: 'Disputa de 3º Lugar (Bronze)', cls: 'bg-[#12C7BB]/20 text-[#12C7BB] border-[#12C7BB]/40' }
      : match.stage === 'semifinals'
      ? { badge: 'Semifinal (Mata-Mata)', cls: 'bg-[#0987CE]/25 text-[#5BC3FA] border-[#0987CE]/50' }
      : { badge: 'Grande Final do Torneio', cls: 'bg-[#0987CE] text-white border-[#12C7BB]' };

  const currentSpectators = match.spectatorsCount || (isLive ? 186 : 74);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="aquarium-glass bg-[#030B17] text-[#F7FAFD] border-2 border-[#145A9B] rounded-3xl max-w-6xl w-full shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* TOP HEADER: Match Stage, Court, Status, Spectators Count & Quick Actions */}
        <div className="px-4 sm:px-6 py-4 bg-[#071D3D] border-b border-[#145A9B] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-xl bg-[#0987CE] text-white font-black text-xs uppercase">
              JOGO #{match.matchNumber}
            </span>
            <span className={`px-2.5 py-1 rounded-xl border text-xs font-extrabold ${stageThemeLabel.cls}`}>
              {stageThemeLabel.badge}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-600 text-white text-xs font-black uppercase animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                AO VIVO AGORA
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#12C7BB]/20 text-[#12C7BB] border border-[#12C7BB]/40 text-xs font-black uppercase">
                <Check className="w-3.5 h-3.5" />
                PARTIDA ENCERRADA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#030B17] text-slate-300 border border-[#145A9B] text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-[#0987CE]" />
                Programado: {match.scheduledTime || '14:00'}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/20 border border-orange-400/50 text-orange-300 text-xs font-black">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              {currentSpectators} jogadores acompanhando agora
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isReady && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullRefereeConsole(match.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Súmula Completa do Árbitro
              </button>
            )}
            {isReady && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMvpAndHistory(match.team1, match.team2, match.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#12C7BB]/50 text-[#12C7BB] font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Award className="w-3.5 h-3.5" />
                Votar MVP & H2H
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenShareMatch(match)}
              className="p-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-slate-200 cursor-pointer"
              title="Compartilhar partida"
            >
              <Share2 className="w-4 h-4 text-[#0987CE]" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-[#030B17] hover:bg-rose-950/60 border border-[#145A9B] text-slate-300 hover:text-white cursor-pointer"
              title="Fechar Central da Partida"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY: 2-Column Responsive Layout (Left: Live Match, Court, Referee, Service & Point History | Right: Live Chat) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* INFO STRIP: Quadra, Juiz da Partida, Horário, Trocas de Quadra & Torneio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Quadra Rolando */}
            <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0987CE]/20 border border-[#0987CE]/40 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-[#0987CE]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  QUADRA DA PARTIDA
                </span>
                <span className="text-xs sm:text-sm font-black text-white truncate block">
                  {match.courtName || 'Quadra 1 - Central SHARK SET'}
                </span>
                <span className="text-[11px] text-[#12C7BB] font-semibold block">
                  {arenaName} · Horário: {match.scheduledTime || 'Ao Vivo'}
                </span>
              </div>
            </div>

            {/* Quem é o Juiz / Árbitro */}
            <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#12C7BB]/20 border border-[#12C7BB]/40 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 text-[#12C7BB]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    JUIZ / ÁRBITRO OFICIAL
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingRefereeName(!editingRefereeName)}
                    className="text-[10px] text-[#5BC3FA] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    Editar
                  </button>
                </div>
                {editingRefereeName ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={refereeNameInput}
                      onChange={(e) => setRefereeNameInput(e.target.value)}
                      className="w-full px-2 py-1 text-xs bg-[#030B17] border border-[#0987CE] rounded-lg text-white"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRefereeName}
                      className="px-2 py-1 rounded-lg bg-[#0987CE] text-white text-[10px] font-black cursor-pointer"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm font-black text-white truncate block">
                      {refState.refereeName || 'Árbitro Oficial SHARK SET'}
                    </span>
                    <span className="text-[11px] text-slate-300 block">
                      Set até {targetPoints} pts (dif. 2 pts)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quem está Sacando Agora */}
            <div className="aquarium-glass bg-[#071D3D] border border-[#12C7BB]/60 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#12C7BB] text-slate-950 flex items-center justify-center font-black text-sm shrink-0">
                🏐
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#12C7BB] block">
                  QUEM ESTÁ SACANDO AGORA
                </span>
                <span className="text-xs sm:text-sm font-black text-white truncate block">
                  {currentServerLabel}
                </span>
                <span className="text-[11px] text-slate-300 block">
                  Posição {(refState.serverRotationIndex ?? 0) + 1}/4 da rotação
                </span>
              </div>
            </div>

            {/* Trocas de Quadra & Público */}
            <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0987CE]/20 border border-[#0987CE]/40 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-[#5BC3FA]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  TROCAS DE LADO & TEMPOS
                </span>
                <span className="text-xs sm:text-sm font-black text-white block">
                  {refState.courtSwapsCount} trocas (a cada 6 pts)
                </span>
                <span className="text-[11px] text-slate-300 block">
                  Tempos: D1 ({refState.team1TimeoutsUsed}/1) · D2 ({refState.team2TimeoutsUsed}/1)
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT 7 COLUMNS: Scoreboard, Service Rotation, Technical Stats & Point-by-Point History */}
            <div className="lg:col-span-7 space-y-5">
              <BroadcastOverlay key={match.id} state={broadcastState} team1={team1Label} team2={team2Label}
                team1Category={match.team1 ? ATHLETE_LEVEL_LABELS[match.team1.player1Level] : undefined}
                team2Category={match.team2 ? ATHLETE_LEVEL_LABELS[match.team2.player1Level] : undefined}
                disabled={!isReady || isCompleted || (!!match.linkedBroadcastId && !remoteOperator)}
                canUndo={remoteScore.broadcast?.undoAvailable}
                onCommand={remoteOperator ? action => remoteScore.command(action).then(next => onUpdateLiveMatch(match.id, previous => projectBroadcastMatch(previous, next, selectedSkill))) : undefined}
                onChange={remoteOperator ? undefined : patch => onUpdateLiveMatch(match.id, previous => projectBroadcastMatch(previous, { ...matchScoreboard(previous), ...patch }, selectedSkill))} />
              {remoteScore.error && <p role="alert" className="text-sm text-rose-300">{remoteScore.error}</p>}
              <button type="button" onClick={() => onOpenFullRefereeConsole(match.id)} className="watch-control">Abrir súmula e vincular transmissão</button>

              {/* ORDEM DE SAQUE DOS 4 ATLETAS */}
              <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    🏐 Ordem Oficial de Rotação de Saque (4 Atletas)
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Troca automática a cada virada de bola (side-out)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {refState.serviceOrderLabels.map((label, idx) => {
                    const isCurrent = refState.serverRotationIndex === idx;
                    return (
                      <div
                        key={idx}
                        className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between ${
                          isCurrent
                            ? 'bg-[#0987CE]/25 border-[#12C7BB] text-white font-black'
                            : 'bg-[#030B17] border-[#145A9B]/60 text-slate-300'
                        }`}
                      >
                        <span className="truncate">{label}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded bg-[#12C7BB] text-slate-950 text-[10px] font-black shrink-0">
                            SACANDO
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RAIO-X TÉCNICO & HISTÓRICO DE PONTOS */}
              <div className="aquarium-glass bg-[#071D3D] border border-[#145A9B] rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-[#0987CE]" />
                    Histórico Ponto a Ponto & Fundamentos ({refState.pointHistory.length} lances registrados)
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded bg-[#030B17] border border-[#145A9B] text-[#12C7BB]">
                      🦈 Shark Attack: {matchStats.sharkAttacks}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#030B17] border border-[#145A9B] text-emerald-300">
                      🎯 Aces: {matchStats.aces}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#030B17] border border-[#145A9B] text-sky-300">
                      💧 Pingos: {matchStats.pingos}
                    </span>
                  </div>
                </div>

                {refState.pointHistory.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#030B17] border border-[#145A9B]/60 text-center text-xs text-slate-400">
                    Nenhum ponto detalhado registrado ainda nesta partida. Use os botões <strong>+</strong> acima ou abra a Súmula do Árbitro para registrar cada lance em tempo real!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {refState.pointHistory.map((pt) => {
                      const skInfo = SKILL_BADGES[pt.skill] || SKILL_BADGES.normal;
                      return (
                        <div
                          key={pt.id}
                          className="p-2.5 rounded-xl bg-[#030B17] border border-[#145A9B]/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-[#0987CE] text-white font-mono font-black text-[11px] shrink-0">
                              {pt.scoreAfter}
                            </span>
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 ${skInfo.color}`}>
                              {skInfo.badge}
                            </span>
                            <span className="font-bold text-white truncate">
                              Ponto de {pt.scorerName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                            <span>Saque: {pt.serverName?.split(':')[1] || pt.serverName}</span>
                            <span>·</span>
                            <span className="font-mono">{pt.timestamp}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT 5 COLUMNS: Real-Time Match Chat & Spectator Commentary */}
            <div className="aquarium-glass lg:col-span-5 flex flex-col bg-[#071D3D] border border-[#145A9B] rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#145A9B]/60 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#12C7BB]" />
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Chat de Comentários do Jogo Ao Vivo
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Interaja com a torcida e comente os lances do Jogo #{match.matchNumber}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#030B17] border border-[#145A9B] text-[#12C7BB] font-mono text-[11px] font-bold flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {match.spectatorsCount || 48} online
                </span>
              </div>

              {/* Role Toggle: Comment as Referee/Broadcast Owner vs Spectator */}
              <div className="flex items-center gap-1.5 bg-[#030B17] p-1 rounded-xl border border-[#145A9B]">
                <button
                  type="button"
                  onClick={() => setCommentAsReferee(true)}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                    commentAsReferee
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  👑 Comentar como Árbitro / Dono da Live
                </button>
                <button
                  type="button"
                  onClick={() => setCommentAsReferee(false)}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                    !commentAsReferee
                      ? 'bg-[#0987CE] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  👀 Comentar como Torcedor
                </button>
              </div>

              {/* Quick 1-Click Reactions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Reações Rápidas (1-Clique):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REACTIONS.map((reactText) => (
                    <button
                      key={reactText}
                      type="button"
                      onClick={() => handlePostCommentWithRole(reactText)}
                      className="px-2.5 py-1 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-[11px] font-bold text-slate-200 hover:text-white cursor-pointer transition-colors"
                    >
                      {reactText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages Feed with Highlighted Referee / Broadcast Owner Card */}
              <div className="flex-1 space-y-2.5 max-h-[340px] overflow-y-auto pr-1 bg-[#030B17]/80 rounded-2xl p-3 border border-[#145A9B]/60">
                {comments.map((c) => {
                  const isRefOwner =
                    c.roleBadge.includes('ÁRBITRO') || c.roleBadge.includes('Transmissão');
                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-2xl space-y-1 transition-all ${
                        isRefOwner
                          ? 'bg-gradient-to-r from-orange-950/90 via-[#071D3D] to-orange-950/70 border-2 border-orange-400 shadow-md'
                          : 'bg-[#071D3D] border border-[#145A9B]/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-white">{c.author}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isRefOwner
                                ? 'bg-orange-500 text-white'
                                : 'bg-[#030B17] text-[#12C7BB] border border-[#145A9B]'
                            }`}
                          >
                            {c.roleBadge}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">{c.timestamp}</span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed ${
                          isRefOwner ? 'text-orange-100 font-bold' : 'text-slate-200'
                        }`}
                      >
                        {c.text}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Send New Comment Form */}
              <form onSubmit={(e) => handlePostCommentWithRole(undefined, e)} className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  {!commentAsReferee && (
                    <input
                      type="text"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      placeholder="Seu nome..."
                      className="w-1/3 px-3 py-2 text-xs bg-[#030B17] border border-[#145A9B] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0987CE]"
                    />
                  )}
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder={
                      commentAsReferee
                        ? `Comentar em destaque como ${refState.refereeName || 'Árbitro'}...`
                        : 'Comente o lance da partida ao vivo...'
                    }
                    className="flex-1 px-3 py-2 text-xs bg-[#030B17] border border-[#145A9B] rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0987CE]"
                  />
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded-xl text-white font-black text-xs cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      commentAsReferee
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : 'bg-[#0987CE] hover:bg-[#0772b0]'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


