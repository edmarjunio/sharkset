import { DropdownUI } from './DropdownUI';
import React, { useState } from 'react';
import type { BracketMatch, MatchSet, TeamPair } from '../types';
import { allowSemifinalException, changeMatchRules, correctionImpact, declareWalkover, editMatchDetails, editRegisteredTeam, officializeMatch, resetBracketMatch } from '../services/bracketOperations';
import { matchRules } from '../services/tournamentRules';

export function TournamentOperationsPanel({ matches, teams, onApply, focusedMatchId }: {
  matches: BracketMatch[]; teams: TeamPair[]; focusedMatchId?: string; onApply: (matches: BracketMatch[], teams?: TeamPair[]) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  React.useEffect(() => { if (focusedMatchId) setSelectedId(focusedMatchId); }, [focusedMatchId]);
  const match = matches.find(item => item.id === selectedId) || matches[0];
  if (!match) return null;
  return <MatchOperations key={`${match.id}:${match.revision || 0}`} match={match} matches={matches} teams={teams}
    onSelect={setSelectedId} onApply={onApply} />;
}

function MatchOperations({ match, matches, teams, onSelect, onApply }: {
  match: BracketMatch; matches: BracketMatch[]; teams: TeamPair[];
  onSelect: (id: string) => void; onApply: (matches: BracketMatch[], teams?: TeamPair[]) => void;
}) {
  const [sets, setSets] = useState<MatchSet[]>(match.sets || [{ score1: 0, score2: 0 }]);
  const [rules, setRules] = useState(matchRules(match));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ matches: BracketMatch[]; teams?: TeamPair[]; base: string; reason: string } | null>(null);
  const [team1, setTeam1] = useState(match.team1?.id || '');
  const [team2, setTeam2] = useState(match.team2?.id || '');
  const [court, setCourt] = useState(match.courtName || '');
  const [time, setTime] = useState(match.scheduledTime || '');
  const [editingTeam, setEditingTeam] = useState(teams[0]);
  const effectiveReason = reason.trim() || 'Registro oficial pela mesa organizadora';
  const context = { reason: effectiveReason, actor: 'Responsável da tabela' };
  function prepare(operation: () => BracketMatch[], updatedTeams?: TeamPair[], directApply = false) {
    setError('');
    try {
      const nextMatches = operation();
      if (directApply) {
        onApply(nextMatches, updatedTeams);
        setPending(null);
        return;
      }
      setPending({ matches: nextMatches, teams: updatedTeams, base: JSON.stringify(matches), reason: effectiveReason });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha ao preparar a alteração.'); }
  }
  const impact = pending ? correctionImpact(matches, pending.matches) : [];
  return <details className="aquarium-glass rounded-2xl border p-4 space-y-4">
    <summary className="font-bold cursor-pointer">⚙️ Administrar tabela avançada · placares por set, W.O., duplas e correções</summary>
    <p className="text-sm">Você pode editar jogos iniciados ou encerrados. Confira o impacto antes de aplicar ou salve diretamente: resultados que perderem seus participantes serão reabertos, com histórico preservado.</p>
    <label className="block">Jogo<DropdownUI className="block w-full p-3 rounded-xl" value={match.id} onChange={event => onSelect(event.target.value)}>
      {matches.map(item => <option key={item.id} value={item.id}>#{item.matchNumber} · {item.stageName} · {item.team1?.player1 || 'A definir'} × {item.team2?.player1 || 'A definir'}</option>)}
    </DropdownUI></label>
    <label className="block">Motivo (opcional para placares normais; obrigatório para W.O. e exceção de semifinal)<input className="block w-full p-3 rounded-xl" value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: resultado informado pelo árbitro / correção de placar" /></label>
    {error && <p role="alert" className="text-rose-200">{error}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <section className="space-y-3"><h3 className="font-bold">Placar por set</h3>
        {sets.map((set, index) => <div key={index} className="flex gap-2 items-center"><span>Set {index + 1}</span>{(['score1', 'score2'] as const).map(key =>
          <input key={key} aria-label={`Set ${index + 1}, dupla ${key === 'score1' ? 1 : 2}`} type="number" min={0} className="w-20 p-2 rounded-lg" value={set[key]} onChange={event => setSets(sets.map((value, i) => i === index ? { ...value, [key]: Number(event.target.value) } : value))} />)}
        </div>)}
        <div className="flex gap-3 flex-wrap">
          <button className="px-3 py-2" disabled={sets.length >= rules.bestOf} onClick={() => setSets([...sets, { score1: 0, score2: 0 }])}>Adicionar set</button>
          <button className="px-3 py-2" disabled={sets.length <= 1} onClick={() => setSets(sets.slice(0, -1))}>Retirar último set</button>
          <button className="px-3 py-2 bg-[#FF6B00] text-white font-bold rounded-lg" onClick={() => prepare(() => officializeMatch(matches, match.id, sets, context), undefined, true)}>✓ Salvar resultado agora</button>
          <button className="px-3 py-2 bg-sky-600 rounded-lg" onClick={() => prepare(() => officializeMatch(matches, match.id, sets, context))}>Conferir impacto</button>
          <button className="px-3 py-2" onClick={() => prepare(() => resetBracketMatch(matches, match.id, context))}>Reabrir jogo</button>
          {([1, 2] as const).map(winner => <button key={winner} className="px-3 py-2" onClick={() => prepare(() => declareWalkover(matches, match.id, winner, reason || 'W.O. confirmado pela organização', context))}>W.O. para dupla {winner}</button>)}
        </div>
        <details><summary>Regras deste jogo</summary><div className="flex flex-wrap gap-2 mt-2">
          <label>Melhor de<DropdownUI value={rules.bestOf} onChange={event => setRules({ ...rules, bestOf: Number(event.target.value) as 1 | 3 | 5 })}>{[1, 3, 5].map(n => <option key={n}>{n}</option>)}</DropdownUI></label>
          {(['targetPoints', 'decidingPoints', 'winBy'] as const).map((key, i) => <label key={key}>{['Pontos por set', 'Set decisivo', 'Vantagem'][i]}<input className="w-16 p-2" type="number" min={1} max={99} value={rules[key]} onChange={event => setRules({ ...rules, [key]: Number(event.target.value) })} /></label>)}
          <button className="px-3 py-2" onClick={() => prepare(() => changeMatchRules(matches, match.id, rules, context))}>Conferir novas regras</button>
        </div></details>
      </section>
      <section className="space-y-3"><h3 className="font-bold">Participantes, quadra e horário</h3>
        <p className="text-xs">Trocar uma dupla troca sua posição na chave, recalculando os caminhos afetados.</p>
        {[{ value: team1, set: setTeam1 }, { value: team2, set: setTeam2 }].map((field, i) => <label key={i} className="block">Dupla {i + 1}<DropdownUI className="w-full p-2" value={field.value} onChange={event => field.set(event.target.value)}><option value="">A definir</option>{teams.map(team => <option key={team.id} value={team.id}>{team.player1} & {team.player2}</option>)}</DropdownUI></label>)}
        <label>Quadra<input className="w-full p-2" value={court} onChange={event => setCourt(event.target.value)} /></label>
        <label>Horário<input className="w-full p-2" value={time} onChange={event => setTime(event.target.value)} /></label>
        <button className="px-3 py-2" onClick={() => prepare(() => editMatchDetails(matches, match.id, { team1: teams.find(team => team.id === team1), team2: teams.find(team => team.id === team2), courtName: court, scheduledTime: time }, context))}>Conferir alteração</button>
      </section>
    </div>
    {matches.some(item => item.semifinalDecision === 'blocked') && <div className="p-3 border border-amber-400 rounded-xl"><p>Os dois cruzamentos possíveis repetem confrontos anteriores. O responsável pode autorizar uma exceção justificada.</p><button className="px-3 py-2" onClick={() => prepare(() => allowSemifinalException(matches, match.tournamentId, reason, context))}>Conferir autorização de revanche</button></div>}
    {editingTeam && <details><summary>Editar nomes de uma dupla</summary><DropdownUI value={editingTeam.id} onChange={event => setEditingTeam(teams.find(team => team.id === event.target.value)!)}>{teams.map(team => <option key={team.id} value={team.id}>{team.player1} & {team.player2}</option>)}</DropdownUI>
      {(['player1', 'player2'] as const).map(key => <input key={key} aria-label={key === 'player1' ? 'Nome do atleta 1' : 'Nome do atleta 2'} className="p-2 m-2" value={editingTeam[key]} onChange={event => setEditingTeam({ ...editingTeam, [key]: event.target.value })} />)}
      <button className="p-2" onClick={() => prepare(() => { if (!editingTeam.player1.trim() || !editingTeam.player2.trim()) throw new Error('Informe os dois nomes.'); return editRegisteredTeam(matches, editingTeam, context); }, teams.map(team => team.id === editingTeam.id ? editingTeam : team))}>Conferir nomes</button>
    </details>}
    {pending && <section role="status" className="border border-cyan-300 p-4 rounded-xl space-y-3"><h3 className="font-bold">Confira antes de aplicar</h3><p>{impact.length ? `Jogos com participantes alterados ou resultados reabertos: ${impact.map(item => `#${item.matchNumber}`).join(', ')}.` : 'Nenhum outro jogo terá participantes alterados ou resultado reaberto.'}</p>
      <p>Motivo: {pending.reason}</p><button className="px-4 py-2 bg-sky-600" onClick={() => {
        try {
          if (pending.base !== JSON.stringify(matches)) throw new Error('A tabela mudou após a prévia. Confira a alteração novamente.');
          onApply(pending.matches, pending.teams); setPending(null);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.'); }
      }}>Aplicar alteração</button> <button className="px-4 py-2" onClick={() => setPending(null)}>Cancelar</button>
    </section>}
    <details><summary>Histórico deste jogo ({match.audit?.length || 0})</summary>{match.audit?.map(event => <p key={event.id} className="py-2 text-sm">{new Date(event.at).toLocaleString('pt-BR')} · {event.actor} · {event.reason} · {event.affectedMatchIds.length} jogo(s) afetado(s)</p>)}</details>
  </details>;
}
