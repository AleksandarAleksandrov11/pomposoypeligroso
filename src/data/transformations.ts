/**
 * ANTES Y DESPUÉS de alumnas reales (material facilitado por Pomposo y Peligroso).
 * Cada imagen de `src/assets/img/antes-despues/` lleva el antes a la izquierda y el después a la derecha.
 * Las alumnas que pidieron no mostrar la cara (Claudia, Gloria, Cris G. y Anna S.) salen de espaldas.
 * Para añadir una: guarda la imagen (1320 x 880, antes | después) y añade una entrada.
 */
import type { ImageMetadata } from 'astro';
import noelia from '../assets/img/antes-despues/noelia.jpg';
import annaPino from '../assets/img/antes-despues/anna-pino.jpg';
import crisS from '../assets/img/antes-despues/cris-s.jpg';
import ainhoa from '../assets/img/antes-despues/ainhoa.jpg';
import ariadna from '../assets/img/antes-despues/ariadna.jpg';
import marina from '../assets/img/antes-despues/marina.jpg';
import alba from '../assets/img/antes-despues/alba.jpg';
import claudia from '../assets/img/antes-despues/claudia.jpg';
import gloria from '../assets/img/antes-despues/gloria.jpg';
import lucia from '../assets/img/antes-despues/lucia.jpg';
import crisG from '../assets/img/antes-despues/cris-g.jpg';
import annaS from '../assets/img/antes-despues/anna-s.jpg';
import judith from '../assets/img/antes-despues/judith.jpg';
import montse from '../assets/img/antes-despues/montse.jpg';

export interface Transformation {
  name: string;
  /** Resultado en una línea, con datos reales de su seguimiento. */
  line: string;
  image: ImageMetadata;
  alt: string;
}

/** Caso destacado: Noelia (datos de su ficha de seguimiento). */
export const featured = {
  name: 'Noelia',
  image: noelia,
  alt: 'Noelia antes y después de 6 meses de programa, de frente',
  stats: [
    { n: '−15 kg', t: 'de 85 a 70 kg' },
    { n: '−17 cm', t: 'de cintura' },
    { n: '−2', t: 'tallas de pantalón' },
    { n: '6', t: 'meses' },
  ],
  quote:
    'He vuelto a disfrutar de comer bien y de entrenar. Me siento mucho mejor conmigo misma y he conseguido que cuidarme forme parte de mi día a día.',
};

export const transformations: Transformation[] = [
  { name: 'Ariadna', line: '“Hacía años que no me gustaba lo que veía en el espejo”', image: ariadna, alt: 'Ariadna antes y después, de frente' },
  { name: 'Cris S.', line: 'Volvió a su peso de antes del embarazo', image: crisS, alt: 'Cris antes y después, de espaldas' },
  { name: 'Claudia', line: 'De 73 a 66,3 kg', image: claudia, alt: 'Claudia antes y después, de espaldas' },
  { name: 'Anna P.', line: '“El cambio ha sido brutal”', image: annaPino, alt: 'Anna antes y después, de espaldas' },
  { name: 'Anna S.', line: 'De 86,9 a 79 kg', image: annaS, alt: 'Anna antes y después, de espaldas' },
  { name: 'Ainhoa', line: 'Más fuerte y la ropa le sienta mejor', image: ainhoa, alt: 'Ainhoa antes y después, de espaldas' },
  { name: 'Gloria', line: 'De 70 a 65,4 kg', image: gloria, alt: 'Gloria antes y después, de espaldas' },
  { name: 'Marina', line: 'Cintura de 78 a 71,8 cm', image: marina, alt: 'Marina antes y después, de espaldas' },
  { name: 'Lucía', line: 'De 82,1 a 76,5 kg', image: lucia, alt: 'Lucía antes y después, de frente sin la cara' },
  { name: 'Cris G.', line: 'De 69,1 a 65 kg', image: crisG, alt: 'Cris antes y después, de espaldas' },
  { name: 'Alba', line: 'Más definida y más fuerte', image: alba, alt: 'Alba antes y después, de espaldas' },
  { name: 'Judith', line: 'Más intensidad y más carga en cada sesión', image: judith, alt: 'Judith antes, en la playa, y después, en el gimnasio' },
  { name: 'Montse', line: '“Hasta me enamoré de mis hombros”', image: montse, alt: 'Montse antes y después' },
];
