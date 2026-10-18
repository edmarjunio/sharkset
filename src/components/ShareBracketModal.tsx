import React, { useState } from 'react';
import { Tournament, BracketMatch, TeamPair } from '../types';
import { SharksetLogo } from './SharksetLogo';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  MessageCircle,
  ExternalLink,
  Trophy,
  Sparkles,
  Radio,
} from 'lucide-react';

interface ShareBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  matches: BracketMatch[];
  selectedMatch?: BracketMatch | null;
  podium: {
    champion?: TeamPair;
    runnerUp?: TeamPair;
    thirdPlace?: TeamPair;
    fourthPlace?: TeamPair;
  };
  tenantName: string;
}

export const ShareBracketModal: React.FC<ShareBracketModalProps> = ({
  isOpen,
  onClose,
  tournament,
  matches,
  selectedMatch,
  podium,
  tenantName,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  const formatPairName = (pair?: TeamPair | null): string => {
    if (!pair) return 'A definir';
    if (!pair.player2 || pair.player2.toLowerCase() === 'individual (1x1)') {
      return pair.player1;
    }
    return `${pair.player1} & ${pair.player2}`;
  };

  // Build deep link for specific match or entire bracket
  const baseUrl = window.location.origin + window.location.pathname;
  const deepLink = selectedMatch
    ? `${baseUrl}?tab=tournaments&tournamentId=${tournament.id}&matchId=${selectedMatch.id}`
    : `${baseUrl}?tab=tournaments&tournamentId=${tournament.id}`;

  const completedMatches = matches.filter((m) => m.status === 'completed');
  const liveMatches = matches.filter((m) => m.status === 'in_progress');

  // WhatsApp formatted summary text
  const shareText = selectedMatch
    ? `🦈 *SHARK SET · Resultado de Partida*\n🏆 *${tournament.name}*\n📍 *${tenantName}*\n\n🔥 *Jogo #${selectedMatch.matchNumber}* (${selectedMatch.courtName || 'Quadra Central'})\n${
        formatPairName(selectedMatch.team1)
      } *${selectedMatch.score1}* x *${selectedMatch.score2}* ${
        formatPairName(selectedMatch.team2)
      }\nStatus: ${
        selectedMatch.status === 'completed'
          ? `✅ Vencedor: ${selectedMatch.winnerId === selectedMatch.team1?.id ? formatPairName(selectedMatch.team1) : formatPairName(selectedMatch.team2)}`
          : selectedMatch.status === 'in_progress'
          ? '🔴 AO VIVO AGORA!'
          : '⏳ Aguardando início'
      }\n\n👉 Acompanhe a chave e estatísticas ao vivo:\n${deepLink}`
    : `🦈 *SHARK SET · Chaveamento Oficial*\n🏆 *${tournament.name}*\n📍 *${tenantName}*\n\n🥇 *Campeão:* ${
        podium.champion ? formatPairName(podium.champion) : 'Em disputa...'
      }\n🥈 *Vice:* ${podium.runnerUp ? formatPairName(podium.runnerUp) : 'Em disputa...'}\n\n📊 *Progresso:* ${
        completedMatches.length
      }/${matches.length} partidas concluídas\n🔴 *Jogos Ao Vivo:* ${liveMatches.length}\n\n👉 Confira o chaveamento interativo em tempo real:\n${deepLink}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SHARK SET · ${tournament.name}`,
          text: shareText,
          url: deepLink,
        });
      } catch {
        // User dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="aquarium-glass relative w-full max-w-lg bg-[#071D3D] border-2 border-[#145A9B] rounded-3xl shadow-2xl overflow-hidden text-[#F7FAFD]">
        {/* Top Gradient Banner */}
        <div className="bg-gradient-to-r from-[#030B17] via-[#071D3D] to-[#0A2E63] p-5 border-b border-[#145A9B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SharksetLogo size="sm" />
            <div>
              <span className="px-2 py-0.5 rounded-md bg-[#0987CE]/20 text-[#0987CE] text-[10px] font-black uppercase tracking-wider">
                COMPARTILHAR CHAVEAMENTO
              </span>
              <h2 className="text-base font-black text-white leading-tight mt-0.5">
                {selectedMatch
                  ? `Compartilhar Jogo #${selectedMatch.matchNumber}`
                  : 'Compartilhar Chave do Torneio'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#030B17] hover:bg-[#0987CE] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Visual Share Card Preview (Matching Brand Slide 10 & 11) */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-[#0B254E] via-[#071D3D] to-[#030B17] border border-[#0987CE]/40 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#145A9B]/60 pb-3">
              <div className="flex items-center gap-2">
                <SharksetLogo size="xs" />
                <span className="text-xs font-black tracking-tight text-white">
                  SHARK<span className="text-[#0987CE]">SET</span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#12C7BB]/20 text-[#12C7BB] text-[10px] font-black">
                {selectedMatch?.status === 'in_progress' ? '● AO VIVO' : 'CHAVE OFICIAL'}
              </span>
            </div>

            {selectedMatch ? (
              <div className="py-4 space-y-3">
                <div className="text-center text-xs text-slate-300 font-semibold">
                  Jogo #{selectedMatch.matchNumber} · {selectedMatch.courtName || 'Quadra 1'}
                </div>
                <div className="flex items-center justify-around bg-[#030B17]/60 p-3 rounded-xl border border-[#145A9B]">
                  <div className="text-center max-w-[42%]">
                    <p className="font-bold text-sm text-white truncate">
                      {formatPairName(selectedMatch.team1)}
                    </p>
                    <span className="text-2xl font-black font-mono text-[#0987CE]">
                      {selectedMatch.score1}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-400">VS</span>
                  <div className="text-center max-w-[42%]">
                    <p className="font-bold text-sm text-white truncate">
                      {formatPairName(selectedMatch.team2)}
                    </p>
                    <span className="text-2xl font-black font-mono text-[#0987CE]">
                      {selectedMatch.score2}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-3 space-y-2 text-xs">
                <div className="font-black text-white text-sm truncate">{tournament.name}</div>
                <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                  <Trophy className="w-3.5 h-3.5 text-[#0987CE]" />
                  <span>
                    Líder / Campeão:{' '}
                    <strong className="text-white">
                      {podium.champion ? formatPairName(podium.champion) : 'Em disputa'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Concluídos: {completedMatches.length}/{matches.length}</span>
                  <span className="text-[#0987CE] font-bold">{tenantName}</span>
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-400 text-center border-t border-[#145A9B]/60 pt-2 font-mono truncate">
              {deepLink}
            </div>
          </div>

          {/* Deep Link URL Box with 1-Click Copy */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Link Direto (Deep Link)</span>
              {copiedLink && (
                <span className="text-xs text-[#12C7BB] font-black flex items-center gap-1">
                  <Check className="w-3 h-3" /> Copiado!
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={deepLink}
                className="flex-1 px-3 py-2 text-xs font-mono bg-[#030B17] border border-[#145A9B] rounded-xl text-slate-200 focus:outline-none focus:border-[#0987CE]"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-[#0987CE] hover:bg-[#0772b0] text-white font-black text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Share Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <MessageCircle className="w-4 h-4 fill-slate-950" />
              Enviar no WhatsApp
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="py-2.5 px-3 rounded-xl bg-[#0B254E] hover:bg-[#0E3570] text-[#0987CE] hover:text-white border border-[#0987CE]/40 font-black text-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              {copiedSummary ? <Check className="w-4 h-4 text-[#12C7BB]" /> : <Copy className="w-4 h-4" />}
              {copiedSummary ? 'Resumo Copiado!' : 'Copiar Texto Resumo'}
            </button>
          </div>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0987CE] to-[#12C7BB] text-slate-950 font-black text-xs cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              Compartilhar no Celular (Instagram, Stories, WhatsApp)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
