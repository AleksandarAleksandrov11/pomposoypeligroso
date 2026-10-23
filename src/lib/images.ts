import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/** Todas las fotos se sirven en WebP: lo leen todos los navegadores actuales y se decodifica más rápido que AVIF. */
export const DEFAULT_QUALITY = 66;

export function clampWidths(img: ImageMetadata, ws: number[]) {
  const valid = ws.filter((w) => w <= img.width);
  return valid.length ? valid : [img.width];
}

/** Genera el srcset WebP de una imagen (mismos parámetros en <Pic> y en el preload del hero). */
export async function buildSources(img: ImageMetadata, ws: number[], quality = DEFAULT_QUALITY) {
  const list = clampWidths(img, ws);
  const webp = await getImage({ src: img, widths: list, format: 'webp', quality });
  const largest = list[list.length - 1];
  const height = Math.round((img.height / img.width) * largest);
  return { webp, width: largest, height, list };
}

/** Datos del hero, compartidos entre Hero.astro y el preload de index.astro.
 *  Móvil y tablet: foto vertical que cubre de alto (por eso más de 100vw; va bajo un velo, así que 120vw basta).
 *  Escritorio: horizontal a todo el ancho. */
export const HERO = {
  media: '(max-width: 959px)',
  notMedia: '(min-width: 960px)',
  mobileWidths: [480, 720, 900, 1080],
  desktopWidths: [960, 1440, 1920, 2400],
  sizesMobile: '110vw',
  sizesDesktop: '100vw',
  /** Va bajo un velo oscuro: admite algo menos de calidad sin que se note y pesa menos (carga antes). */
  quality: 60,
};
