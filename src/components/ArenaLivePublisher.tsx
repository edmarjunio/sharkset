import { useEffect, useRef, useState } from 'react';
import { createLocalTracks, Room, RoomEvent, Track, type LocalTrack } from 'livekit-client';
import { onAuthStateChanged } from 'firebase/auth';
import { Radio, Square, LogIn } from 'lucide-react';
import { auth, signInWithGooglePopup } from '../lib/firebase';
import { livekitRequest, publicLivekitUrl } from '../services/livekitApi';
import { useBroadcastNavigation } from '../store/useBroadcastNavigation';

interface Ticket { id: string; sessionId: string; token: string }
export function ArenaLivePublisher({ arenaId }: { arenaId: string }) {
  const [user, setUser] = useState(auth.currentUser);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'reconnecting' | 'ending'>('idle');
  const [error, setError] = useState('');
  const [broadcastId, setBroadcastId] = useState('');
  const preview = useRef<HTMLVideoElement>(null);
  const room = useRef<Room | null>(null);
  const tracks = useRef<LocalTrack[]>([]);
  const session = useRef<string | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const operation = useRef(0);
  const mounted = useRef(true);
  const busy = useRef(false);
  const configured = import.meta.env.VITE_LIVEKIT_ENABLED === 'true';
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  function releaseMedia() {
    if (heartbeat.current) clearInterval(heartbeat.current);
    heartbeat.current = null;
    for (const track of tracks.current) { track.detach(); track.stop(); }
    tracks.current = [];
    const previous = room.current; room.current = null;
    previous?.removeAllListeners(); void previous?.disconnect(true).catch(() => {});
  }
  async function stop() {
    operation.current++; releaseMedia();
    if (mounted.current) setState('ending');
    const id = session.current;
    try {
      if (id) await livekitRequest('stop', { sessionId: id });
      session.current = null;
      if (mounted.current) setError('');
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Repita o encerramento.'); }
    finally { if (mounted.current) setState('idle'); }
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void stop(); };
  }, [arenaId]);
  // Recover management of an earlier session after reload; camera is never enabled automatically.
  useEffect(() => {
    if (!user || !configured) return;
    let cancelled = false;
    const version = operation.current;
    void livekitRequest<{ sessionId?: string }>('status', { arenaId }).then(data => {
      if (!cancelled && version === operation.current && data.sessionId && !room.current) { session.current = data.sessionId; setError('Existe uma sessão anterior. Encerre-a antes de iniciar outra.'); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid, arenaId, configured]);

  async function start() {
    if (busy.current || state !== 'idle' || session.current) return;
    busy.current = true; const version = ++operation.current;
    setState('starting'); setError('');
    try {
      const url = publicLivekitUrl();
      const ticket = await livekitRequest<Ticket>('start', { arenaId });
      session.current = ticket.sessionId; setBroadcastId(ticket.id);
      if (!mounted.current || version !== operation.current) { await stop(); return; }
      const connection = new Room({ adaptiveStream: true, dynacast: true, publishDefaults: { simulcast: true, videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 24 } } });
      room.current = connection;
      connection.on(RoomEvent.Reconnecting, () => { if (mounted.current) setState('reconnecting'); });
      connection.on(RoomEvent.Reconnected, () => {
        void livekitRequest('confirm', { sessionId: ticket.sessionId }).then(() => { if (mounted.current && version === operation.current) setState('live'); }).catch(() => { void stop(); });
      });
      connection.on(RoomEvent.Disconnected, () => { if (mounted.current) setError('Conexão encerrada. Inicie novamente quando a rede estiver disponível.'); void stop(); });
      await connection.connect(url, ticket.token, { autoSubscribe: false });
      if (!mounted.current || version !== operation.current) { await stop(); return; }
      const media = await createLocalTracks({ audio: true, video: { facingMode: 'environment', resolution: { width: 1280, height: 720, frameRate: 24 } } });
      tracks.current = media;
      if (!mounted.current || version !== operation.current) { await stop(); return; }
      const camera = media.find(track => track.kind === Track.Kind.Video);
      if (camera && preview.current) camera.attach(preview.current);
      await Promise.all(media.map(track => connection.localParticipant.publishTrack(track)));
      await livekitRequest('confirm', { sessionId: ticket.sessionId });
      if (!mounted.current || version !== operation.current) { await stop(); return; }
      setState('live');
      let checking = false;
      heartbeat.current = setInterval(() => {
        if (checking || !session.current) return; checking = true;
        void livekitRequest('confirm', { sessionId: ticket.sessionId }).catch(async () => {
          await stop(); if (mounted.current) setError('A conexão com a câmera não pôde ser confirmada. A transmissão foi suspensa.');
        }).finally(() => { checking = false; });
      }, 20_000);
    } catch (failure) {
      await stop();
      if (mounted.current) setError(failure instanceof Error && /permi|denied|NotAllowed/i.test(failure.message) ? 'Permita câmera e microfone no navegador para transmitir.' : 'Não foi possível iniciar. Confira seu acesso de gestor, a configuração e as permissões de câmera/microfone.');
    } finally { busy.current = false; }
  }
  const active = state !== 'idle';
  return <section className="rounded-2xl border border-slate-700 bg-[#071D3D] p-4 text-white space-y-3" aria-label="Transmissão pela câmera da arena">
    <h3 className="font-bold">Transmissão da arena</h3>
    <p className="text-sm text-slate-300">Transmita pela câmera deste dispositivo. A live aparece no site após a confirmação da publicação.</p>
    <video ref={preview} autoPlay muted playsInline hidden={!active} className="w-full aspect-video object-contain rounded-xl bg-black" />
    <div className="flex flex-wrap items-center gap-2">
      {!user ? <button className="site-secondary-action aquarium-glass" onClick={() => void signInWithGooglePopup().catch(() => setError('Não foi possível entrar. Tente novamente.'))}><LogIn size={16} />Entrar para transmitir</button> : <button disabled={!configured || active || !!session.current} onClick={() => void start()} className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50 inline-flex items-center gap-2"><Radio size={16} />{state === 'starting' ? 'Conectando câmera…' : 'Iniciar transmissão'}</button>}
      {(active || session.current) && <button disabled={state === 'ending'} onClick={() => void stop()} className="site-secondary-action aquarium-glass"><Square size={16} />{state === 'ending' ? 'Encerrando…' : 'Encerrar transmissão'}</button>}
      {state === 'live' && broadcastId && <button className="site-secondary-action aquarium-glass" onClick={() => useBroadcastNavigation.getState().open({ kind: 'published', id: broadcastId })}>Abrir tela do público</button>}
      {state === 'live' && <span role="status" className="text-sm text-emerald-300">Ao vivo · câmera confirmada</span>}
      {state === 'reconnecting' && <span role="status" className="text-sm text-amber-300">Reconectando…</span>}
    </div>
    {!configured && <p className="text-xs text-slate-400">Transmissão por câmera em configuração. Será liberada após a homologação do backend.</p>}
    {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
  </section>;
}
