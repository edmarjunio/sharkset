import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Maximize2, Minimize2, Pause, Play, Trophy, Volume2, VolumeX } from 'lucide-react';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { useBroadcastNavigation, type WatchSource } from '../store/useBroadcastNavigation';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { watchSessionReducer } from '../services/watchSession';
import { ImmersiveSurface } from './ImmersiveSurface';
import { FutevoleiVisualBracketCanvas } from './FutevoleiVisualBracketCanvas';
import { BroadcastOverlay, isSemiOrFinalStage } from './BroadcastOverlay';
import { isYouTubeUrl, getYouTubeEmbedUrl } from '../utils/videoUtils';
import type { TeamPair } from '../types';

const LivekitViewer = lazy(() => import('./LivekitViewer').then(module => ({ default: module.LivekitViewer })));

interface PublishedVideo { provider?: 'livekit'; arenaId?: string; liveExpiresAt?: number; title?: string; videoUrl?: string; isLive?: boolean; team1?: string; team2?: string; score1?: number; score2?: number }
const noop = () => {};
const pairName = (pair?: TeamPair) => pair ? [pair.player1, pair.player2 === 'Individual (1x1)' ? '' : pair.player2].filter(Boolean).join(' / ') : 'A definir';

export function BroadcastWatchScreen() {
  const source = useBroadcastNavigation(state => state.source);
  return source ? <WatchScreen key={`${source.kind}:${source.id}`} source={source} /> : null;
}

function WatchScreen({ source }: { source: WatchSource }) {
  const { tournaments, matchesByTournament, bookings } = useApp();
  const { active: fullscreen, setFullscreen } = useImmersiveMode();
  const match = source.kind === 'match' ? (matchesByTournament[source.tournamentId || ''] || []).find(item => item.id === source.id) : undefined;
  const booking = source.kind === 'booking' ? bookings.find(item => item.id === source.id) : undefined;
  const publishedId = source.kind === 'published' ? source.id : match?.linkedBroadcastId;
  const linkedTournament = source.tournamentId || Object.entries(matchesByTournament).find(([, matches]) => publishedId && matches.some(item => item.linkedBroadcastId === publishedId))?.[0] || '';
  const [session, dispatch] = useReducer(watchSessionReducer, { view: 'video', tournamentId: linkedTournament });
  const [tableOpened, setTableOpened] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const [published, setPublished] = useState<PublishedVideo | null>(null);
  const [error, setError] = useState('');
  const [controls, setControls] = useState(true);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const tournament = tournaments.find(item => item.id === session.tournamentId);
  const broadcast = published || booking?.liveBroadcast;
  const title = published?.title || booking?.liveBroadcast?.streamTitle || (match ? `Jogo ${match.matchNumber}` : 'Transmissão');
  const url = broadcast?.videoUrl || '';
  const isYouTube = isYouTubeUrl(url);
  const youTubeEmbedUrl = isYouTube ? getYouTubeEmbedUrl(url, { autoplay: true, muted }) : null;
  const isLivekit = published?.provider === 'livekit';
  const livekitPlayable = isLivekit && !!published?.arenaId && published?.isLive && (published.liveExpiresAt || 0) > now;
  const playable = livekitPlayable || Boolean(broadcast?.isLive && (isYouTube || /^https:\/\//i.test(url)));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const site = document.querySelector<HTMLElement>('.shark-site-background');
    const wasInert = site?.inert || false;
    if (site) site.inert = true;
    return () => { if (site) site.inert = wasInert; previous?.focus?.({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => screen.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [session.view]);

  useEffect(() => {
    if (!publishedId) return;
    return onSnapshot(doc(db, 'broadcasts', publishedId), snapshot => {
      setPublished(snapshot.exists() ? snapshot.data() as PublishedVideo : null);
      setError(snapshot.exists() ? '' : 'Transmissão não encontrada.');
    }, () => setError('Não foi possível carregar a transmissão.'));
  }, [publishedId]);
  useEffect(() => {
    if (linkedTournament && !session.tournamentId) dispatch({ type: 'select', tournamentId: linkedTournament });
  }, [linkedTournament, session.tournamentId]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function reveal() {
    setControls(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (!focused.current) setControls(false); }, 3000);
  }
  useEffect(() => { if (fullscreen) reveal(); else setControls(true); }, [fullscreen]);
  function close() {
    setFullscreen(false);
    const url = new URL(window.location.href); url.searchParams.delete('broadcast');
    window.history.replaceState({}, '', url);
    useBroadcastNavigation.getState().close();
  }
  function openTable() {
    setTableOpened(true); dispatch({ type: 'table' });
    if (!fullscreen) setFullscreen(true);
  }
  async function togglePlay() {
    if (!video.current) return;
    try { if (video.current.paused) await video.current.play(); else video.current.pause(); }
    catch { setError('Não foi possível reproduzir o vídeo. Tente novamente.'); }
  }
  const visibleControls = !fullscreen || controls || (!isLivekit && paused) || !!error;
  return <ImmersiveSurface active>
    <div ref={screen} tabIndex={-1} className={`watch-screen ${fullscreen ? 'watch-screen-fullscreen' : ''}`} role="dialog" aria-modal="true" aria-label={title} onPointerMove={reveal} onPointerDown={reveal} onKeyDown={event => {
        reveal();
        if (event.key === 'Tab') {
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, a[href], [tabindex="0"]')).filter(element => element.getClientRects().length && !element.closest('[inert]'));
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div className="watch-video" style={{ visibility: session.view === 'video' ? 'visible' : 'hidden' }} aria-hidden={session.view !== 'video'} inert={session.view !== 'video'}>
        {livekitPlayable ? <Suspense fallback={<div className="watch-empty">Conectando…</div>}><LivekitViewer arenaId={published!.arenaId!} muted={muted} /></Suspense> : playable ? (
          isYouTube && youTubeEmbedUrl ? (
            <iframe
              key={youTubeEmbedUrl}
              src={youTubeEmbedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="watch-media w-full h-full border-0 object-contain"
            />
          ) : (
            <video
              key={url}
              ref={video}
              src={url}
              autoPlay
              muted={muted}
              playsInline
              className="watch-media"
              onPlay={() => setPaused(false)}
              onPause={() => setPaused(true)}
              onError={() => setError('O vídeo está indisponível ou não é compatível com este navegador.')}
            />
          )
        ) : (
          <div className="watch-empty">
            <Play size={32} />
            <p>{error || (publishedId ? 'Aguardando vídeo da transmissão.' : 'Vídeo ainda não vinculado a este jogo.')}</p>
            <p className="text-sm text-slate-400">A tabela pode ser acompanhada pelo botão abaixo.</p>
          </div>
        )}
        <header className={`watch-heading ${visibleControls ? '' : 'watch-controls-hidden'}`}>
          <button onClick={close} className="watch-control" title="Voltar ao site"><ArrowLeft size={20} /><span>Voltar</span></button>
          <div className="min-w-0"><h1 className="font-bold truncate">{title}</h1><p className="text-xs text-slate-300">{broadcast?.isLive ? 'Ao vivo' : 'Transmissão'}</p></div>
        </header>

        {/* Placar Oficial SHARKSET no Topo Central da Tela (Visão Limpa do Espectador) */}
        {(match || published || booking?.liveBroadcast) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-2xl z-30 pointer-events-none">
            <BroadcastOverlay
              state={{
                score1: (match ? match.score1 : published ? published.score1 : booking?.liveBroadcast?.score1) ?? 0,
                score2: (match ? match.score2 : published ? published.score2 : booking?.liveBroadcast?.score2) ?? 0,
                sets1:
                  (match?.sets ? match.sets.filter(s => s.score1 > s.score2).length : undefined) ??
                  booking?.liveBroadcast?.sets1 ??
                  0,
                sets2:
                  (match?.sets ? match.sets.filter(s => s.score2 > s.score1).length : undefined) ??
                  booking?.liveBroadcast?.sets2 ??
                  0,
                bestOf: (match?.stageName && isSemiOrFinalStage(match.stageName)) ? 3 : (booking?.liveBroadcast?.bestOf || 1),
                stageName: match?.stageName || 'Ao Vivo',
              }}
              team1={match ? pairName(match.team1) : published?.team1 || booking?.customerName || 'Dupla 1'}
              team2={match ? pairName(match.team2) : published?.team2 || 'Dupla 2'}
              compact
            />
          </div>
        )}
        <div className={`watch-controls ${visibleControls ? '' : 'watch-controls-hidden'}`} onFocusCapture={event => { focused.current = event.target.matches(':focus-visible'); setControls(true); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = false; reveal(); } }}>
          {error && <p role="alert" className="watch-error">{error}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <button disabled={!playable || isLivekit} onClick={togglePlay} className="watch-control" aria-label={paused ? 'Reproduzir' : 'Pausar'}>{paused ? <Play size={20} /> : <Pause size={20} />}</button>
            <button disabled={!playable} onClick={() => setMuted(value => !value)} className="watch-control" aria-label={muted ? 'Ativar áudio' : 'Silenciar'}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
            <div className="flex-1" />
            <button onClick={openTable} className="watch-control watch-table-shortcut"><Trophy size={18} /><span>Tabela ao vivo</span></button>
            <button onClick={() => setFullscreen(value => !value)} className="watch-control" aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>{fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
          </div>
        </div>
      </div>
      {tableOpened && <div className="watch-table" hidden={session.view !== 'table'}>
        <header className="watch-table-heading">
          <button autoFocus onClick={() => { dispatch({ type: 'video' }); reveal(); }} className="watch-control watch-table-shortcut"><ArrowLeft size={18} />Voltar à transmissão</button>
          <label className="text-xs flex items-center gap-2">Campeonato<select value={session.tournamentId} onChange={event => dispatch({ type: 'select', tournamentId: event.target.value })} className="bg-slate-800 rounded-lg px-3 py-2 max-w-[40vw]"><option value="">Selecione</option>{tournaments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button onClick={() => setFullscreen(value => !value)} className="watch-control" aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>{fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
        </header>
        {tournament ? <FutevoleiVisualBracketCanvas key={tournament.id} readOnly matches={matchesByTournament[tournament.id] || []} semiFormat={tournament.semiFormat} isSingles={tournament.modalityFormat === 'simples'} formatParticipantName={pairName} getInlineScore={(item, side) => String((side === 's1' ? item.score1 : item.score2) ?? '')} onInlineScoreChange={noop} onInlineSubmit={noop} onOpenRefereeModal={noop} onOpenMatchEditor={noop} /> : <p className="p-6 text-slate-300">{tournaments.length ? 'Selecione um campeonato para acompanhar a tabela.' : 'Nenhum campeonato disponível.'}</p>}
      </div>}
    </div>
  </ImmersiveSurface>;
}
