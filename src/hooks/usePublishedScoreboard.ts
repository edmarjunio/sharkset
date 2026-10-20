import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { applyScoreboardCommand, type ScoreboardCommand, type ScoreboardState } from '../services/broadcastScoreboard';

export interface PublishedBroadcast extends ScoreboardState {
  id: string; ownerId: string; title: string; team1: string; team2: string;
  videoUrl: string; isLive: boolean; revision: number; undoAvailable?: boolean;
}
interface QueuedCommand { command: ScoreboardCommand; operationId: string; resolve: (state: ScoreboardState) => void; reject: (error: Error) => void }

/** Every tap is queued. Revisions protect other operators; retries reuse the same event id. */
export function usePublishedScoreboard(id: string) {
  const [broadcast, setBroadcast] = useState<PublishedBroadcast | null>(null);
  const [error, setError] = useState(''), [pending, setPending] = useState(0);
  const confirmed = useRef<PublishedBroadcast | null>(null), observed = useRef<PublishedBroadcast | null>(null);
  const queue = useRef<QueuedCommand[]>([]), processing = useRef(false), generation = useRef(0);
  function preview() {
    let result = confirmed.current;
    if (result) for (const entry of queue.current) {
      if (entry.command.type === 'undo') break;
      try { result = { ...result, ...applyScoreboardCommand(result, entry.command), undoAvailable: entry.command.type === 'point' || entry.command.type === 'close_set' ? true : result.undoAvailable }; } catch { break; }
    }
    setBroadcast(result); setPending(queue.current.length);
  }
  useEffect(() => {
    const current = ++generation.current;
    confirmed.current = observed.current = null; queue.current = []; processing.current = false;
    setBroadcast(null); setPending(0); setError('');
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'broadcasts', id), snapshot => {
      if (current !== generation.current) return;
      if (!snapshot.exists()) { setError('Transmissão não encontrada.'); return; }
      const record = { ...snapshot.data(), id, revision: snapshot.data().revision || 0 } as PublishedBroadcast;
      observed.current = record;
      if (!processing.current && record.revision >= (confirmed.current?.revision ?? -1)) { confirmed.current = record; preview(); }
    }, () => setError('Não foi possível carregar o placar.'));
    return () => { generation.current++; unsubscribe(); const failure = new Error('A operação foi interrompida. Confira o placar ao voltar.'); queue.current.splice(0).forEach(entry => entry.reject(failure)); };
  }, [id]);

  async function drain(current: number) {
    if (processing.current) return;
    processing.current = true;
    while (queue.current.length && current === generation.current) {
      const entry = queue.current[0];
      try {
        const user = auth.currentUser;
        if (!user || user.uid !== confirmed.current?.ownerId) throw new Error('Entre com a conta responsável pela transmissão.');
        const token = await user.getIdToken();
        const body = JSON.stringify({ command: entry.command, operationId: entry.operationId, revision: confirmed.current.revision });
        const request = () => fetch(`/api/broadcasts/${id}/scoreboard`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body });
        let response: Response;
        try { response = await request(); } catch { response = await request(); }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o placar.');
        if (current !== generation.current) return;
        confirmed.current = { ...confirmed.current!, ...data.scoreboard, revision: data.revision, undoAvailable: data.undoAvailable };
        queue.current.shift(); entry.resolve(data.scoreboard); preview();
      } catch (failure) {
        if (current !== generation.current) return;
        const problem = failure instanceof Error ? failure : new Error('Sem conexão. Confira os pontos antes de continuar.');
        if (observed.current && observed.current.revision > (confirmed.current?.revision ?? -1)) confirmed.current = observed.current;
        queue.current.splice(0).forEach(item => item.reject(problem));
        setError(problem.message); preview(); break;
      }
    }
    if (current === generation.current) { processing.current = false; if (observed.current && observed.current.revision > (confirmed.current?.revision ?? -1)) { confirmed.current = observed.current; preview(); } }
  }
  function command(action: ScoreboardCommand): Promise<ScoreboardState> {
    if (!confirmed.current) return Promise.reject(new Error('Aguarde o carregamento do placar.'));
    setError('');
    return new Promise((resolve, reject) => {
      queue.current.push({ command: action, operationId: crypto.randomUUID(), resolve, reject });
      preview(); void drain(generation.current);
    });
  }
  return { broadcast, error, pending, command };
}
