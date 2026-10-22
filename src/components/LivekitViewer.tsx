import { recordMetric } from '../services/performanceMetrics';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGooglePopup } from '../lib/firebase';
import { livekitRequest, publicLivekitUrl } from '../services/livekitApi';
import { AccessLockedAction } from './AccessLockedAction';

export function LivekitViewer({ arenaId, muted }: { arenaId: string; muted: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const connection = useRef<Room | null>(null);
  const [user, setUser] = useState(auth.currentUser);
  const [status, setStatus] = useState('Conectando à transmissão…');
  const [needsAudio, setNeedsAudio] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    let closed = false;
    const startedAt = performance.now();
    const room = new Room({ adaptiveStream: true });
    connection.current = room;
    if (!user) { setStatus('Entre na sua conta para assistir.'); return () => { closed = true; connection.current = null; }; }
    const detach = (track: RemoteTrack) => { track.detach(); };
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (participant.identity !== publisherIdentity) return;
      if (publication.source === Track.Source.Camera && video.current) { track.attach(video.current); recordMetric('livekit-track-attached-ms', performance.now() - startedAt); setStatus(''); }
      if (publication.source === Track.Source.Microphone && audio.current) track.attach(audio.current);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => { detach(track); if (track.kind === Track.Kind.Video) setStatus('Aguardando a câmera…'); });
    room.on(RoomEvent.Reconnecting, () => setStatus('Reconectando…'));
    room.on(RoomEvent.Reconnected, () => setStatus(''));
    room.on(RoomEvent.Disconnected, () => { if (!closed) setStatus('A transmissão foi encerrada ou a conexão caiu. Volte à listagem para tentar novamente.'); });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!room.canPlaybackAudio));
    let publisherIdentity = '';
    void (async () => {
      try {
        const url = publicLivekitUrl();
        const ticket = await livekitRequest<{ token: string; publisherIdentity: string }>('viewer', { arenaId });
        if (closed) return;
        publisherIdentity = ticket.publisherIdentity;
        await room.connect(url, ticket.token);
        if (closed) await room.disconnect().catch(() => {});
      } catch { if (!closed) setStatus('Não foi possível conectar. Confira se a transmissão ainda está ao vivo.'); }
    })();
    return () => { closed = true; room.remoteParticipants.forEach(participant => participant.trackPublications.forEach(publication => publication.track?.detach())); room.removeAllListeners(); void room.disconnect().catch(() => {}); connection.current = null; };
  }, [arenaId, user?.uid]);
  useEffect(() => { if (audio.current) audio.current.muted = muted; }, [muted]);
  return <div className="w-full h-full relative">
    <video ref={video} autoPlay playsInline muted className="watch-media" />
    <audio ref={audio} autoPlay muted={muted} />
    {status && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-black/70">{!user ? <AccessLockedAction
      message="Faça login para assistir"
      onClick={() => void signInWithGooglePopup().catch(() => setStatus('Não foi possível entrar. Tente novamente.'))}
      className="rounded-xl"
      previewClassName="watch-control px-5 py-3 font-bold rounded-xl border border-white/30 inline-flex items-center gap-2"
    >Assistir transmissão</AccessLockedAction> : <p role="status">{status}</p>}</div>}
    {needsAudio && !muted && <button className="watch-control absolute bottom-28 left-4" onClick={() => { void connection.current?.startAudio().then(() => setNeedsAudio(false)).catch(() => setNeedsAudio(true)); }}>Ativar áudio</button>}
  </div>;
}
