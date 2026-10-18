import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { BroadcastOverlay, elapsedTime, type ScoreboardState } from './BroadcastOverlay';

interface Broadcast extends ScoreboardState {
  id: string; ownerId: string; title: string; team1: string; team2: string;
  videoUrl: string; isLive: boolean; revision: number;
}

export function FreeBroadcastPanel({ arenaId, broadcastId }: { arenaId?: string; broadcastId?: string }) {
  const [id, setId] = useState(broadcastId || '');
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'broadcasts', id), snapshot => {
      setBroadcast(snapshot.exists() ? snapshot.data() as Broadcast : null);
      if (!snapshot.exists()) setError('Transmissão não encontrada.');
    }, () => setError('Não foi possível carregar o placar.'));
  }, [id]);

  async function save(patch?: Partial<Broadcast>) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!auth.currentUser) throw new Error('Entre na sua conta Google para transmitir.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(broadcast ? `/api/broadcasts/${id}` : '/api/broadcasts', {
        method: broadcast ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(broadcast ? { ...patch, revision: broadcast.revision } : { arenaId, title: arenaId ? 'Ao vivo na arena' : 'Minha transmissão' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      if (!broadcast) setId(data.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  const canEdit = !broadcastId && broadcast?.ownerId === auth.currentUser?.uid;
  return <section className="rounded-2xl border border-sky-200 bg-white p-4 space-y-3 text-slate-900">
    <h2 className="font-bold">{arenaId ? 'Transmissão da arena' : 'Transmissão livre'}</h2>
    <p className="text-sm text-slate-600">Sem reserva ou outros jogadores. Não vale pontos no ranking.</p>
    {!id && <button disabled={busy} onClick={() => save()} className="rounded-xl bg-[#0987CE] text-white px-4 py-3 font-bold">Criar transmissão</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {broadcast && <>
      <div className="rounded-xl overflow-hidden bg-[#071D3D]">
        {broadcast.isLive && broadcast.videoUrl ? <video src={broadcast.videoUrl} controls autoPlay muted playsInline className="w-full aspect-video object-contain" /> :
          <p className="text-center text-white p-6">{canEdit ? 'Conecte o vídeo para publicar.' : 'A transmissão ainda não começou.'}</p>}
        <div className="p-3"><BroadcastOverlay state={broadcast} team1={broadcast.team1} team2={broadcast.team2} /></div>
      </div>
      {canEdit && <fieldset disabled={busy} className="space-y-3">
        <BroadcastOverlay state={broadcast} team1={broadcast.team1} team2={broadcast.team2} onChange={save} />
        <label className="block text-sm">Endereço HTTPS do vídeo ao vivo
          <input type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://…" className="w-full p-3 border rounded-xl mt-1" />
        </label>
        <p className="text-xs text-slate-600">Use um endereço de reprodução compatível com seu navegador. A câmera local ainda funciona apenas como prévia.</p>
        <div className="flex gap-3 flex-wrap">
          <button className="bg-[#0987CE] text-white p-3 rounded-xl" disabled={!videoUrl && !broadcast.isLive} onClick={() => save(broadcast.isLive ? { isLive: false, elapsedSeconds: elapsedTime(broadcast), clockStartedAt: null } : { videoUrl, isLive: true })}>{broadcast.isLive ? 'Encerrar transmissão' : 'Publicar vídeo'}</button>
          <a className="text-[#0987CE] p-3 underline" target="_blank" rel="noreferrer" href={`?broadcast=${id}`}>Abrir tela do público</a>
        </div>
      </fieldset>}
    </>}
  </section>;
}
