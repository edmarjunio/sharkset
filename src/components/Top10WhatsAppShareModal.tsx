import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { closeOnBackdrop } from '../utils/dialog';
import { Share2, Download, Copy, X, MessageCircle } from 'lucide-react';
import type { AthleteProfile, AthleteLevel, RankingScope } from '../types';
import { ATHLETE_LEVEL_LABELS, formatSharksetSince } from '../services/rankingValidator';
import { lockImmersiveScroll } from '../services/fullscreen';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  topAthletes: AthleteProfile[];
  scope: RankingScope;
  scopeLabel: string;
  category: AthleteLevel | 'all';
  arenaName?: string;
  cityName?: string;
}

const LEVEL_BADGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  iniciante: { label: 'INICIANTE', bg: '#06b6d4', text: '#021422' },
  serie_c: { label: 'SÉRIE C', bg: '#10b981', text: '#02170f' },
  serie_b: { label: 'SÉRIE B', bg: '#38bdf8', text: '#021226' },
  serie_a: { label: 'SÉRIE A', bg: '#f43f5e', text: '#ffffff' },
  profissional: { label: 'PROFISSIONAL', bg: '#fbbf24', text: '#171101' },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Top10WhatsAppShareModal: React.FC<Props> = ({
  isOpen,
  onClose,
  topAthletes,
  scope,
  scopeLabel,
  category,
  arenaName,
  cityName,
}) => {
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
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => {
      release();
      window.removeEventListener('keydown', key);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPreview('');
    setStatus('');

    async function draw() {
      try {
        const logo = new Image();
        logo.src = '/brand/sharkset-logo-transparent.png';
        await Promise.all([logo.decode(), document.fonts.ready]);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível gerar a imagem.');

        // 1. Fundo Deep Ocean com iluminação radial suave
        const bgGrad = ctx.createRadialGradient(540, 320, 100, 540, 675, 850);
        bgGrad.addColorStop(0, '#062647');
        bgGrad.addColorStop(1, '#020d1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1080, 1350);

        // 2. Header: Logo + Título Oficial + Subtítulo
        ctx.drawImage(logo, 52, 28, 96, 96);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 38px sans-serif';
        ctx.fillText('TOP 10 DO RANKING', 170, 72);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('SHARKSET OFFICIAL ATHLETES LEADERBOARD', 170, 93);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '19px sans-serif';
        ctx.fillText(subtitle, 170, 118, 860);

        const fit = (value: string, width: number) => {
          let text = value;
          while (ctx.measureText(text).width > width && text.length > 1) {
            text = text.slice(0, -2) + '…';
          }
          return text;
        };

        const list = topAthletes.slice(0, 10);

        // Renderiza cada um dos atletas
        list.forEach((athlete, index) => {
          const matches = athlete.matchesPlayed || 0;
          const wins = athlete.wins || 0;
          const losses = Math.max(0, matches - wins);
          const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
          const cityUf = `${(athlete.city || 'Mineiros').split(' - ')[0]} - ${athlete.state || 'GO'}`;
          const catKey = (athlete.level || 'iniciante').toLowerCase();
          const catConfig = LEVEL_BADGE_CONFIG[catKey] || {
            label: (ATHLETE_LEVEL_LABELS[athlete.level] || athlete.level).toUpperCase(),
            bg: '#38bdf8',
            text: '#021226',
          };
          const since = formatSharksetSince(athlete.createdAt);
          const points = athlete.points || 0;
          const titles = athlete.titlesCount || 0;
          const initials = getInitials(athlete.name);

          const cardX = 48;
          const cardW = 984;

          // ========================================================
          // OS 3 PRIMEIROS DO RANKING: DESTAQUE MÁXIMO EM OURO, PRATA E BRONZE (ESTILO 3D CARD)
          // ========================================================
          if (index < 3) {
            const cardY = 145 + index * 110;
            const cardH = 100;

            const podiumTier =
              index === 0
                ? {
                    // 1º Ouro
                    borderGrad: ['#fff3a1', '#f59e0b', '#b45309', '#fde047'],
                    bgGrad: ['#281a02', '#160e01', '#0a0600'],
                    glowColor: 'rgba(245, 158, 11, 0.5)',
                    badgeBg: ['#fbbf24', '#d97706'],
                    badgeText: '#0f172a',
                    badgeIcon: '👑',
                    badgeSub: '1º LUGAR',
                    nameColor: '#fffbeb',
                    pointsColor: '#fef08a',
                    pillBg: 'rgba(245, 158, 11, 0.16)',
                    pillBorder: 'rgba(245, 158, 11, 0.65)',
                    ringColor: '#fbbf24',
                  }
                : index === 1
                ? {
                    // 2º Prata
                    borderGrad: ['#ffffff', '#cbd5e1', '#64748b', '#e2e8f0'],
                    bgGrad: ['#1c2536', '#0f1624', '#070b12'],
                    glowColor: 'rgba(226, 232, 240, 0.4)',
                    badgeBg: ['#e2e8f0', '#94a3b8'],
                    badgeText: '#0f172a',
                    badgeIcon: '🥈',
                    badgeSub: '2º LUGAR',
                    nameColor: '#ffffff',
                    pointsColor: '#f8fafc',
                    pillBg: 'rgba(226, 232, 240, 0.14)',
                    pillBorder: 'rgba(226, 232, 240, 0.55)',
                    ringColor: '#e2e8f0',
                  }
                : {
                    // 3º Bronze
                    borderGrad: ['#ffedd5', '#ea580c', '#7c2d12', '#fdba74'],
                    bgGrad: ['#271205', '#160902', '#090301'],
                    glowColor: 'rgba(234, 88, 12, 0.4)',
                    badgeBg: ['#fb923c', '#c2410c'],
                    badgeText: '#ffffff',
                    badgeIcon: '🥉',
                    badgeSub: '3º LUGAR',
                    nameColor: '#fff7ed',
                    pointsColor: '#fed7aa',
                    pillBg: 'rgba(234, 88, 12, 0.16)',
                    pillBorder: 'rgba(234, 88, 12, 0.6)',
                    ringColor: '#fb923c',
                  };

            // A. Brilho externo suave (Glow do card 3D)
            ctx.save();
            ctx.shadowColor = podiumTier.glowColor;
            ctx.shadowBlur = 18;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;

            // B. Fundo metálico escuro com gradiente
            const bg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
            bg.addColorStop(0, podiumTier.bgGrad[0]);
            bg.addColorStop(0.5, podiumTier.bgGrad[1]);
            bg.addColorStop(1, podiumTier.bgGrad[2]);
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 18);
            ctx.fill();
            ctx.restore();

            // C. Borda chanfrada metálica 3D com gradiente
            const border = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
            border.addColorStop(0, podiumTier.borderGrad[0]);
            border.addColorStop(0.35, podiumTier.borderGrad[1]);
            border.addColorStop(0.7, podiumTier.borderGrad[2]);
            border.addColorStop(1, podiumTier.borderGrad[3]);
            ctx.strokeStyle = border;
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 18);
            ctx.stroke();

            // D. Efeito Holográfico / Foil sheen diagonal
            const foil = ctx.createLinearGradient(cardX, cardY, cardX + cardW * 0.5, cardY + cardH);
            foil.addColorStop(0, 'rgba(255, 255, 255, 0.13)');
            foil.addColorStop(0.3, 'rgba(255, 255, 255, 0.03)');
            foil.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = foil;
            ctx.beginPath();
            ctx.roundRect(cardX + 2, cardY + 2, cardW - 4, cardH - 4, 16);
            ctx.fill();

            // E. Linha de bisel interno (Inner highlight)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(cardX + 3, cardY + 3, cardW - 6, cardH - 6, 15);
            ctx.stroke();

            // F. Escudo / Medalha do pódio à esquerda
            const badgeX = cardX + 16;
            const badgeY = cardY + 16;
            const badgeW = 66;
            const badgeH = 68;

            const bGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
            bGrad.addColorStop(0, podiumTier.badgeBg[0]);
            bGrad.addColorStop(1, podiumTier.badgeBg[1]);
            ctx.fillStyle = bGrad;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.fillStyle = podiumTier.badgeText;
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText(podiumTier.badgeIcon, badgeX + badgeW / 2, badgeY + 27);
            ctx.font = '900 18px sans-serif';
            ctx.fillText(`${index + 1}º`, badgeX + badgeW / 2, badgeY + 48);
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText(podiumTier.badgeSub, badgeX + badgeW / 2, badgeY + 61);
            ctx.textAlign = 'left';

            // G. Emblema circular do atleta com anel metálico
            const avatarCX = cardX + 128;
            const avatarCY = cardY + cardH / 2;
            const avatarR = 26;

            ctx.fillStyle = '#030b14';
            ctx.beginPath();
            ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = podiumTier.ringColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.fillStyle = podiumTier.nameColor;
            ctx.font = '900 19px sans-serif';
            ctx.fillText(initials, avatarCX, avatarCY + 7);
            ctx.textAlign = 'left';

            // H. Nome do Atleta + Tag da Categoria
            const textX = cardX + 170;
            ctx.fillStyle = podiumTier.nameColor;
            ctx.font = '900 24px sans-serif';
            const nameStr = fit(athlete.name, 430);
            ctx.fillText(nameStr, textX, cardY + 34);

            const nameWidth = ctx.measureText(nameStr).width;
            const catBadgeX = textX + nameWidth + 12;
            const catBadgeY = cardY + 16;
            ctx.font = '900 11px sans-serif';
            const catBadgeW = ctx.measureText(catConfig.label).width + 16;
            const catBadgeH = 22;

            ctx.fillStyle = catConfig.bg;
            ctx.beginPath();
            ctx.roundRect(catBadgeX, catBadgeY, catBadgeW, catBadgeH, 6);
            ctx.fill();

            ctx.fillStyle = catConfig.text;
            ctx.fillText(catConfig.label, catBadgeX + 8, catBadgeY + 15);

            // I. Estatísticas: V/D · WinRate · Cidade
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 15px sans-serif';
            ctx.fillText(
              `⚔️ ${wins}V - ${losses}D   ·   🎯 ${winRate}% WR   ·   📍 ${cityUf}`,
              textX,
              cardY + 62
            );

            // J. Subtexto Oficial
            ctx.fillStyle = '#94a3b8';
            ctx.font = '13px sans-serif';
            ctx.fillText(`🗓️ Atleta Homologado SHARKSET · Desde ${since}`, textX, cardY + 84);

            // K. Placa de Pontos à Direita
            const pillW = 205;
            const pillH = 72;
            const pillX = cardX + cardW - pillW - 16;
            const pillY = cardY + (cardH - pillH) / 2;

            ctx.fillStyle = podiumTier.pillBg;
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 14);
            ctx.fill();

            ctx.strokeStyle = podiumTier.pillBorder;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 14);
            ctx.stroke();

            ctx.textAlign = 'right';
            ctx.fillStyle = podiumTier.pointsColor;
            ctx.font = '900 27px sans-serif';
            ctx.fillText(`${points.toLocaleString('pt-BR')} pts`, pillX + pillW - 14, pillY + 36);

            ctx.fillStyle = winRate >= 60 ? '#34d399' : '#94a3b8';
            ctx.font = 'bold 15px sans-serif';
            const titlesStr = titles > 0 ? ` 🏆 ${titles} tit.` : '';
            ctx.fillText(`${winRate}% WR${titlesStr}`, pillX + pillW - 14, pillY + 60);
            ctx.textAlign = 'left';
          } else {
            // ========================================================
            // POSIÇÕES 4º AO 10º: LINHAS DE LEADERBOARD PREMIUM
            // ========================================================
            const cardY = 490 + (index - 3) * 88;
            const cardH = 80;

            // Fundo escuro azul marinho
            ctx.fillStyle = '#061d33';
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 14);
            ctx.fill();

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 14);
            ctx.stroke();

            // Posição à esquerda
            const rankX = cardX + 16;
            const rankY = cardY + 16;
            const rankW = 54;
            const rankH = 48;

            ctx.fillStyle = '#020e1c';
            ctx.beginPath();
            ctx.roundRect(rankX, rankY, rankW, rankH, 10);
            ctx.fill();

            ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(rankX, rankY, rankW, rankH, 10);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#38bdf8';
            ctx.font = '900 21px sans-serif';
            ctx.fillText(`${index + 1}º`, rankX + rankW / 2, rankY + 31);
            ctx.textAlign = 'left';

            // Círculo com iniciais
            const avCX = cardX + 104;
            const avCY = cardY + cardH / 2;
            const avR = 23;

            ctx.fillStyle = '#020e1c';
            ctx.beginPath();
            ctx.arc(avCX, avCY, avR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#1e3a5f';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(avCX, avCY, avR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(initials, avCX, avCY + 6);
            ctx.textAlign = 'left';

            // Nome e Categoria
            const tX = cardX + 145;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 21px sans-serif';
            const nameStr = fit(athlete.name, 450);
            ctx.fillText(nameStr, tX, cardY + 33);

            const nW = ctx.measureText(nameStr).width;
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('· ' + catConfig.label, tX + nW + 10, cardY + 33);

            // Estatísticas
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '14px sans-serif';
            ctx.fillText(
              `V/D: ${wins}V - ${losses}D   ·   WinRate: ${winRate}%   ·   📍 ${cityUf}`,
              tX,
              cardY + 58
            );

            // Pontuação à Direita
            ctx.textAlign = 'right';
            ctx.fillStyle = '#67e8f9';
            ctx.font = '900 24px sans-serif';
            ctx.fillText(`${points.toLocaleString('pt-BR')} pts`, cardX + cardW - 20, cardY + 36);

            ctx.fillStyle = winRate >= 60 ? '#34d399' : '#94a3b8';
            ctx.font = 'bold 14px sans-serif';
            const titlesStr = titles > 0 ? ` 🏆 ${titles}` : '';
            ctx.fillText(`${winRate}% WR${titlesStr}`, cardX + cardW - 20, cardY + 60);
            ctx.textAlign = 'left';
          }
        });

        // Divisor visual entre o Pódio e o restante do Top 10
        if (list.length > 3) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(48, 480);
          ctx.lineTo(1032, 480);
          ctx.stroke();
        }

        if (!topAthletes.length) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '28px sans-serif';
          ctx.fillText('Nenhum atleta neste filtro.', 60, 250);
        }

        // 3. Espaço reservado para o Patrocinador Oficial
        ctx.fillStyle = '#031326';
        ctx.beginPath();
        ctx.roundRect(48, 1125, 984, 95, 14);
        ctx.fill();

        ctx.strokeStyle = '#15324e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(48, 1125, 984, 95, 14);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('PATROCINADOR OFICIAL DO APP', 540, 1158);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('Espaço reservado para sua marca', 540, 1192);

        // 4. Rodapé oficial do site
        ctx.fillStyle = '#64748b';
        ctx.font = '16px sans-serif';
        ctx.fillText(window.location.host || 'sharkset.web.app', 540, 1265);

        if (!cancelled) setPreview(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setStatus('Não foi possível gerar a imagem. Feche e tente novamente.');
      }
    }
    void draw();
    return () => {
      cancelled = true;
    };
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
        const medal = i === 0 ? '👑 🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔹';
        return [
          `${medal} *${i + 1}º ${athlete.name.toUpperCase()}* — *${(athlete.points || 0).toLocaleString('pt-BR')} pts*`,
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
    const link = document.createElement('a');
    link.download = `sharkset_top10_${category}_${scope}.png`;
    link.href = preview;
    link.click();
  }

  async function share() {
    setBusy(true);
    setStatus('');
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current?.toBlob(resolve, 'image/png')
      );
      if (!blob) throw new Error();
      const file = new File([blob], 'sharkset-top10.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: 'Top 10 Sharkset', text: message() });
      else {
        download();
        setStatus('Imagem baixada. Anexe-a na sua conversa do WhatsApp.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setStatus('Não foi possível compartilhar. Use Baixar imagem.');
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(message());
      setStatus('Texto copiado.');
    } catch {
      setStatus('Não foi possível copiar o texto neste navegador.');
    }
  }

  return createPortal(
    <div
      className="ranking-share-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-share-title"
      onClick={(event) => closeOnBackdrop(event, onClose)}
    >
      <div className="ranking-share-panel" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <img
              src="/brand/sharkset-logo-transparent.png"
              alt="Sharkset"
              className="w-12 h-12 object-contain"
            />
            <div>
              <h2 id="ranking-share-title" className="font-bold">
                Compartilhar ranking
              </h2>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            autoFocus
            onClick={onClose}
            aria-label="Fechar compartilhamento"
            className="p-2 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </header>
        <div className="ranking-share-content">
          <canvas ref={canvasRef} hidden />
          <div className="min-w-0">
            {preview ? (
              <img
                src={preview}
                alt={`Top 10 do ranking: ${subtitle}. Inclui logo Sharkset e espaço reservado ao patrocinador oficial.`}
                className="w-full rounded-xl shadow-2xl"
              />
            ) : (
              <p role="status" className="p-8 text-slate-400">
                Preparando imagem…
              </p>
            )}
          </div>
          <div className="space-y-3 text-sm">
            <p className="text-slate-300">Compartilhe a classificação selecionada com seu grupo.</p>
            <button
              disabled={!preview || busy}
              onClick={share}
              className="ranking-share-action bg-emerald-600 hover:bg-emerald-500"
            >
              <Share2 size={18} />
              Compartilhar imagem
            </button>
            <button
              disabled={!preview || busy}
              onClick={download}
              className="ranking-share-action bg-slate-800 hover:bg-slate-700"
            >
              <Download size={18} />
              Baixar imagem
            </button>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message())}`}
              target="_blank"
              rel="noreferrer"
              className="ranking-share-action border border-slate-700 text-emerald-300"
            >
              <MessageCircle size={18} />
              Enviar texto no WhatsApp
            </a>
            <button onClick={copyText} className="ranking-share-action text-slate-400">
              <Copy size={16} />
              Copiar texto
            </button>
            <p className="text-xs text-slate-500">
              A imagem inclui os 3 primeiros destacados em ouro, prata e bronze no padrão Card 3D
              oficial SHARKSET.
            </p>
            {status && (
              <p role="status" className="text-sm text-cyan-300">
                {status}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
