import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Minus, Pause, Play, Plus, RotateCcw, Undo2 } from 'lucide-react';
import { SharksetLogo } from './SharksetLogo';
import { applyScoreboardCommand, currentSetTarget, currentSetWinner, elapsedTime, isSemiOrFinalStage, restoreScoreSnapshot, scoreboardRules, scoreboardWinner, type ScoreboardCommand, type ScoreboardState } from '../services/broadcastScoreboard';
export { elapsedTime, isSemiOrFinalStage } from '../services/broadcastScoreboard';
export type { ScoreboardState } from '../services/broadcastScoreboard';

export interface BroadcastOverlayProps {
  state: ScoreboardState;
  team1?: string; team2?: string;
  team1Category?: string; team2Category?: string;
  team1Avatar?: string; team2Avatar?: string;
  stageName?: string;
  compact?: boolean;
  controlsOnly?: boolean;
  disabled?: boolean;
  canUndo?: boolean;
  onChange?: (patch: Partial<ScoreboardState>) => unknown;
  onCommand?: (command: ScoreboardCommand) => unknown;
}
function Team({ name, category, avatar, side }: { name: string; category?: string; avatar?: string; side: 'a' | 'b' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatar]);
  return <div className={`broadcast-wing broadcast-wing-${side}`}>
    <span className="broadcast-avatar">{avatar && !failed ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : side.toUpperCase()}</span>
    <div className="broadcast-team"><strong title={name}>{name}</strong><small>{category || `DUPLA ${side.toUpperCase()}`}</small></div>
  </div>;
}

export function BroadcastOverlay(props: BroadcastOverlayProps) {
  const { state, team1 = 'Dupla A', team2 = 'Dupla B', compact, controlsOnly } = props;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (state.clockStartedAt == null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [state.clockStartedAt, state.elapsedSeconds]);
  const seconds = elapsedTime(state, now);
  const duration = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const rules = scoreboardRules({ ...state, stageName: props.stageName || state.stageName });
  const needed = Math.ceil(rules.bestOf / 2), winner = scoreboardWinner({ ...state, bestOf: rules.bestOf });
  const history = state.setHistory || [];
  return <div className="broadcast-package">
    {!controlsOnly && <section className="broadcast-scoreboard" aria-label="Placar oficial da transmissão SHARKSET">
      <div className="broadcast-crown"><SharksetLogo size="xs" showText /><span className="broadcast-clock"><Clock3 size={12} />{duration}</span><span className="broadcast-stage" title={props.stageName || state.stageName || 'Jogo Livre'}>{props.stageName || state.stageName || 'Jogo Livre'}</span></div>
      <div className="broadcast-strip">
        <Team name={team1} category={props.team1Category} avatar={props.team1Avatar} side="a" />
        <div className="broadcast-points"><small>{winner ? 'ENCERRADO' : rules.bestOf > 1 ? `SET ${history.length + 1}` : 'SET ÚNICO'}</small><div className="broadcast-digits" aria-label={`Pontos ${state.score1} a ${state.score2}`}><b>{state.score1}</b><span>:</span><b>{state.score2}</b></div></div>
        <Team name={team2} category={props.team2Category} avatar={props.team2Avatar} side="b" />
      </div>
      <div className="broadcast-ribbon"><span className="broadcast-set-dots" aria-label={`Sets da dupla A: ${state.sets1 || 0}`}>{Array.from({ length: needed }, (_, i) => <i key={i} className={i < (state.sets1 || 0) ? 'won' : ''} />)}</span><strong>SETS {state.sets1 || 0} — {state.sets2 || 0}</strong><span className="broadcast-set-dots" aria-label={`Sets da dupla B: ${state.sets2 || 0}`}>{Array.from({ length: needed }, (_, i) => <i key={i} className={i < (state.sets2 || 0) ? 'won' : ''} />)}</span><span className="broadcast-format">{rules.bestOf === 1 ? '1 SET' : `MD${rules.bestOf}`}</span></div>
      {history.length > 0 && <div className="broadcast-partials" aria-label="Parciais dos sets">{history.map(([a, b], i) => <span key={i}><small>{i + 1}º</small> {a}–{b}</span>)}</div>}
      {winner && <div className="broadcast-victory"><Check size={12} />Vitória · {winner === 1 ? team1 : team2}</div>}
    </section>}
    {!compact && (props.onChange || props.onCommand) && <BroadcastControls {...props} team1={team1} team2={team2} />}
  </div>;
}

function BroadcastControls({ state, team1, team2, stageName, onChange, onCommand, disabled, canUndo }: BroadcastOverlayProps) {
  const stateRef = useRef(state), undo = useRef<ScoreboardState[]>([]), inFlight = useRef(false);
  const consoleRef = useRef<HTMLElement>(null);
  stateRef.current = { ...state, stageName: stageName || state.stageName };
  const [error, setError] = useState(''), [autoClose, setAutoClose] = useState(false), [saving, setSaving] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const commandRef = useRef<(command: ScoreboardCommand) => void>(() => {});
  const ended = !!scoreboardWinner(stateRef.current), ready = !!currentSetWinner(stateRef.current);
  const locked = disabled || (!onCommand && saving);
  const hasUndo = onCommand ? canUndo ?? undoCount > 0 : undoCount > 0;
  const rules = scoreboardRules(stateRef.current);
  const started = !!(state.score1 || state.score2 || state.setHistory?.length);
  function send(command: ScoreboardCommand) {
    if (disabled || (!onCommand && inFlight.current)) return;
    setError('');
    const previous = stateRef.current;
    try {
      if (onCommand) {
        const result = onCommand(command);
        if (command.type === 'point' || command.type === 'close_set') setUndoCount(count => count + 1);
        if (command.type === 'undo') setUndoCount(count => Math.max(0, count - 1));
        Promise.resolve(result).catch(failure => setError(failure instanceof Error ? failure.message : 'Falha ao salvar. Confira o placar.'));
        return;
      }
      const next = command.type === 'undo' ? (undo.current.at(-1) ? restoreScoreSnapshot(previous, undo.current.at(-1)!) : undefined) : applyScoreboardCommand(previous, command);
      if (!next) return;
      const result = onChange?.(next);
      stateRef.current = next;
      const complete = () => {
        if (command.type === 'undo') undo.current.pop();
        else if (command.type === 'point' || command.type === 'close_set') undo.current = [...undo.current.slice(-99), previous];
        setUndoCount(undo.current.length);
      };
      if (result instanceof Promise) {
        inFlight.current = true; setSaving(true);
        result.then(complete).catch(failure => { stateRef.current = previous; setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.'); }).finally(() => { inFlight.current = false; setSaving(false); });
      } else complete();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Comando inválido.'); }
  }
  commandRef.current = send;
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const activeDialog = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
      const focusedConsole = target?.closest('.broadcast-console');
      const firstVisibleConsole = [...document.querySelectorAll<HTMLElement>('.broadcast-console')].find(element => element.getClientRects().length && !element.closest('[inert]') && (!activeDialog || activeDialog.contains(element)));
      if ((activeDialog && !activeDialog.contains(consoleRef.current)) || (focusedConsole ? focusedConsole !== consoleRef.current : firstVisibleConsole !== consoleRef.current) ||
        event.repeat || event.altKey || event.ctrlKey || event.metaKey || target?.closest('input, textarea, select, a, [contenteditable="true"], [role="textbox"]') || target?.closest('[inert]') ||
        (event.code === 'Space' && target?.closest('button'))) return;
      const key = event.key.toLowerCase();
      const action: ScoreboardCommand | null = key === 'a' || key === 'arrowleft' ? { type: 'point', team: 1, delta: 1, autoClose } : key === 'l' || key === 'arrowright' ? { type: 'point', team: 2, delta: 1, autoClose } : key === 'z' ? { type: 'undo' } : event.code === 'Space' ? { type: 'clock_toggle' } : null;
      if (action) { event.preventDefault(); commandRef.current(action); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [autoClose]);
  return <section ref={consoleRef} className="broadcast-console" aria-label="Painel de controle do operador do placar">
    <header><div><span className="broadcast-console-eyebrow">MESA DE TRANSMISSÃO</span><h3>Você comanda o jogo.</h3></div><span className="broadcast-console-status">{ended ? 'Partida encerrada' : `Set ${1 + (state.setHistory?.length || 0)} · até ${currentSetTarget(state)} · vantagem ${rules.winBy}`}</span></header>
    <div className="broadcast-touch-grid">{([1, 2] as const).map(team => <div className={`broadcast-touch-side side-${team}`} key={team}><div><strong>DUPLA {team === 1 ? 'A' : 'B'}</strong><span title={team === 1 ? team1 : team2}>{team === 1 ? team1 : team2}</span></div><button type="button" className="broadcast-add" aria-label={`+1 Ponto Dupla ${team === 1 ? 'A' : 'B'}`} disabled={locked || ended || ready} onClick={() => send({ type: 'point', team, delta: 1, autoClose })}><Plus size={25} /><b>1</b><span>PONTO</span><kbd>{team === 1 ? 'A / ←' : 'L / →'}</kbd></button><button type="button" className="broadcast-subtract" disabled={locked || ended || (team === 1 ? state.score1 : state.score2) === 0} onClick={() => send({ type: 'point', team, delta: -1 })}><Minus size={16} />Tirar 1 ponto</button></div>)}</div>
    <div className="broadcast-command-grid"><button type="button" disabled={locked || !hasUndo} onClick={() => send({ type: 'undo' })}><Undo2 size={18} /><span>Desfazer última ação<small>Z · inclusive fechamento do set</small></span></button><button type="button" className="broadcast-close-set" disabled={locked || !ready || ended} onClick={() => send({ type: 'close_set' })}><Check size={18} /><span>Fechar Set Atual<small>{ready ? 'Parcial válida · confirmar' : 'Aguardando alvo e vantagem'}</small></span></button><button type="button" disabled={locked || ended} onClick={() => send({ type: 'clock_toggle' })}>{state.clockStartedAt != null ? <Pause size={18} /> : <Play size={18} />}<span>{state.clockStartedAt != null ? 'Pausar tempo' : 'Iniciar tempo'}<small>Espaço · play / pause</small></span></button><button type="button" disabled={locked} onClick={() => send({ type: 'clock_reset' })}><RotateCcw size={18} /><span>Zerar tempo<small>Relógio em 00:00</small></span></button></div>
    <div className="broadcast-options"><div role="group" aria-label="Formato da partida">{([1, 3] as const).map(bestOf => <button type="button" key={bestOf} aria-pressed={rules.bestOf === bestOf} disabled={locked || started || (bestOf === 1 && isSemiOrFinalStage(state.stage || stageName || state.stageName))} onClick={() => send({ type: 'format', bestOf })}>{bestOf === 1 ? '1 Set' : 'Melhor de 3'}</button>)}</div><label><input type="checkbox" checked={autoClose} disabled={locked} onChange={event => setAutoClose(event.target.checked)} />Fechar set automaticamente</label></div>
    <p className="broadcast-console-note">{isSemiOrFinalStage(state.stage || stageName || state.stageName) ? 'Semifinal / final: MD3 automático · 18 / 18 / 15.' : 'Defina o formato antes do primeiro ponto.'} Fechar set não oficializa o resultado do torneio.</p>
    {error && <p role="alert" className="broadcast-console-error">{error}</p>}
  </section>;
}
