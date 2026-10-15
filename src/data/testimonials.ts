/**
 * TESTIMONIOS
 * Solo testimonios REALES, transcritos tal cual (se puede recortar, no reescribir el sentido),
 * con autorización y con la URL de donde salen en `source`.
 *
 * La sección solo se muestra si hay 2 o más testimonios reales en `testimonials`.
 * Ahora mismo está vacía: no se pudo acceder al Instagram de la marca (ver PENDIENTES.md).
 */
export interface Testimonial {
  /** Nombre o nombre + inicial, como haya autorizado la alumna. */
  name: string;
  /** Una línea de contexto: "Madre de dos, trabaja a jornada completa". */
  context: string;
  /** Cita corta para la tarjeta (máx. 30 palabras). */
  quote: string;
  /** Testimonio completo para el "Leer más". */
  full: string;
  /** URL del post, destacado o captura de donde sale. */
  source: string;
}

export const testimonials: Testimonial[] = [];

// EJEMPLO, NO PUBLICAR. Datos ficticios solo para revisar el diseño en local.
// Se muestran únicamente si SHOW_EXAMPLE_TESTIMONIALS es true Y estás en `npm run dev`.
export const SHOW_EXAMPLE_TESTIMONIALS = false;
export const exampleTestimonials: Testimonial[] = [
  {
    name: 'EJEMPLO · Alumna 1',
    context: 'EJEMPLO, NO PUBLICAR',
    quote: 'EJEMPLO, NO PUBLICAR. Texto de relleno para ver cómo queda una cita corta de dos o tres líneas en la tarjeta.',
    full: 'EJEMPLO, NO PUBLICAR. Texto de relleno largo para comprobar cómo se ve el testimonio completo dentro del diálogo al pulsar "Leer más".',
    source: 'EJEMPLO',
  },
  {
    name: 'EJEMPLO · Alumna 2',
    context: 'EJEMPLO, NO PUBLICAR',
    quote: 'EJEMPLO, NO PUBLICAR. Otra cita de relleno para comprobar el carrusel con varias tarjetas.',
    full: 'EJEMPLO, NO PUBLICAR. Otro texto de relleno para el diálogo.',
    source: 'EJEMPLO',
  },
  {
    name: 'EJEMPLO · Alumna 3',
    context: 'EJEMPLO, NO PUBLICAR',
    quote: 'EJEMPLO, NO PUBLICAR. Tercera cita de relleno.',
    full: 'EJEMPLO, NO PUBLICAR. Tercer texto de relleno para el diálogo.',
    source: 'EJEMPLO',
  },
];
