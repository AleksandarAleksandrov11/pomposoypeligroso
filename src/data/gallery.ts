/**
 * CARRUSEL DE FOTOS de la sección "Mujeres normales, cambios reales".
 * Ahora son fotos de entrenamiento (del centro The Monkeys y de Pexels, ver source/stock/CREDITS.md).
 * Para cambiarlas: guarda la foto en src/assets/img/galeria/ (vertical 3:4, mínimo 900 x 1200),
 * cambia el import y el texto alternativo. Funciona con cualquier número de fotos (ideal entre 8 y 14).
 */
import type { ImageMetadata } from 'astro';
import f01 from '../assets/img/galeria/01-sentadilla-goblet.jpg';
import f02 from '../assets/img/galeria/02-press-mancuernas-the-monkeys.jpg';
import f03 from '../assets/img/galeria/03-sentadillas-en-pareja.jpg';
import f04 from '../assets/img/galeria/04-fuerza-con-discos-the-monkeys.jpg';
import f05 from '../assets/img/galeria/05-zancada-con-barra.jpg';
import f06 from '../assets/img/galeria/06-zancadas-aire-libre-the-monkeys.jpg';
import f07 from '../assets/img/galeria/07-zancada-en-esterilla.jpg';
import f08 from '../assets/img/galeria/08-barra-dominadas-the-monkeys.jpg';
import f09 from '../assets/img/galeria/09-sentadilla-con-banda.jpg';
import f10 from '../assets/img/galeria/10-bici-aire-the-monkeys.jpg';
import f11 from '../assets/img/galeria/11-trabajo-en-banco.jpg';
import f12 from '../assets/img/galeria/12-kettlebell-con-entrenador-the-monkeys.jpg';

export interface GalleryPhoto {
  src: ImageMetadata;
  alt: string;
}

export const gallery: GalleryPhoto[] = [
  { src: f01, alt: 'Mujer haciendo una sentadilla con mancuerna en el gimnasio' },
  { src: f02, alt: 'Dos mujeres haciendo press de hombro con mancuernas' },
  { src: f03, alt: 'Dos mujeres haciendo sentadillas una frente a otra' },
  { src: f04, alt: 'Mujeres entrenando abdominales con discos en el centro The Monkeys' },
  { src: f05, alt: 'Mujer haciendo una zancada con barra en el gimnasio' },
  { src: f06, alt: 'Grupo de mujeres haciendo zancadas al aire libre junto al mar' },
  { src: f07, alt: 'Mujer haciendo una zancada con mancuernas sobre una esterilla' },
  { src: f08, alt: 'Mujer colgada de la barra de dominadas' },
  { src: f09, alt: 'Entrenadora guiando a una alumna que hace sentadilla con banda elástica' },
  { src: f10, alt: 'Dos mujeres pedaleando en bicicletas de aire' },
  { src: f11, alt: 'Mujer entrenando sobre un banco en el gimnasio' },
  { src: f12, alt: 'Entrenador ayudando a una alumna con dos kettlebells al aire libre' },
];
