import React, { useState, useMemo, useEffect } from 'react';
import { TeamPair } from '../types';
import {
  computeHeadToHeadSummary,
  HistoricalMatchRecord,
  INITIAL_HISTORICAL_MATCHES,
} from '../services/matchHistoryEngine';
import { SharksetLogo } from './SharksetLogo';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs, query, limit, setDoc, doc } from 'firebase/firestore';
import {
  X,
  Swords,
  TrendingUp,
  Trophy,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePairs: TeamPair[];
  initialPair1?: TeamPair | null;
  initialPair2?: TeamPair | null;
  tenantName: string;
}

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({
  isOpen,
  onClose,
  availablePairs,
  initialPair1,
  initialPair2,
  tenantName,
}) => {
  const [selectedPair1Id, setSelectedPair1Id] = useState<string>(
    initialPair1?.id || availablePairs[0]?.id || 'pair-1'
  );
  const [selectedPair2Id, setSelectedPair2Id] = useState<string>(
    initialPair2?.id || availablePairs[1]?.id || 'pair-2'
  );

  const [firestoreMatches, setFirestoreMatches] = useState<HistoricalMatchRecord[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState<boolean>(false);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'fallback' | 'synced'>('connected');

  // Update selection if props change when opening
  useEffect(() => {
    if (initialPair1?.id) setSelectedPair1Id(initialPair1.id);
    if (initialPair2?.id) setSelectedPair2Id(initialPair2.id);
  }, [initialPair1, initialPair2]);

  // Pull historical records from Firestore on mount
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadFromFirestore = async () => {
      setIsLoadingFirestore(true);
      const path = 'match_history';
      try {
        const coll = collection(db, path);
        const q = query(coll, limit(50));
        const snap = await getDocs(q);

        if (!snap.empty && isMounted) {
          const list: HistoricalMatchRecord[] = [];
          snap.forEach((d) => {
            list.push(d.data() as HistoricalMatchRecord);
          });
          setFirestoreMatches(list);
          setFirestoreStatus('connected');
        } else if (isMounted) {
          setFirestoreMatches(INITIAL_HISTORICAL_MATCHES);
          setFirestoreStatus('fallback');
        }
      } catch (err) {
        if (isMounted) {
          handleFirestoreError(err, OperationType.LIST, path);
          setFirestoreMatches(INITIAL_HISTORICAL_MATCHES);
          setFirestoreStatus('fallback');
        }
      } finally {
        if (isMounted) setIsLoadingFirestore(false);
      }
    };

    loadFromFirestore();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl shadow-2xl overflow-hidden text-[#F7FAFD]">
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
              <div className="overflow-x-auto rounded-2xl border border-[#145A9B] bg-[#030B17]">
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
                            <div className="text-amber-400">{m.sharkAttacksCount || 0} Sharks</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center bg-[#030B17] rounded-2xl border border-[#145A9B] space-y-2">
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
