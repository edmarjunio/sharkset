import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Download, Copy, X, MessageCircle } from 'lucide-react';
import type { AthleteProfile, AthleteLevel, RankingScope } from '../types';
import { ATHLETE_LEVEL_LABELS, formatSharksetSince } from '../services/rankingValidator';
import { lockImmersiveScroll } from '../services/fullscreen';

interface Props {
  isOpen: boolean; onClose: () => void; topAthletes: AthleteProfile[];
  scope: RankingScope; scopeLabel: string; category: AthleteLevel | 'all';
  arenaName?: string; cityName?: string;
}

export const Top10WhatsAppShareModal: React.FC<Props> = ({ isOpen, onClose, topAthletes, scope, scopeLabel, category, arenaName, cityName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const categoryName = category === 'all' ? 'Todas as categorias' : ATHLETE_LEVEL_LABELS[category];
  const location = scope === 'arena' ? arenaName : scope === 'cidade' ? cityName : '';
  const subtitle = [scopeLabel, location, categoryName].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!isOpen) return;
    const release = lockImmersiveScroll();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { release(); window.removeEventListener('keydown', key); };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPreview(''); setStatus('');
    async function draw() {
      try {
        const logo = new Image();
        logo.src = '/brand/sharkset-logo-transparent.png';
        await Promise.all([logo.decode(), document.fonts.ready]);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = 1080; canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível gerar a imagem.');
        ctx.fillStyle = '#04182b'; ctx.fillRect(0, 0, 1080, 1350);
        ctx.drawImage(logo, 52, 28, 100, 100);
        ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 40px sans-serif';
        ctx.fillText('TOP 10 DO RANKING', 175, 75);
        ctx.fillStyle = '#94a3b8'; ctx.font = '21px sans-serif'; ctx.fillText(subtitle, 175, 112, 850);
        const fit = (value: string, width: number) => { let text = value; while (ctx.measureText(text).width > width && text.length > 1) text = text.slice(0, -2) + '…'; return text; };
        topAthletes.slice(0, 10).forEach((athlete, index) => {
          const y = 155 + index * 98;
          // Card background with podium distinction: 1º Ouro, 2º Prata, 3º Bronze
          if (index === 0) {
            ctx.fillStyle = '#2a210d'; // Warm gold dark tint
          } else if (index === 1) {
            ctx.fillStyle = '#1c2430'; // Slate silver tint
          } else if (index === 2) {
            ctx.fillStyle = '#261a12'; // Bronze tint
          } else {
            ctx.fillStyle = '#092338';
          }
          ctx.beginPath();
          ctx.roundRect(48, y, 984, 92, 14);
          ctx.fill();

          // Stroke border for top 3
          if (index === 0) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (index === 1) {
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (index === 2) {
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          // Rank Number & Badge
          const rankColors = ['#fbbf24', '#e2e8f0', '#f59e0b', '#94a3b8'];
          ctx.fillStyle = rankColors[Math.min(index, 3)];
          ctx.font = 'bold 28px sans-serif';
          ctx.fillText(String(index + 1) + 'º', 72, y + 54);

          // Calculations: V/D, WinRate, Cidade-UF, Categoria, Desde
          const matches = athlete.matchesPlayed || 0;
          const wins = athlete.wins || 0;
          const losses = Math.max(0, matches - wins);
          const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
          const cityUf = `${(athlete.city || 'Mineiros').split(' - ')[0]} - ${athlete.state || 'GO'}`;
          const catLabel = (ATHLETE_LEVEL_LABELS[athlete.level] || athlete.level).toUpperCase();
          const since = formatSharksetSince(athlete.createdAt);

          // Row 1: Athlete Name + Categoria Tag
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 23px sans-serif';
          const nameText = fit(athlete.name, 450);
          ctx.fillText(nameText, 135, y + 32);
          const nameWidth = ctx.measureText(nameText).width;

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText('· ' + catLabel, 135 + nameWidth + 10, y + 32);

          // Row 2: Vitória/Derrota, WinRate, Cidade-UF
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '16px sans-serif';
          ctx.fillText(`V/D: ${wins}V - ${losses}D   ·   WinRate: ${winRate}%   ·   📍 ${cityUf}`, 135, y + 57);

          // Row 3: Joga no SHARKSET desde:
          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px sans-serif';
          ctx.fillText(`🗓️ Joga no SHARKSET desde: ${since}`, 135, y + 79);

          // Right Column: Points and WR badge
          ctx.textAlign = 'right';
          ctx.fillStyle = index === 0 ? '#fbbf24' : '#67e8f9';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText((athlete.points || 0).toLocaleString('pt-BR') + ' pts', 1000, y + 42);

          ctx.fillStyle = winRate >= 60 ? '#34d399' : '#94a3b8';
          ctx.font = 'bold 16px sans-serif';
          const titlesStr = (athlete.titlesCount || 0) > 0 ? ` 🏆 ${athlete.titlesCount}` : '';
          ctx.fillText(`${winRate}% WR${titlesStr}`, 1000, y + 70);
          ctx.textAlign = 'left';
        });
        if (!topAthletes.length) { ctx.fillStyle = '#94a3b8'; ctx.font = '28px sans-serif'; ctx.fillText('Nenhum atleta neste filtro.', 60, 250); }
        ctx.strokeStyle = '#284359'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(48, 1150, 984, 95, 12); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = '#94a3b8'; ctx.font = '18px sans-serif'; ctx.fillText('PATROCINADOR OFICIAL DO APP', 540, 1185);
        ctx.fillStyle = '#cbd5e1'; ctx.font = '24px sans-serif'; ctx.fillText('Espaço reservado para sua marca', 540, 1222);
        ctx.fillStyle = '#64748b'; ctx.font = '18px sans-serif'; ctx.fillText(window.location.host, 540, 1290);
        if (!cancelled) setPreview(canvas.toDataURL('image/png'));
      } catch { if (!cancelled) setStatus('Não foi possível gerar a imagem. Feche e tente novamente.'); }
    }
    void draw();
    return () => { cancelled = true; };
  }, [isOpen, topAthletes, subtitle]);

  if (!isOpen) return null;
  function message() {
    return [
      '🦈 *TOP 10 · RANKING SHARKSET*',
      subtitle,
      '────────────────────────────',
      ...topAthletes.slice(0, 10).map((athlete, i) => {
        const matches = athlete.matchesPlayed || 0;
        const wins = athlete.wins || 0;
        const losses = Math.max(0, matches - wins);
        const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
        const cityUf = `${(athlete.city || 'Mineiros').split(' - ')[0]} - ${athlete.state || 'GO'}`;
        const cat = ATHLETE_LEVEL_LABELS[athlete.level];
        const since = formatSharksetSince(athlete.createdAt);
        return [
          `*${i + 1}º ${athlete.name.toUpperCase()}* — *${(athlete.points || 0).toLocaleString('pt-BR')} pts*`,
          `   🏷️ Categoria: ${cat} · 📍 ${cityUf}`,
          `   ⚔️ V/D: ${wins}V - ${losses}D | 🎯 WinRate: ${winRate}%`,
          `   🗓️ Joga no SHARKSET desde: ${since}`,
        ].join('\n');
      }),
      '────────────────────────────',
      `📲 Acompanhe ao vivo em: ${window.location.origin}`,
    ].join('\n');
  }
  function download() {
    const link = document.createElement('a'); link.download = `sharkset_top10_${category}_${scope}.png`; link.href = preview; link.click();
  }
  async function share() {
    setBusy(true); setStatus('');
    try {
      const blob = await new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error();
      const file = new File([blob], 'sharkset-top10.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Top 10 Sharkset', text: message() });
      else { download(); setStatus('Imagem baixada. Anexe-a na sua conversa do WhatsApp.'); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('Não foi possível compartilhar. Use Baixar imagem.'); }
    finally { setBusy(false); }
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(message()); setStatus('Texto copiado.'); }
    catch { setStatus('Não foi possível copiar o texto neste navegador.'); }
  }
  return createPortal(<div className="ranking-share-backdrop" role="dialog" aria-modal="true" aria-labelledby="ranking-share-title">
    <div className="ranking-share-panel">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <div className="flex items-center gap-3"><img src="/brand/sharkset-logo-transparent.png" alt="Sharkset" className="w-12 h-12 object-contain" /><div><h2 id="ranking-share-title" className="font-bold">Compartilhar ranking</h2><p className="text-xs text-slate-400">{subtitle}</p></div></div>
        <button autoFocus onClick={onClose} aria-label="Fechar compartilhamento" className="p-2 rounded-lg hover:bg-white/10"><X size={20} /></button>
      </header>
      <div className="ranking-share-content">
        <canvas ref={canvasRef} hidden />
        <div className="min-w-0">{preview ? <img src={preview} alt={`Top 10 do ranking: ${subtitle}. Inclui logo Sharkset e espaço reservado ao patrocinador oficial.`} className="w-full rounded-xl" /> : <p role="status" className="p-8 text-slate-400">Preparando imagem…</p>}</div>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">Compartilhe a classificação selecionada com seu grupo.</p>
          <button disabled={!preview || busy} onClick={share} className="ranking-share-action bg-emerald-600 hover:bg-emerald-500"><Share2 size={18} />Compartilhar imagem</button>
          <button disabled={!preview || busy} onClick={download} className="ranking-share-action bg-slate-800 hover:bg-slate-700"><Download size={18} />Baixar imagem</button>
          <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message())}`} target="_blank" rel="noreferrer" className="ranking-share-action border border-slate-700 text-emerald-300"><MessageCircle size={18} />Enviar texto no WhatsApp</a>
          <button onClick={copyText} className="ranking-share-action text-slate-400"><Copy size={16} />Copiar texto</button>
          <p className="text-xs text-slate-500">A imagem inclui a logo do site e uma área reservada ao patrocinador oficial do app.</p>
          {status && <p role="status" className="text-sm text-cyan-300">{status}</p>}
        </div>
      </div>
    </div>
  </div>, document.body);
};
