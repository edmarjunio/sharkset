import React, { useRef, useState, useEffect } from 'react';
import { AthleteProfile, AthleteLevel, RankingScope } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import {
  Share2,
  Download,
  Copy,
  Check,
  X,
  Trophy,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Flame,
  ShieldCheck,
} from 'lucide-react';

interface Top10WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  topAthletes: AthleteProfile[];
  scope: RankingScope;
  scopeLabel: string;
  category: AthleteLevel | 'all';
  arenaName?: string;
  cityName?: string;
}

export const Top10WhatsAppShareModal: React.FC<Top10WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  topAthletes,
  scope,
  scopeLabel,
  category,
  arenaName,
  cityName,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const top10 = topAthletes.slice(0, 10);

  const categoryName =
    category === 'all'
      ? 'Geral (Todas as Categorias)'
      : ATHLETE_LEVEL_LABELS[category] || category;

  // Build the WhatsApp message text
  const buildWhatsAppText = () => {
    const medals = ['🥇 1º', '🥈 2º', '🥉 3º'];
    const lines = [
      '🦈 *RANKING OFICIAL SHARKSET — TOP 10*',
      `🏆 *Categoria:* ${categoryName}`,
      `📍 *Escopo:* ${scopeLabel}${scope === 'arena' && arenaName ? ` (${arenaName})` : ''}${
        scope === 'cidade' && cityName ? ` (${cityName})` : ''
      }`,
      '',
      '🔥 *Confira quem está dominando as quadras:*',
    ];

    top10.forEach((ath, i) => {
      const posLabel = i < 3 ? medals[i] : `${i + 1}º`;
      const pts = ath.points || 0;
      const wins = ath.wins || 0;
      const catLabel = ATHLETE_LEVEL_LABELS[ath.level] || '';
      lines.push(`${posLabel} *${ath.name}* — ${pts} pts (${wins} vitórias · ${catLabel})`);
    });

    lines.push('');
    lines.push('⚠️ *Atenção:* Jogadores com mais de 30 dias sem partidas válidas têm o nível resetado!');
    lines.push('📲 Acesse o ranking completo e agende seus jogos:');
    lines.push(window.location.origin);

    return lines.join('\n');
  };

  // Generate Canvas High-Res Image (1080 x 1350 Instagram / WhatsApp Card format)
  const renderCanvasImage = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;

      // 1. Dark Ocean Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#031427');
      bgGrad.addColorStop(0.35, '#041c33');
      bgGrad.addColorStop(0.7, '#072b4a');
      bgGrad.addColorStop(1, '#020e1c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Underwater ambient glows & decorative circles
      const glowGrad = ctx.createRadialGradient(width * 0.5, 200, 50, width * 0.5, 200, 500);
      glowGrad.addColorStop(0, 'rgba(18, 199, 187, 0.25)');
      glowGrad.addColorStop(0.5, 'rgba(9, 135, 206, 0.12)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, 600);

      const goldGlow = ctx.createRadialGradient(width * 0.5, 450, 40, width * 0.5, 450, 350);
      goldGlow.addColorStop(0, 'rgba(255, 179, 0, 0.18)');
      goldGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = goldGlow;
      ctx.fillRect(0, 300, width, 500);

      // Border frame with subtle cyan stroke
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 28, width - 56, height - 56);

      // 3. Header Section
      // Brand Kicker
      ctx.fillStyle = '#12C7BB';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '4px';
      ctx.fillText('SHARKSET · CIRCUITO OFICIAL DE FUTEVÔLEI', width / 2, 85);

      // Main Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('TOP 10 DO RANKING', width / 2, 145);

      // Gold highlight line
      const goldLine = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
      goldLine.addColorStop(0, 'rgba(255, 179, 0, 0)');
      goldLine.addColorStop(0.5, '#FFB300');
      goldLine.addColorStop(1, 'rgba(255, 179, 0, 0)');
      ctx.strokeStyle = goldLine;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.2, 168);
      ctx.lineTo(width * 0.8, 168);
      ctx.stroke();

      // Category & Scope Badge Subtitle
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      const subInfo = `${categoryName.toUpperCase()} · ESCOPO: ${scopeLabel.toUpperCase()}`;
      ctx.fillText(subInfo, width / 2, 205);

      // 4. Athletes Cards List (Top 10)
      const startY = 240;
      const rowHeight = 98;
      const cardWidth = 980;
      const cardX = (width - cardWidth) / 2;

      top10.forEach((ath, i) => {
        const y = startY + i * (rowHeight + 8);
        const isPodium = i < 3;

        // Card Background
        if (i === 0) {
          // 1º Gold highlight
          const grad = ctx.createLinearGradient(cardX, y, cardX + cardWidth, y);
          grad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
          grad.addColorStop(0.5, 'rgba(180, 83, 9, 0.22)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 2.5;
        } else if (i === 1) {
          // 2º Silver highlight
          const grad = ctx.createLinearGradient(cardX, y, cardX + cardWidth, y);
          grad.addColorStop(0, 'rgba(226, 232, 240, 0.3)');
          grad.addColorStop(0.5, 'rgba(148, 163, 184, 0.18)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 2;
        } else if (i === 2) {
          // 3º Bronze highlight
          const grad = ctx.createLinearGradient(cardX, y, cardX + cardWidth, y);
          grad.addColorStop(0, 'rgba(217, 119, 6, 0.28)');
          grad.addColorStop(0.5, 'rgba(180, 83, 9, 0.16)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#F97316';
          ctx.lineWidth = 2;
        } else {
          // Standard rows
          ctx.fillStyle = i % 2 === 0 ? 'rgba(5, 24, 46, 0.85)' : 'rgba(3, 17, 34, 0.85)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1.2;
        }

        // Draw rounded rectangle card
        ctx.beginPath();
        const r = 16;
        ctx.roundRect(cardX, y, cardWidth, rowHeight, r);
        ctx.fill();
        ctx.stroke();

        // Position Badge (Left)
        ctx.textAlign = 'center';
        if (i === 0) {
          ctx.fillStyle = '#FBBF24';
          ctx.font = '900 36px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('1º 🥇', cardX + 65, y + 58);
        } else if (i === 1) {
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('2º 🥈', cardX + 65, y + 58);
        } else if (i === 2) {
          ctx.fillStyle = '#FB923C';
          ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('3º 🥉', cardX + 65, y + 58);
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(`${i + 1}º`, cardX + 65, y + 58);
        }

        // Athlete Name
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = isPodium
          ? '800 28px "Plus Jakarta Sans", sans-serif'
          : '700 25px "Plus Jakarta Sans", sans-serif';
        const truncatedName =
          ath.name.length > 24 ? ath.name.substring(0, 23) + '…' : ath.name;
        ctx.fillText(truncatedName, cardX + 145, y + 44);

        // Subtitle: Category & City/Arena
        ctx.fillStyle = '#7dd3fc';
        ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
        const athCat = ATHLETE_LEVEL_LABELS[ath.level] || '';
        const athLocation = ath.arenaName || ath.city || 'Mineiros, GO';
        ctx.fillText(`${athCat.toUpperCase()} · ${athLocation}`, cardX + 145, y + 72);

        // Right side stats: Points & Wins
        ctx.textAlign = 'right';
        ctx.fillStyle = isPodium ? '#38BDF8' : '#38BDF8';
        ctx.font = '900 30px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${ath.points || 0}`, cardX + cardWidth - 35, y + 44);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
        const winRate =
          (ath.matchesPlayed || 0) > 0
            ? (((ath.wins || 0) / ath.matchesPlayed!) * 100).toFixed(0)
            : '0';
        ctx.fillText(
          `${ath.wins || 0} vitórias (${winRate}% win rate)`,
          cardX + cardWidth - 35,
          y + 72
        );
      });

      // 5. Footer & Verification Rule
      const footerY = height - 52;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        '⚡ sharkset.com.br · 30 dias sem jogar zera o nível · Mantenha sua vaga!',
        width / 2,
        footerY
      );

      resolve(canvas.toDataURL('image/png'));
    });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        renderCanvasImage();
      }, 100);
    }
  }, [isOpen, topAthletes, scope, category]);

  if (!isOpen) return null;

  // Actions
  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(buildWhatsAppText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildWhatsAppText());
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownloadImage = async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await renderCanvasImage();
      if (!dataUrl) return;

      const link = document.createElement('a');
      link.download = `sharkset_top10_${category}_${scope}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareNative = async () => {
    setIsGenerating(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `sharkset_top10_${category}.png`, {
          type: 'image/png',
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Top 10 Ranking Oficial SHARKSET',
            text: buildWhatsAppText(),
          });
        } else {
          // If native file share is unavailable, fallback to opening WhatsApp text
          handleOpenWhatsApp();
        }
      }, 'image/png');
    } catch (err) {
      handleOpenWhatsApp();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImageToClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      });
    } catch {
      // Fallback: download
      handleDownloadImage();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in"
    >
      <div className="relative w-full max-w-4xl bg-slate-950 border-2 border-cyan-500/40 rounded-3xl shadow-2xl overflow-hidden my-auto text-white">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-950 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Trophy className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#12C7BB]">
                  ENCAMINHAR NO WHATSAPP
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                  Top 10 Melhores
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Card Oficial do Top 10 para Grupos de WhatsApp
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto">
          {/* LEFT: Live Preview of Top 10 Card */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 font-semibold">
              <span>Prévia da Imagem em Alta Resolução (1080x1350)</span>
              <span className="text-amber-400 font-bold">100% Homologado</span>
            </div>

            {/* Hidden real-size canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Visual Live Card in Modal */}
            <div className="w-full bg-gradient-to-b from-[#031427] via-[#041c33] to-[#020e1c] p-4 sm:p-5 rounded-2xl border-2 border-cyan-500/40 shadow-xl space-y-3">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#12C7BB] block">
                  SHARKSET · CIRCUITO OFICIAL DE FUTEVÔLEI
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  TOP 10 DO RANKING
                </h3>
                <div className="h-0.5 w-32 mx-auto bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                <p className="text-xs font-bold text-sky-300">
                  {categoryName.toUpperCase()} · ESCOPO: {scopeLabel.toUpperCase()}
                </p>
              </div>

              {/* Top 10 Athletes Preview List */}
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                {top10.map((ath, i) => {
                  const isGold = i === 0;
                  const isSilver = i === 1;
                  const isBronze = i === 2;

                  return (
                    <div
                      key={ath.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isGold
                          ? 'bg-amber-500/20 border-amber-400/80 text-white font-extrabold shadow-sm'
                          : isSilver
                          ? 'bg-slate-300/15 border-slate-300/60 text-white font-bold'
                          : isBronze
                          ? 'bg-orange-500/15 border-orange-400/60 text-white font-bold'
                          : 'bg-slate-900/60 border-cyan-900/40 text-slate-200 text-xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 text-center font-black text-sm shrink-0">
                          {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `${i + 1}º`}
                        </span>
                        <div className="min-w-0">
                          <span className="font-extrabold block truncate text-xs sm:text-sm">
                            {ath.name}
                          </span>
                          <span className="text-[10px] text-cyan-300 block truncate">
                            {ATHLETE_LEVEL_LABELS[ath.level]} · {ath.arenaName || ath.city}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-black text-xs sm:text-sm text-cyan-400 font-mono block">
                          {ath.points || 0} pts
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {ath.wins || 0}V
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-cyan-500/20 text-center text-[11px] text-cyan-400 font-bold">
                ⚡ sharkset.com.br · 30 dias sem jogar zera o nível
              </div>
            </div>
          </div>

          {/* RIGHT: Quick Sharing & Download Actions */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-extrabold">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Fomente a Disputa e os Desafios</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Encaminhe a imagem ou o texto formatado no grupo de WhatsApp da sua arena ou atletas. Quem está no Top 10 se orgulha de compartilhar e quem está abaixo vai querer jogar para subir!
                </p>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Regra dos 30 dias em destaque para incentivar partidas constantes</span>
                </div>
              </div>

              {/* Main Action Buttons */}
              <div className="space-y-2.5">
                {/* 1. Send Direct to WhatsApp */}
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-[0.99] cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 fill-white" />
                  <span>Encaminhar no WhatsApp (Texto Oficial)</span>
                </button>

                {/* 2. Download Image PNG */}
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGenerating}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-[0.99] cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>Baixar Imagem em Alta Resolução (PNG)</span>
                </button>

                {/* 3. Share Image via Native Share (Mobile) */}
                <button
                  type="button"
                  onClick={handleShareNative}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartilhar Imagem Direto pelo Celular</span>
                </button>

                {/* 4. Copy Image to Clipboard */}
                <button
                  type="button"
                  onClick={handleCopyImageToClipboard}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedImage ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Imagem Copiada! Cole no WhatsApp Web (Ctrl+V)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copiar Imagem p/ Área de Transferência</span>
                    </>
                  )}
                </button>

                {/* 5. Copy Text */}
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Texto Copiado com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copiar Somente Texto Formatado</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Preview Text Box */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-24 overflow-y-auto">
              <span className="text-slate-500 font-bold block mb-1">
                Prévia da Mensagem de Texto:
              </span>
              <pre className="whitespace-pre-wrap font-sans text-[11px]">
                {buildWhatsAppText().substring(0, 180)}...
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
