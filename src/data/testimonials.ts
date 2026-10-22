/**
 * TESTIMONIOS REALES de alumnas (fila que se mueve hacia la derecha en "Mujeres normales, cambios reales").
 * Transcritos de sus textos, de los formularios de seguimiento y de sus mensajes (material facilitado por
 * Pomposo y Peligroso). Se pueden recortar, pero no reescribir el sentido. Máximo unas 35 palabras.
 */
export interface Testimonial {
  /** Nombre como aparece en la web (solo el nombre, o nombre + inicial si se repite). */
  name: string;
  /** Una línea de contexto: resultado o situación. */
  context: string;
  quote: string;
  /** De dónde sale el texto (carpeta del Drive). */
  source: string;
}

export const testimonials: Testimonial[] = [
  {
    name: 'Noelia',
    context: '−15 kg en 6 meses',
    quote: 'Lo que más me gusta del método es que te acompañan muchísimo, especialmente al principio, cuando más cuesta crear nuevos hábitos.',
    source: 'Drive · Noelia Backery / Testimonio',
  },
  {
    name: 'Coralie',
    context: '43 años · de 89 a 85 kg',
    quote: 'Tengo tres hijas y poco tiempo, pero hoy estoy en la mejor forma física que he logrado en años.',
    source: 'Drive · Coralie Demonty / Cambio',
  },
  {
    name: 'Alexandra',
    context: 'Más fuerza y más disciplina',
    quote: 'Te lo ponen muy fácil, el trato es muy personalizado y se adaptan a tus necesidades, preferencias e incluso a posibles lesiones. Sientes que hay un seguimiento real.',
    source: 'Drive · Alexandra Bernat / Testimonio',
  },
  {
    name: 'Cris G.',
    context: '30 años · de 69,1 a 65 kg',
    quote: 'Tras probar muchas dietas y tipos de entreno, con el programa he logrado el mejor resultado físico de mi vida.',
    source: 'Drive · Cris García / Cambio',
  },
  {
    name: 'Carlota',
    context: 'Sin pasar hambre ni ansiedad por la comida',
    quote: 'Si tuviera que destacar algo, sería el acompañamiento y saber que tienes a alguien detrás para resolver dudas o ayudarte cuando lo necesitas.',
    source: 'Drive · Carlota Leandres / Testimonio',
  },
  {
    name: 'Anna S.',
    context: 'De 86,9 a 79 kg',
    quote: 'Tras 6 meses de plan, mi cuerpo frente al espejo es otro. Y lo mejor de todo es que ahora como más y mejor que antes.',
    source: 'Drive · Anna Serrano / mensaje',
  },
  {
    name: 'Andrea',
    context: 'Aprendió a progresar en los pesos',
    quote: 'Con Pomposo y Peligroso aprendí a entrenar con más sentido y a ir progresando. Ahora me miro al espejo y veo los resultados.',
    source: 'Drive · Andrea Jara / Testimonio',
  },
  {
    name: 'Lorena',
    context: '−2,3 kg de grasa',
    quote: 'Ahora estoy mejor físicamente que antes de ser madre.',
    source: 'Drive · Lorena Iglesias / Cambio',
  },
  {
    name: 'Liliam',
    context: 'Más definición y más masa muscular',
    quote: 'En pocos meses vi cambios muy notables a nivel de definición, gané masa muscular y energía en los entrenos. ¡Conseguí el objetivo por completo!',
    source: 'Drive · Liliam Corrales / Testimonio',
  },
  {
    name: 'Cris S.',
    context: 'Valoración del programa: 10/10',
    quote: 'Nunca imaginé volver al peso de antes de quedarme embarazada y encima estar mejor física y mentalmente.',
    source: 'Drive · Cris Serrasolsas / formulario de seguimiento',
  },
  {
    name: 'Montse',
    context: 'Del miedo al gimnasio a disfrutarlo',
    quote: 'Empecé a levantar pesos que jamás habría imaginado que podría mover, a verme mucho más definida y hasta me enamoré de mis hombros.',
    source: 'Drive · Montse Navarro / Testimonio',
  },
  {
    name: 'Alice',
    context: 'Madre con poco tiempo',
    quote: 'Acabar de trabajar y tener el entreno preparado para poder ejecutarlo sin romperte la cabeza en pensar por dónde empiezas… ¡No tiene precio!',
    source: 'Drive · Alice Calzas / formulario de seguimiento',
  },
  {
    name: 'Judith',
    context: 'Cambió su forma de entrenar',
    quote: 'Siento que entreno de una forma más inteligente, eficiente y adaptada a mis objetivos, y que cada sesión tiene un propósito claro.',
    source: 'Drive · Judith Carballo / Testimonio',
  },
  {
    name: 'Alba',
    context: 'Más fuerte por dentro y por fuera',
    quote: 'Me siento más fuerte no solo físicamente sino mentalmente, que es lo que más me gusta. Me veo más definida frente al espejo.',
    source: 'Drive · Alba Requejo / mensaje',
  },
  {
    name: 'Gloria',
    context: 'De 70 a 65,4 kg',
    quote: 'Ahora me siento más a gusto conmigo misma, con más motivación y más confianza.',
    source: 'Drive · Gloria Sanfeliu / mensaje',
  },
  {
    name: 'Anna P.',
    context: '4 días de fuerza por semana',
    quote: 'Experiencia de 10. Desde que empezamos en diciembre, el cambio ha sido brutal. A día de hoy me siento fuerte.',
    source: 'Drive · Anna Pino / Testimonio',
  },
  {
    name: 'Lucía',
    context: '6 meses de acompañamiento',
    quote: 'Más allá del resultado físico, me quedo sobre todo con el apoyo, la paciencia y la motivación que me ha dado durante todo este tiempo.',
    source: 'Drive · Lucia Puig / mensaje',
  },
];
