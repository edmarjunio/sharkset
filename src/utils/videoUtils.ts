/**
 * Utilitários para detecção e incorporação de fontes de vídeo,
 * com suporte completo a transmissões do YouTube e streams HTTPS/HLS diretos.
 */

export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?(?:.*&)?v=)([^&#]+)/i);
  if (watchMatch?.[1]) return watchMatch[1];

  // youtube.com/live/ID
  const liveMatch = trimmed.match(/(?:youtube\.com\/live\/)([^?&#]+)/i);
  if (liveMatch?.[1]) return liveMatch[1];

  // youtu.be/ID
  const shortMatch = trimmed.match(/(?:youtu\.be\/)([^?&#]+)/i);
  if (shortMatch?.[1]) return shortMatch[1];

  // youtube.com/embed/ID
  const embedMatch = trimmed.match(/(?:youtube\.com\/embed\/)([^?&#]+)/i);
  if (embedMatch?.[1]) return embedMatch[1];

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function getYouTubeEmbedUrl(url: string, options: { autoplay?: boolean; muted?: boolean } = {}): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  const autoplay = options.autoplay !== false ? '1' : '0';
  const mute = options.muted !== false ? '1' : '0';
  return `https://www.youtube.com/embed/${id}?autoplay=${autoplay}&mute=${mute}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;
}
