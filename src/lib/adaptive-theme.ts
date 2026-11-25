'use client';

export type AdaptiveThemeName = 'crimson' | 'azure' | 'violet' | 'emerald' | 'amber';

function rgbToHue(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h, s, l };
}

function mapHueToTheme(h: number, s: number): AdaptiveThemeName {
  if (s < 0.14) return 'violet';
  if (h < 25 || h >= 330) return 'crimson';
  if (h >= 25 && h < 65) return 'amber';
  if (h >= 65 && h < 170) return 'emerald';
  if (h >= 170 && h < 255) return 'azure';
  return 'violet';
}

export async function extractThemeFromImage(proxiedImageUrl: string): Promise<AdaptiveThemeName> {
  if (!proxiedImageUrl || typeof window === 'undefined') return 'violet';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve('violet'), 2500);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('violet');

        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let bestScore = -1;
        let bestTheme: AdaptiveThemeName = 'violet';

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const { h, s, l } = rgbToHue(r, g, b);
          // Favor saturated mid-tones, ignore near-black/near-white
          if (l < 0.12 || l > 0.88) continue;
          const score = s * (1 - Math.abs(l - 0.5));
          if (score > bestScore) {
            bestScore = score;
            bestTheme = mapHueToTheme(h, s);
          }
        }

        resolve(bestTheme);
      } catch {
        resolve('violet');
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve('violet');
    };

    img.src = proxiedImageUrl;
  });
}

export function applyAdaptiveTheme(theme: AdaptiveThemeName): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}
