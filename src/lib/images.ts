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

/** Datos del hero, compartidos entre Hero.astro y el preload de index.astro.
 *  Móvil y tablet: foto vertical que cubre de alto (por eso más de 100vw). Escritorio: horizontal a todo el ancho. */
export const HERO = {
  media: '(max-width: 959px)',
  notMedia: '(min-width: 960px)',
  mobileWidths: [480, 720, 1080],
  desktopWidths: [960, 1440, 1920, 2400],
  sizesMobile: '140vw',
  sizesDesktop: '100vw',
  /** Va bajo un velo oscuro: admite algo menos de calidad sin que se note. */
  quality: { avif: 44, webp: 62 },
};
