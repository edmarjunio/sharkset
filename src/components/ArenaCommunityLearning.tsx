import React, { useState } from 'react';
import { TenantConfig, SportType } from '../types';
import {
  Video,
  Play,
  Share2,
  Plus,
  Sparkles,
  GraduationCap,
  Flame,
  Check,
  Filter,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';

export interface ArenaVideoItem {
  id: string;
  title: string;
  coachName: string;
  category: 'fundamentos' | 'ataque' | 'defesa' | 'tatico' | 'regras';
  sport: SportType;
  duration: string;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  views: number;
  uploadedAt: string;
}

const INITIAL_ARENA_VIDEOS: Record<string, ArenaVideoItem[]> = {
  default: [],
};

function getPlayableVideoSource(url: string): { kind: 'youtube' | 'file'; src: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

    const host = parsed.hostname.toLowerCase();
    const isYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host);
    if (isYouTube || host === 'youtu.be' || host === 'www.youtu.be') {
      const id = host.includes('youtu.be')
        ? parsed.pathname.split('/').filter(Boolean)[0]
        : parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
    }

    if (/\.(mp4|webm|ogg)$/i.test(parsed.pathname)) return { kind: 'file', src: parsed.href };
    return null;
  } catch {
    return null;
  }
}

interface ArenaCommunityLearningProps {
  tenant: TenantConfig;
}

export const ArenaCommunityLearning: React.FC<ArenaCommunityLearningProps> = ({ tenant }) => {
  const [videos, setVideos] = useState<ArenaVideoItem[]>(() => {
    return INITIAL_ARENA_VIDEOS[tenant.id] || INITIAL_ARENA_VIDEOS.default;
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [selectedVideo, setSelectedVideo] = useState<ArenaVideoItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Video Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCoach, setNewCoach] = useState('');
  const [newCategory, setNewCategory] = useState<'fundamentos' | 'ataque' | 'defesa' | 'tatico' | 'regras'>('fundamentos');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const filteredVideos = videos.filter((v) => {
    if (categoryFilter === 'todos') return true;
    return v.category === categoryFilter;
  });

  const handleShareWhatsApp = (video: ArenaVideoItem) => {
    const text = `🔥 Confira essa aula exclusiva da ${tenant.name}!\n\n"${video.title}" com ${video.coachName}.\n\nAssista na plataforma oficial SHARKSET da Arena: https://sharkset.app`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyLink = (video: ArenaVideoItem) => {
    navigator.clipboard.writeText(`https://sharkset.app?arena=${tenant.id}&video=${video.id}`);
    setCopiedId(video.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    const playableSource = getPlayableVideoSource(newVideoUrl.trim());
    if (!newTitle.trim() || !newCoach.trim() || !playableSource) return;

    const newVid: ArenaVideoItem = {
      id: `vid-${Date.now()}`,
      title: newTitle,
      coachName: newCoach,
      category: newCategory,
      sport: 'futevolei',
      duration: '4:00',
      videoUrl: playableSource.src,
      thumbnailUrl: '',
      description: newDesc.trim(),
      views: 0,
      uploadedAt: new Date().toISOString(),
    };

    setVideos((prev) => [newVid, ...prev]);
    setShowAddModal(false);
    setNewTitle('');
    setNewCoach('');
    setNewDesc('');
    setNewVideoUrl('');
  };

  const categories = [
    { id: 'todos', label: 'Todos os Vídeos' },
    { id: 'fundamentos', label: 'Fundamentos' },
    { id: 'ataque', label: 'Ataque & Shark Attack' },
    { id: 'defesa', label: 'Defesa & Amortecimento' },
    { id: 'tatico', label: 'Tático & Posicionamento' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="aquarium-glass bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                COMUNIDADE & APRENDIZADO · {tenant.name.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Vídeos & Treinamentos da Arena</span>
              <GraduationCap className="w-6 h-6 text-amber-400 shrink-0" />
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Conteúdos gravados e selecionados pelos professores e técnicos da {tenant.name} para acelerar a evolução técnica e tática dos atletas e alunos da nossa comunidade.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Enviar Vídeo de Treino</span>
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const isActive = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/15 border border-white/10'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVideos.map((video) => (
          <div
            key={video.id}
            className="aquarium-glass bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all group shadow-md"
          >
            {/* Thumbnail */}
            <div
              className="relative aspect-video w-full bg-slate-900 cursor-pointer overflow-hidden"
              onClick={() => setSelectedVideo(video)}
            >
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : <div className="w-full h-full flex items-center justify-center text-slate-500" aria-label="Sem miniatura"><Play className="w-8 h-8" /></div>}
              <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-colors flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-cyan-500/90 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-slate-950 translate-x-0.5" />
                </div>
              </div>
              {video.duration && <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-white font-mono font-bold text-[10px]">{video.duration}</span>}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                {video.category}
              </span>
            </div>

            {/* Video Info */}
            <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
              <div>
                <h3
                  onClick={() => setSelectedVideo(video)}
                  className="font-black text-sm text-white hover:text-cyan-400 cursor-pointer transition-colors line-clamp-2 leading-tight"
                >
                  {video.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {video.description}
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  {video.coachName}
                </span>
                <span>{video.views} visualizações</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-3 pt-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedVideo(video)}
                className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>Assistir Aula</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareWhatsApp(video)}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
                title="Encaminhar no WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleCopyLink(video)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Copiar Link"
              >
                {copiedId === video.id ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-950 border border-cyan-500/40 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-4">
            <div className="relative aspect-video w-full bg-black">
              {/* Responsive embedded media player */}
              {getPlayableVideoSource(selectedVideo.videoUrl)?.kind === 'youtube' ? (
                <iframe
                  src={getPlayableVideoSource(selectedVideo.videoUrl)!.src}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : getPlayableVideoSource(selectedVideo.videoUrl)?.kind === 'file' ? (
                <video src={getPlayableVideoSource(selectedVideo.videoUrl)!.src} controls className="w-full h-full" />
              ) : <p className="p-8 text-center text-slate-300">O endereço deste vídeo não é compatível.</p>}
            </div>

            <div className="p-5 pt-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                    {selectedVideo.category}
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    {selectedVideo.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Instrutor: <strong className="text-white">{selectedVideo.coachName}</strong> · {tenant.name}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(selectedVideo)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Compartilhar no WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVideo(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedVideo.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add New Video Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">
                  Adicionar Vídeo de Aprendizado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVideo} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título da Dica ou Treinamento:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Saque Chapado na Areia com Vento"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Professor / Instrutor:
                  </label>
                  <input
                    type="text"
                    required
                    value={newCoach}
                    onChange={(e) => setNewCoach(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Categoria:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="fundamentos">Fundamentos</option>
                    <option value="ataque">Ataque</option>
                    <option value="defesa">Defesa</option>
                    <option value="tatico">Tático</option>
                    <option value="regras">Regras</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Link do Vídeo (YouTube ou MP4):
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Breve Descrição ou Dicas Práticas:
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva o foco do exercício, erros comuns e como praticar na arena..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer shadow-md"
                >
                  Publicar Vídeo na Arena
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
