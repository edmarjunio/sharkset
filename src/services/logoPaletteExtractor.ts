import { ArenaBrandPalette } from '../types';

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Extracts a cohesive, high-contrast ArenaBrandPalette from any uploaded Logo image URL or DataURL.
 */
export async function extractPaletteFromLogoImage(imageUrl: string): Promise<ArenaBrandPalette> {
  return new Promise((resolve) => {
    const fallbackPalette: ArenaBrandPalette = {
      primary: '#EA580C',
      secondary: '#0284C7',
      accent: '#F97316',
      headerBg: '#0F172A',
      surfaceBg: '#FFF7ED',
      textOnPrimary: '#FFFFFF',
      paletteName: 'Paleta Extraída da Logo',
    };

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 64;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(fallbackPalette);
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;

          // Bucket colors into 12 hue buckets (30 deg each) weighted by saturation
          const buckets: { count: number; r: number; g: number; b: number; h: number; s: number }[] =
            Array.from({ length: 12 }, () => ({ count: 0, r: 0, g: 0, b: 0, h: 0, s: 0 }));

          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 110) continue; // Ignore transparent pixels
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const { h, s, l } = rgbToHsl(r, g, b);
            // Ignore near-white and near-black background pixels
            if (l < 0.12 || l > 0.9 || s < 0.18) continue;

            const bucketIdx = Math.min(11, Math.floor(h / 30));
            const weight = 1 + s * 2;
            buckets[bucketIdx].count += weight;
            buckets[bucketIdx].r += r * weight;
            buckets[bucketIdx].g += g * weight;
            buckets[bucketIdx].b += b * weight;
            buckets[bucketIdx].h += h * weight;
            buckets[bucketIdx].s += s * weight;
          }

          const sorted = [...buckets]
            .filter((b) => b.count > 0)
            .sort((a, b) => b.count - a.count);

          if (sorted.length === 0) {
            resolve(fallbackPalette);
            return;
          }

          const dom = sorted[0];
          const domHue = dom.h / dom.count;
          const domSat = Math.max(0.65, Math.min(0.92, dom.s / dom.count));
          const primaryHex = rgbToHex(dom.r / dom.count, dom.g / dom.count, dom.b / dom.count);

          const sec = sorted[1] || sorted[0];
          const secHue = sorted[1] ? sec.h / sec.count : (domHue + 40) % 360;
          const secondaryHex = sorted[1]
            ? rgbToHex(sec.r / sec.count, sec.g / sec.count, sec.b / sec.count)
            : hslToHex(secHue, domSat, 0.45);

          const accentHex = hslToHex(domHue, Math.min(0.95, domSat + 0.1), 0.52);
          const headerBg = hslToHex(domHue, 0.55, 0.13);
          const surfaceBg = hslToHex(domHue, 0.45, 0.96);

          resolve({
            primary: primaryHex,
            secondary: secondaryHex,
            accent: accentHex,
            headerBg,
            surfaceBg,
            textOnPrimary: '#FFFFFF',
            paletteName: 'Paleta Automática da Logo',
          });
        } catch {
          resolve(fallbackPalette);
        }
      };
      img.onerror = () => resolve(fallbackPalette);
      img.src = imageUrl;
    } catch {
      resolve(fallbackPalette);
    }
  });
}
