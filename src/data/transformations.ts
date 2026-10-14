/**
 * TRANSFORMACIONES (antes/después) de alumnas.
 * Solo se muestran si SITE.showTransformations = true en src/config/site.ts,
 * y SOLO con autorización escrita de cada alumna.
 *
 * Para activarlas:
 *  1. Guarda las fotos en src/assets/img/transformaciones/ (ej. noelia-antes-despues.jpg).
 *  2. Impórtalas aquí y asígnalas al campo `image`.
 *  3. Pon SITE.showTransformations = true.
 * Una transformación sin `image` no se pinta.
 */
import type { ImageMetadata } from 'astro';

export interface Transformation {
  name: string;
  line: string;
  image?: ImageMetadata;
  alt?: string;
}

/** Caso destacado. PENDIENTE: autorización y fotos. No mencionar su cuenta ni seguidores sin permiso. */
export const featured: Transformation = {
  name: 'Noelia',
  line: 'Noelia ha perdido unos 15 kg durante su proceso. Trabaja, tiene su vida y no ha vivido en el gimnasio.',
  image: undefined,
  alt: 'Antes y después de Noelia',
};

/** PENDIENTE: autorización, fotos y una línea real de cada una. */
export const transformations: Transformation[] = [
  { name: 'Ana Pino', line: '', image: undefined },
  { name: 'Alexandra', line: '', image: undefined },
  { name: 'Judith', line: '', image: undefined },
  { name: 'Andrea', line: '', image: undefined },
];
