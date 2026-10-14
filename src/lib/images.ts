import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export const DEFAULT_QUALITY = { avif: 52, webp: 68 };

export function clampWidths(img: ImageMetadata, ws: number[]) {
  const valid = ws.filter((w) => w <= img.width);
  return valid.length ? valid : [img.width];
}

/** Genera los srcset AVIF y WebP de una imagen (mismos parámetros en <picture> y en el preload). */
export async function buildSources(img: ImageMetadata, ws: number[], quality = DEFAULT_QUALITY) {
  const list = clampWidths(img, ws);
  const [avif, webp] = await Promise.all([
    getImage({ src: img, widths: list, format: 'avif', quality: quality.avif }),
    getImage({ src: img, widths: list, format: 'webp', quality: quality.webp }),
  ]);
  const largest = list[list.length - 1];
  const height = Math.round((img.height / img.width) * largest);
  return { avif, webp, width: largest, height, list };
}

/** Datos del hero, compartidos entre Hero.astro y el preload de index.astro. */
export const HERO = {
  media: '(max-width: 959px)',
  notMedia: '(min-width: 960px)',
  widths: [480, 768, 1080],
  sizesMobile: 'calc(100vw - 40px)',
  sizesDesktop: '(min-width: 1180px) 460px, 40vw',
};
