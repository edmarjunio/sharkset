import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { closeOnBackdrop } from '../utils/dialog';
import html2canvas from 'html2canvas';
import { Camera, Crown, Download, Trophy, X } from 'lucide-react';
import type { BracketMatch, TenantConfig, Tournament } from '../types';
import { TOURNAMENT_CATEGORY_LABELS } from '../services/rankingValidator';
import { decisionScore, getPodiumCards, PODIUM_LABELS, type PodiumCardEntry } from '../services/podiumCards';
import { preparePodiumPhoto, readPodiumPhotos, savePodiumPhotos, type PodiumPhoto } from '../services/podiumPhotoStore';
import './podiumCards.css';

interface Props {
  tournament: Tournament;
  matches: BracketMatch[];
  arena?: TenantConfig;
}

function pairName(entry: PodiumCardEntry) {
  return [entry.team.player1, entry.team.player2].filter(Boolean).join(' & ');
}

function eventDate(value: string) {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : value;
}

function TrophyCard({ entry, photo, tournament, location }: {
  entry: PodiumCardEntry; photo?: PodiumPhoto; tournament: Tournament; location: string;
}) {
  const match = entry.decision;
  const names = (team: BracketMatch['team1']) => [team?.player1, team?.player2].filter(Boolean).join(' & ');
  return <article className={`podium-collectible podium-metal-${entry.place}`} aria-label={`${entry.place}º lugar: ${pairName(entry)}`}>
    <div className="podium-card-inner">
      <header className="podium-card-brand"><span>🦈 SHARK<span>SET</span></span><span>COLEÇÃO PÓDIO</span></header>
      <div className="podium-rarity">{entry.place === 1 ? <Crown size={20} /> : <Trophy size={18} />}
        {entry.place === 1 ? 'CHAMPION · EDIÇÃO OURO' : entry.place === 2 ? 'EDIÇÃO PRATA' : 'EDIÇÃO BRONZE'}
      </div>
      <div className="podium-photo">
        {photo ? <img src={photo.dataUrl} alt={`Foto de ${pairName(entry)}`} style={{ objectPosition: `50% ${photo.position}%` }} /> :
          <div className="podium-photo-placeholder"><Camera size={38} /><span>Adicione a foto da dupla</span></div>}
        <span className="podium-place">{entry.place}º</span>
        {entry.place === 1 && <span className="podium-crown"><Crown size={30} /></span>}
      </div>
      <div className="podium-card-copy">
        <div className="podium-title">{PODIUM_LABELS[entry.place]}</div>
        <h3>{pairName(entry)}</h3>
        <div className="podium-category">{TOURNAMENT_CATEGORY_LABELS[tournament.category]}</div>
        <h4>{tournament.name}</h4>
        <p>{location}</p>
        <p>{eventDate(tournament.date)} · {tournament.sport.replaceAll('_', ' ')}</p>
        <div className="podium-score">
          <strong>{entry.place === 3 ? 'DISPUTA DE TERCEIRO' : 'FINAL'} · JOGO {match.matchNumber}</strong>
          <span>{names(match.team1)}</span>
          <b>{decisionScore(match)}</b>
          <span>{names(match.team2)}</span>
          <small>Placar na ordem das duplas acima e abaixo</small>
        </div>
        <footer>{entry.place === 1 ? '★ ★ ★  CONQUISTA DE CAMPEÃO  ★ ★ ★' : 'CONQUISTA REGISTRADA NA TABELA'}</footer>
      </div>
    </div>
  </article>;
}

export function PodiumCardStudio({ tournament, matches, arena }: Props) {
  const result = useMemo(() => getPodiumCards(tournament, matches), [tournament, matches]);
  const revision = result?.revision;
  const storageKey = `${tournament.tenantId}:${tournament.id}`;
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Record<string, PodiumPhoto>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const location = tournament.location || (arena ? `${arena.name} · ${arena.city}/${arena.state}` : 'Local não informado');

  useEffect(() => {
    let cancelled = false;
    setPhotos({});
    setReady(false);
    setOpen(false);
    setError('');
    setNotice('');
    if (!revision) return;
    readPodiumPhotos(storageKey).then(draft => {
      if (!cancelled && draft?.revision === revision) setPhotos(draft.photos);
    }).catch(() => {
      if (!cancelled) setError('As fotos salvas não puderam ser recuperadas. Você pode selecionar novas fotos e baixar os cards.');
    }).finally(() => {
      if (cancelled) return;
      setReady(true);
      try { setOpen(localStorage.getItem(`podium-prompt:${storageKey}`) !== revision); }
      catch { setOpen(true); }
    });
    return () => { cancelled = true; };
  }, [storageKey, revision]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [open]);

  if (!result) return null;
  const allPhotos = result.entries.every(entry => photos[entry.team.id]);

  function close() {
    if (busy) return;
    try { localStorage.setItem(`podium-prompt:${storageKey}`, revision!); } catch { /* Reopening remains possible. */ }
    setOpen(false);
  }

  async function updatePhoto(teamId: string, photo?: PodiumPhoto) {
    const next = { ...photos };
    if (photo) next[teamId] = photo;
    else delete next[teamId];
    setPhotos(next);
    setNotice('');
    try {
      await savePodiumPhotos(storageKey, { revision: revision!, photos: next });
      setNotice('Fotos salvas neste navegador.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Baixe os cards antes de sair.'); }
  }

  async function upload(teamId: string, file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try { await updatePhoto(teamId, { dataUrl: await preparePodiumPhoto(file), position: 50 }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a foto.'); }
    finally { setBusy(false); }
  }

  async function download(place?: number) {
    const source = place ? exportRef.current?.querySelector(`.podium-metal-${place}`) : exportRef.current;
    if (!source) return;
    setBusy(true);
    setError('');
    const clone = source.cloneNode(true) as HTMLElement;
    clone.classList.add('podium-export');
    clone.style.width = place ? '360px' : '1140px';
    clone.style.maxWidth = 'none';
    clone.style.position = 'fixed';
    clone.style.left = '-20000px';
    clone.style.top = '0';
    document.body.appendChild(clone);
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(clone.querySelectorAll('img')).map(image => image.decode()));
      const canvas = await html2canvas(clone, { scale: place ? 3 : 2, backgroundColor: '#030c19', useCORS: true, windowWidth: 1400, logging: false });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG.')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `sharkset-${tournament.name.replace(/[^\p{L}\p{N}-]/gu, '-').slice(0, 70)}-${place ? `${place}-lugar` : 'podio-completo'}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice('PNG gerado. Confira o download do navegador.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível gerar o card. Tente novamente.'); }
    finally { clone.remove(); setBusy(false); }
  }

  function handleKeys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || []);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return <>
    <button className="podium-launch" disabled={!ready} onClick={() => setOpen(true)}><Trophy size={20} /> Criar cards do pódio · Adicionar fotos</button>
    {open && createPortal(<div className="podium-studio-backdrop" onClick={(event) => closeOnBackdrop(event, close)}>
      <div className="podium-studio" role="dialog" aria-modal="true" aria-labelledby="podium-studio-title" tabIndex={-1} ref={dialogRef} onKeyDown={handleKeys}>
        <header className="podium-studio-header"><div><span>TORNEIO CONCLUÍDO</span><h2 id="podium-studio-title">Transforme a conquista em coleção</h2><p>Adicione a foto de cada dupla e baixe seus cards SHARKSET.</p></div>
          <button onClick={close} disabled={busy} aria-label="Fechar cards do pódio"><X /></button></header>
        <div className="podium-studio-body">
          <p className="podium-local-note">Fotos e ajustes ficam neste navegador. Use fotos autorizadas pelas duplas. Baixe os PNGs para guardar e compartilhar.</p>
          <div className="podium-photo-inputs">
            {result.entries.map(entry => <fieldset key={entry.team.id} disabled={busy}>
              <legend>{entry.place}º · {pairName(entry)}</legend>
              <label className="podium-upload"><Camera size={18} /> {photos[entry.team.id] ? 'Trocar foto' : 'Selecionar foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Foto do ${entry.place}º lugar`} onChange={event => { void upload(entry.team.id, event.target.files?.[0]); event.target.value = ''; }} /></label>
              {photos[entry.team.id] && <><label className="podium-crop-label">Enquadramento vertical
                <input type="range" min="0" max="100" value={photos[entry.team.id].position} onChange={event => setPhotos(previous => ({ ...previous, [entry.team.id]: { ...previous[entry.team.id], position: Number(event.target.value) } }))} onPointerUp={() => void updatePhoto(entry.team.id, photos[entry.team.id])} onKeyUp={() => void updatePhoto(entry.team.id, photos[entry.team.id])} />
              </label><button onClick={() => void updatePhoto(entry.team.id)}>Remover foto</button></>}
              <button disabled={busy || !photos[entry.team.id]} onClick={() => void download(entry.place)}><Download size={16} /> Baixar card {entry.place}º</button>
            </fieldset>)}
          </div>
          {error && <p role="alert" className="podium-error">{error}</p>}
          {notice && <p role="status" className="podium-notice">{notice}</p>}
          <div className="podium-sheet" ref={exportRef}>
            <header className="podium-sheet-heading"><span>SHARKSET · GALERIA DE CONQUISTAS</span><h2>{tournament.name}</h2><p>{TOURNAMENT_CATEGORY_LABELS[tournament.category]} · {eventDate(tournament.date)}</p><p>{location}</p></header>
            <div className="podium-card-grid">{result.entries.map(entry => <TrophyCard key={entry.place} entry={entry} photo={photos[entry.team.id]} tournament={tournament} location={location} />)}</div>
            <footer className="podium-sheet-footer">{result.entries.length === 2 ? 'Terceiro lugar não definido nesta tabela. ' : ''}Organização: {tournament.responsibleName || 'Não informada'} · Resultados registrados na tabela SHARKSET</footer>
          </div>
        </div>
        <footer className="podium-studio-actions"><button onClick={close} disabled={busy}>Adicionar fotos depois</button><button className="podium-download-all" disabled={busy || !allPhotos} onClick={() => void download()}><Download size={18} /> {busy ? 'Preparando…' : 'Baixar pódio completo'}</button>{!allPhotos && <span>Adicione as fotos para liberar o pódio completo.</span>}</footer>
      </div>
    </div>, document.body)}
  </>;
}
