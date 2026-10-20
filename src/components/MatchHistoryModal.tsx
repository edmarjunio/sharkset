import React, { useState, useMemo, useEffect } from 'react';
import { MatchMvpVoteRecord, TeamPair } from '../types';
import {
  computeHeadToHeadSummary,
  HistoricalMatchRecord,
  INITIAL_HISTORICAL_MATCHES,
} from '../services/matchHistoryEngine';
import { SharksetLogo } from './SharksetLogo';
import {
  fetchMvpVotesFromFirestore,
  getLocalMvpVotes,
  persistMvpVoteToFirestore,
} from '../lib/firebase';
import {
  X,
  Swords,
  TrendingUp,
  Trophy,
  Sparkles,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Award,
  ThumbsUp,
  Users,
  Calendar,
} from 'lucide-react';

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePairs: TeamPair[];
  initialPair1?: TeamPair | null;
  initialPair2?: TeamPair | null;
  tenantName: string;
  activeMatchId?: string;
  tournamentId?: string;
  tournamentName?: string;
}

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({
  isOpen,
  onClose,
  availablePairs,
  initialPair1,
  initialPair2,
  tenantName,
  activeMatchId,
  tournamentId = 't-futevolei-1',
  tournamentName = 'Copa Shark Set Futevôlei',
}) => {
  const [selectedPair1Id, setSelectedPair1Id] = useState<string>(
    initialPair1?.id || availablePairs[0]?.id || 'pair-1'
  );
  const [selectedPair2Id, setSelectedPair2Id] = useState<string>(
    initialPair2?.id || availablePairs[1]?.id || 'pair-2'
  );

  const [firestoreMatches] = useState<HistoricalMatchRecord[]>(INITIAL_HISTORICAL_MATCHES);
  const [mvpVotes, setMvpVotes] = useState<MatchMvpVoteRecord[]>(() => getLocalMvpVotes());
  const [voterNameInput, setVoterNameInput] = useState<string>('Torcedor Shark Set');
  const [voteFeedback, setVoteFeedback] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'fallback' | 'synced'>('connected');

  // Update selection if props change when opening
  useEffect(() => {
    if (initialPair1?.id) setSelectedPair1Id(initialPair1.id);
    if (initialPair2?.id) setSelectedPair2Id(initialPair2.id);
  }, [initialPair1, initialPair2]);

  // Pull MVP votes from Firestore (/match_mvp_votes) on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadMvpVotes = async () => {
      try {
        const votes = await fetchMvpVotesFromFirestore();
        if (isMounted) {
          setMvpVotes(votes);
          setFirestoreStatus('connected');
        }
      } catch {
        if (isMounted) {
          setMvpVotes(getLocalMvpVotes());
          setFirestoreStatus('fallback');
        }
      }
    };

    loadMvpVotes();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const pair1 = useMemo(
    () => availablePairs.find((p) => p.id === selectedPair1Id) || availablePairs[0],
    [availablePairs, selectedPair1Id]
  );
  const pair2 = useMemo(
    () => availablePairs.find((p) => p.id === selectedPair2Id) || availablePairs[1],
    [availablePairs, selectedPair2Id]
  );

  const pair1Names = pair1 ? `${pair1.player1} & ${pair1.player2}` : 'Dupla A';
  const pair2Names = pair2 ? `${pair2.player1} & ${pair2.player2}` : 'Dupla B';

  const allRecords = firestoreMatches.length > 0 ? firestoreMatches : INITIAL_HISTORICAL_MATCHES;

  const summary = useMemo(() => {
    if (!pair1 || !pair2) return null;
    return computeHeadToHeadSummary(
      pair1.id,
      pair1Names,
      pair2.id,
      pair2Names,
      allRecords
    );
  }, [pair1, pair2, pair1Names, pair2Names, allRecords]);

  // Candidates for MVP voting from the two pairs
  const mvpCandidates = useMemo(() => {
    const list: Array<{ playerName: string; pairNames: string; teamIndex: 1 | 2 }> = [];
    if (pair1) {
      if (pair1.player1) list.push({ playerName: pair1.player1, pairNames: pair1Names, teamIndex: 1 });
      if (pair1.player2 && pair1.player2.toLowerCase() !== 'individual (1x1)') {
        list.push({ playerName: pair1.player2, pairNames: pair1Names, teamIndex: 1 });
      }
    }
    if (pair2) {
      if (pair2.player1) list.push({ playerName: pair2.player1, pairNames: pair2Names, teamIndex: 2 });
      if (pair2.player2 && pair2.player2.toLowerCase() !== 'individual (1x1)') {
        list.push({ playerName: pair2.player2, pairNames: pair2Names, teamIndex: 2 });
      }
    }
    return list;
  }, [pair1, pair2, pair1Names, pair2Names]);

  // Aggregate MVP vote counts
  const mvpLeaderboard = useMemo(() => {
    const counts = new Map<string, { playerName: string; pairNames: string; votes: number; lastVoter?: string }>();
    mvpCandidates.forEach((c) => {
      counts.set(c.playerName, { playerName: c.playerName, pairNames: c.pairNames, votes: 0 });
    });

    mvpVotes.forEach((v) => {
      const existing = counts.get(v.playerName);
      if (existing) {
        existing.votes += 1;
        if (!existing.lastVoter) existing.lastVoter = v.voterName;
      } else {
        counts.set(v.playerName, {
          playerName: v.playerName,
          pairNames: v.pairNames,
          votes: 1,
          lastVoter: v.voterName,
        });
      }
    });

    const sorted = Array.from(counts.values()).sort((a, b) => b.votes - a.votes);
    const totalVotes = sorted.reduce((acc, item) => acc + item.votes, 0);
    return {
      rows: sorted.map((item) => ({
        ...item,
        percentage: totalVotes > 0 ? Math.round((item.votes / totalVotes) * 100) : 0,
      })),
      totalVotes,
      topMvp: sorted[0] && sorted[0].votes > 0 ? sorted[0] : null,
    };
  }, [mvpCandidates, mvpVotes]);

  const handleCastMvpVote = async (playerName: string, pairNames: string) => {
    setIsSubmittingVote(true);
    try {
      const newVote = await persistMvpVoteToFirestore({
        id: `mvp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        matchId: activeMatchId || `${selectedPair1Id}_vs_${selectedPair2Id}`,
        tournamentId,
        tournamentName,
        playerName,
        pairNames,
        voterName: voterNameInput.trim() || 'Atleta SHARK SET',
      });
      setMvpVotes((prev) => [newVote, ...prev]);
      setFirestoreStatus('synced');
      setVoteFeedback(`Voto confirmado para ${playerName} como Craque/MVP da Partida! Gravado no Firestore.`);
      setTimeout(() => setVoteFeedback(null), 4500);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="aquarium-glass relative w-full max-w-2xl my-auto max-h-[calc(100dvh-2rem)] sm:max-h-[92vh] flex flex-col bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl shadow-2xl overflow-hidden text-[#F7FAFD]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#0A2E63] p-5 border-b border-[#145A9B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <SharksetLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#0987CE]/20 text-[#0987CE] text-[10px] font-black uppercase tracking-wider">
                  HISTÓRICO DE CONFRONTOS · H2H
                </span>
                <span className="text-[10px] font-mono text-[#12C7BB] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {firestoreStatus === 'connected' ? 'Firestore Live' : 'Base Integrada'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight mt-0.5">
                Head-to-Head & Tendência de Desempenho
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#030B17] hover:bg-[#0987CE] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Pair Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#030B17]/70 p-3.5 rounded-2xl border border-[#145A9B]">
            <div>
              <label className="text-[11px] font-black uppercase text-[#0987CE] block mb-1">
                Dupla 1
              </label>
              <select
                value={selectedPair1Id}
                onChange={(e) => setSelectedPair1Id(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-[#071D3D] border border-[#145A9B] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#0987CE]"
              >
                {availablePairs.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === selectedPair2Id}>
                    {p.player1} & {p.player2} ({p.category.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-[#12C7BB] block mb-1">
                Dupla 2 (Adversária)
              </label>
              <select
                value={selectedPair2Id}
                onChange={(e) => setSelectedPair2Id(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-[#071D3D] border border-[#145A9B] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#12C7BB]"
              >
                {availablePairs.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === selectedPair1Id}>
                    {p.player1} & {p.player2} ({p.category.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Big H2H Scoreboard */}
          {summary && (
            <div className="bg-gradient-to-br from-[#0B254E] via-[#071D3D] to-[#030B17] border-2 border-[#145A9B] rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-[#145A9B]/60 pb-3">
                <span className="font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-[#0987CE]" />
                  Retrospecto Histórico Direto
                </span>
                <span className="font-mono text-[11px] text-[#12C7BB] font-bold">
                  {summary.totalMatches} partida(s) disputada(s)
                </span>
              </div>

              {/* Head to Head Numbers */}
              <div className="flex items-center justify-between gap-3 text-center">
                {/* Dupla 1 */}
                <div className="flex-1 space-y-1">
                  <p className="text-xs sm:text-sm font-black text-white truncate">{pair1Names}</p>
                  <div className="text-4xl sm:text-5xl font-black font-mono text-[#0987CE]">
                    {summary.pair1Wins}
                  </div>
                  <span className="text-[11px] font-bold text-slate-300">
                    {summary.pair1WinRate}% de vitórias
                  </span>
                  <div className="flex items-center justify-center gap-1 pt-1">
                    {summary.recentFormPair1.map((res, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
                          res === 'W'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {res}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="px-3 shrink-0 flex flex-col items-center">
                  <span className="text-xs font-black text-slate-400">VITÓRIAS</span>
                  <span className="text-2xl font-black text-[#0987CE] my-1">VS</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {summary.pointDifferential > 0
                      ? `+${summary.pointDifferential} pts`
                      : `${summary.pointDifferential} pts`}
                  </span>
                </div>

                {/* Dupla 2 */}
                <div className="flex-1 space-y-1">
                  <p className="text-xs sm:text-sm font-black text-white truncate">{pair2Names}</p>
                  <div className="text-4xl sm:text-5xl font-black font-mono text-[#12C7BB]">
                    {summary.pair2Wins}
                  </div>
                  <span className="text-[11px] font-bold text-slate-300">
                    {summary.pair2WinRate}% de vitórias
                  </span>
                  <div className="flex items-center justify-center gap-1 pt-1">
                    {summary.recentFormPair2.map((res, i) => (
                      <span
                        key={i}
                        className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
                          res === 'W'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {res}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progress Dominance Bar */}
              <div className="space-y-1 pt-1">
                <div className="h-2.5 w-full bg-[#030B17] rounded-full overflow-hidden flex border border-[#145A9B]">
                  <div
                    style={{ width: `${summary.pair1WinRate}%` }}
                    className="bg-[#0987CE] transition-all duration-700"
                  />
                  <div
                    style={{ width: `${summary.pair2WinRate}%` }}
                    className="bg-[#12C7BB] transition-all duration-700"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>{summary.pair1TotalPoints} pontos marcados</span>
                  <span>{summary.pair2TotalPoints} pontos marcados</span>
                </div>
              </div>
            </div>
          )}

          {/* Performance Trends Section */}
          {summary && summary.performanceTrends.length > 0 && (
            <div className="bg-[#030B17]/80 border border-[#145A9B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <h3 className="font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#0987CE]" />
                  Tendência de Performance nos Últimos Confrontos
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Saldo de Pontos / Margem</span>
              </div>

              <div className="space-y-2">
                {summary.performanceTrends.map((t, idx) => {
                  const p1Won = t.margin > 0;
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#071D3D] border border-[#145A9B]/60 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-black text-white block truncate">{t.tournament}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {t.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-black text-sm">
                          <strong className={p1Won ? 'text-[#0987CE]' : 'text-slate-300'}>
                            {t.pair1Score}
                          </strong>
                          <span className="text-slate-500 mx-1">x</span>
                          <strong className={!p1Won ? 'text-[#12C7BB]' : 'text-slate-300'}>
                            {t.pair2Score}
                          </strong>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            p1Won
                              ? 'bg-[#0987CE]/20 text-[#0987CE]'
                              : 'bg-[#12C7BB]/20 text-[#12C7BB]'
                          }`}
                        >
                          {p1Won ? `+${t.margin} pts Dupla 1` : `+${Math.abs(t.margin)} pts Dupla 2`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historical Encounters Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#0987CE]" />
              Súmula de Partidas Anteriores
            </h3>

            {summary && summary.history.length > 0 ? (
              <div className="aquarium-glass overflow-x-auto rounded-2xl border border-[#145A9B] bg-[#030B17]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#145A9B] text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Data · Torneio</th>
                      <th className="py-2.5 px-3">Fase & Quadra</th>
                      <th className="py-2.5 px-3 text-center">Placar</th>
                      <th className="py-2.5 px-3">Vencedor</th>
                      <th className="py-2.5 px-3 text-right">Estatísticas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#145A9B]/40 font-medium">
                    {summary.history.map((m) => {
                      const isP1Winner = m.winnerId === summary.pair1Id;
                      return (
                        <tr key={m.id} className="hover:bg-[#071D3D]/60 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-bold text-white block">{m.tournamentName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{m.date}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-slate-200 block font-semibold">{m.stage}</span>
                            <span className="text-[10px] text-slate-400">{m.courtName}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black text-sm">
                            <span className={isP1Winner ? 'text-[#0987CE]' : 'text-slate-300'}>
                              {m.score1}
                            </span>
                            <span className="text-slate-500 mx-1">x</span>
                            <span className={!isP1Winner ? 'text-[#12C7BB]' : 'text-slate-300'}>
                              {m.score2}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                isP1Winner
                                  ? 'bg-[#0987CE]/20 text-[#0987CE]'
                                  : 'bg-[#12C7BB]/20 text-[#12C7BB]'
                              }`}
                            >
                              {isP1Winner ? summary.pair1Names : summary.pair2Names}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-400">
                            <div>{m.durationMinutes} min</div>
                            <div className="text-[#12C7BB]">{m.sharkAttacksCount || 0} Sharks</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="aquarium-glass p-6 text-center bg-[#030B17] rounded-2xl border border-[#145A9B] space-y-2">
                <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">
                  Nenhum confronto histórico registrado ainda entre essas duas duplas.
                </p>
                <p className="text-[11px] text-slate-400">
                  Quando a partida na chave terminar, o resultado será automaticamente gravado no Firestore e computado no retrospecto!
                </p>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* ELEIÇÃO & RANKING DE MVP (CRAQUE DA PARTIDA - FIRESTORE)         */}
          {/* ================================================================= */}
          <div className="bg-gradient-to-br from-[#030B17] via-[#071D3D] to-[#0B254E] border-2 border-[#0987CE] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#145A9B]/70 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-[#0987CE] text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    VOTAÇÃO MVP · FIRESTORE
                  </span>
                  <span className="text-[10px] font-mono text-[#12C7BB]">
                    {mvpLeaderboard.totalVotes} votos computados
                  </span>
                </div>
                <h3 className="text-sm font-black text-white">
                  Eleja o Craque da Partida (MVP SHARKSET 🦈)
                </h3>
              </div>

              {mvpLeaderboard.topMvp && (
                <div className="px-3 py-1.5 rounded-xl bg-[#0987CE]/20 border border-[#0987CE] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#12C7BB] shrink-0" />
                  <div className="text-left">
                    <span className="text-[9px] font-black uppercase text-[#12C7BB] block leading-none">
                      MVP ATUAL DA PARTIDA
                    </span>
                    <span className="text-xs font-black text-white">
                      {mvpLeaderboard.topMvp.playerName} ({mvpLeaderboard.topMvp.votes}v)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {voteFeedback && (
              <div className="p-3 rounded-xl bg-[#12C7BB]/20 border border-[#12C7BB] text-xs font-bold text-[#F7FAFD] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#12C7BB] shrink-0" />
                <span>{voteFeedback}</span>
              </div>
            )}

            {/* Voter name input */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <label className="text-slate-300 font-bold shrink-0 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#0987CE]" />
                Seu Nome de Torcedor/Atleta:
              </label>
              <input
                type="text"
                value={voterNameInput}
                onChange={(e) => setVoterNameInput(e.target.value)}
                placeholder="Ex: Torcedor Shark"
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#030B17] border border-[#145A9B] text-white font-semibold text-xs focus:outline-none focus:border-[#0987CE]"
              />
            </div>

            {/* Candidate voting cards & progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {mvpLeaderboard.rows.slice(0, 6).map((row, idx) => {
                const isLeader = idx === 0 && row.votes > 0;
                return (
                  <div
                    key={row.playerName}
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                      isLeader
                        ? 'bg-[#0B254E] border-[#0987CE] shadow-md shadow-[#0987CE]/15'
                        : 'bg-[#030B17]/90 border-[#145A9B]/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-xs">
                            {isLeader ? '👑 ' : ''}{row.playerName}
                          </span>
                          {isLeader && (
                            <span className="px-1.5 py-0.5 rounded bg-[#12C7BB] text-slate-950 font-black text-[9px] uppercase">
                              MVP
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                          {row.pairNames}
                        </span>
                      </div>

                      <button
                        disabled={isSubmittingVote}
                        onClick={() => handleCastMvpVote(row.playerName, row.pairNames)}
                        className="px-2.5 py-1 rounded-lg bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-[10px] flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-xs"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Votar MVP
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-300 font-bold">{row.votes} voto(s)</span>
                        <span className="text-[#12C7BB] font-black">{row.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#071D3D] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0987CE] to-[#12C7BB] transition-all duration-500"
                          style={{ width: `${Math.max(4, row.percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent MVP Votes Log */}
            {mvpVotes.length > 0 && (
              <div className="pt-2 border-t border-[#145A9B]/50 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                <span className="font-bold text-slate-300">Últimos votos no Firestore:</span>
                {mvpVotes.slice(0, 4).map((v) => (
                  <span
                    key={v.id}
                    className="px-2 py-0.5 rounded-md bg-[#030B17] border border-[#145A9B]/60 text-slate-200"
                  >
                    <strong>{v.voterName}</strong> → <span className="text-[#12C7BB] font-bold">{v.playerName}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#030B17] border-t border-[#145A9B] flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {tenantName} · Circuito Integrado
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs transition-colors cursor-pointer shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
