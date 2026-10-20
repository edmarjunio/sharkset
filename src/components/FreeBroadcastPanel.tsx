import { useBroadcastNavigation } from '../store/useBroadcastNavigation';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, signInWithGooglePopup } from '../lib/firebase';
import { AccessLockedAction } from './AccessLockedAction';
import { BroadcastOverlay, elapsedTime, type ScoreboardState } from './BroadcastOverlay';
import { isYouTubeUrl, getYouTubeEmbedUrl } from '../utils/videoUtils';

const ArenaLivePublisher = lazy(() => import('./ArenaLivePublisher').then(module => ({ default: module.ArenaLivePublisher })));

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
  const externalPanel = <section className="aquarium-glass rounded-2xl border border-sky-200 bg-white p-4 space-y-3 text-slate-900">
    <h2 className="font-bold">{arenaId ? 'Transmissão da arena' : 'Transmissão livre'}</h2>
    <p className="text-sm text-slate-600">Sem reserva ou outros jogadores. Não vale pontos no ranking.</p>
    {!id && (!auth.currentUser ? <AccessLockedAction
      message="Entre na sua conta para criar uma transmissão"
      onClick={() => void signInWithGooglePopup().then(() => save()).catch(() => setError('Não foi possível entrar. Tente novamente.'))}
      className="rounded-xl"
      previewClassName="rounded-xl bg-[#0987CE] px-4 py-3 font-bold text-white"
    >Criar transmissão</AccessLockedAction> : <button disabled={busy} onClick={() => save()} className="rounded-xl bg-[#0987CE] text-white px-4 py-3 font-bold">Criar transmissão</button>)}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {broadcast && <>
      <div className="relative rounded-2xl overflow-hidden bg-[#071D3D] aspect-video flex items-center justify-center border-2 border-slate-900 shadow-xl">
        {broadcast.isLive && broadcast.videoUrl ? (
          isYouTubeUrl(broadcast.videoUrl) ? (
            <iframe
              src={getYouTubeEmbedUrl(broadcast.videoUrl, { autoplay: true, muted: true }) || ''}
              className="w-full h-full border-0 object-contain"
              allow="autoplay; encrypted-media"
              title="Prévia do vídeo"
            />
          ) : (
            <video src={broadcast.videoUrl} controls autoPlay muted playsInline className="w-full h-full object-contain" />
          )
        ) : (
          <p className="text-center text-white p-6">{canEdit ? 'Conecte o vídeo para publicar.' : 'A transmissão ainda não começou.'}</p>
        )}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl z-20 pointer-events-none">
          <BroadcastOverlay state={broadcast} team1={broadcast.team1} team2={broadcast.team2} compact />
        </div>
      </div>
      <button onClick={() => useBroadcastNavigation.getState().open({ kind: 'published', id })} className="rounded-xl bg-cyan-700 text-white px-4 py-2 font-bold">Assistir / tela cheia</button>
      {canEdit && <fieldset disabled={busy} className="space-y-3">
        <BroadcastOverlay state={broadcast} team1={broadcast.team1} team2={broadcast.team2} onChange={save} />
        <label className="block text-sm font-semibold">Endereço do vídeo ou Live (YouTube ou HTTPS direto)
          <input type="url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=... ou https://..." className="w-full p-3 border rounded-xl mt-1 text-slate-800" />
        </label>
        <p className="text-xs text-slate-600">Suporta transmissões ao vivo do YouTube (ex: mega torneios, Mikasa, Team Águia) ou stream HTTPS. O placar e a tabela ficarão sincronizados sobre o vídeo!</p>
        <div className="flex gap-3 flex-wrap">
          <button className="bg-[#0987CE] text-white p-3 rounded-xl font-bold" disabled={!videoUrl && !broadcast.isLive} onClick={() => save(broadcast.isLive ? { isLive: false, elapsedSeconds: elapsedTime(broadcast), clockStartedAt: null } : { videoUrl, isLive: true })}>{broadcast.isLive ? 'Encerrar transmissão' : 'Publicar vídeo'}</button>
          <a className="text-[#0987CE] p-3 underline font-medium" target="_blank" rel="noreferrer" href={`?broadcast=${id}`}>Abrir tela do público</a>
        </div>
      </fieldset>}
    </>}
  </section>;
  return <>
    {arenaId && !broadcastId && <Suspense fallback={<p role="status" className="p-4 text-slate-300">Preparando transmissão…</p>}><ArenaLivePublisher key={arenaId} arenaId={arenaId} /></Suspense>}
    {arenaId && !broadcastId ? <details className="aquarium-glass rounded-2xl border border-slate-700 p-4"><summary className="cursor-pointer text-sm font-bold text-cyan-200">Vídeo externo (YouTube ou URL)</summary><div className="mt-3">{externalPanel}</div></details> : externalPanel}
  </>;
}
