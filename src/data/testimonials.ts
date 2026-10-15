/**
 * TESTIMONIOS (fila que se mueve hacia la derecha en "Mujeres normales, cambios reales")
 * Solo testimonios REALES, transcritos tal cual (se puede recortar, no reescribir el sentido),
 * con autorización y con la URL de donde salen en `source`.
 *
 * Con 2 o más testimonios reales en `testimonials` se muestran esos.
 * Mientras no los haya, y si SHOW_TESTIMONIAL_PLACEHOLDERS es true, se ven tarjetas de hueco
 * que dicen claramente "Aquí irá el testimonio real...". No son testimonios inventados.
 * ANTES DE LANZAR ANUNCIOS: añade los reales o pon SHOW_TESTIMONIAL_PLACEHOLDERS en false.
 */
export interface Testimonial {
  /** Nombre o nombre + inicial, como haya autorizado la alumna. */
  name: string;
  /** Una línea de contexto: "Madre de dos, trabaja a jornada completa". */
  context: string;
  /** Cita corta para la tarjeta (máx. 30 palabras). */
  quote: string;
  /** URL del post, destacado o captura de donde sale. */
  source: string;
}

export const testimonials: Testimonial[] = [];

/** Huecos de diseño mientras no haya testimonios reales. */
export const SHOW_TESTIMONIAL_PLACEHOLDERS = true;
export const testimonialPlaceholders: Testimonial[] = [
  'Aquí irá el testimonio real de una alumna: cómo estaba antes de empezar.',
  'Aquí irá otro testimonio real: qué ha cambiado en sus 12 semanas.',
  'Aquí irá un testimonio real sobre el seguimiento de cada semana.',
  'Aquí irá un testimonio real sobre comer sin dietas.',
  'Aquí irá un testimonio real sobre cómo se siente ahora.',
  'Aquí irá un testimonio real, con sus propias palabras.',
].map((quote) => ({ name: 'Nombre de la alumna', context: 'Testimonio por añadir', quote, source: '' }));
