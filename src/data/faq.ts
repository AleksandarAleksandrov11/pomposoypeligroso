/** Preguntas frecuentes. Respuestas de 1 a 3 líneas. */
export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  {
    q: '¿Necesito ir al gimnasio?',
    a: 'No necesariamente. Adaptamos el entrenamiento al material que tengas. Eso sí, con más material, más opciones.',
  },
  {
    q: '¿Cuánto tiempo tengo que dedicarle?',
    a: '3 o 4 días por semana, unos 45 minutos por sesión.',
  },
  {
    q: '¿Tengo que hacer dieta?',
    a: 'No. Trabajamos con raciones y equivalencias para que comas variado y sin prohibiciones.',
  },
  {
    q: 'Nunca he entrenado. ¿Puedo apuntarme?',
    a: 'Sí. El plan se adapta a tu nivel desde el primer día y te explicamos cada ejercicio.',
  },
  {
    q: '¿Es todo online?',
    a: 'Sí. Plan, seguimiento, chat y videollamadas. Lo haces desde donde estés.',
  },
  {
    // PENDIENTE: confirmar si se quiere mostrar el precio en la web.
    q: '¿Cuánto cuesta?',
    a: 'Depende de tu caso. Te lo explicamos en la videollamada, sin compromiso.',
  },
  {
    // PENDIENTE: confirmar el plazo de respuesta.
    q: '¿Qué pasa después de enviar el formulario?',
    a: 'Te escribimos por WhatsApp en menos de 24 horas laborables para agendar una videollamada.',
  },
  {
    // PENDIENTE: confirmar qué ocurre al terminar (renovación, mantenimiento).
    q: '¿Y cuando acaben las 12 semanas?',
    a: 'Puedes seguir con nosotras o continuar por tu cuenta con todo lo que has aprendido.',
  },
  {
    q: 'Tengo más de 50. ¿Es para mí?',
    a: 'Sí. Adaptamos cargas, volumen y nutrición a tu momento. Si tienes alguna patología, consúltalo antes con tu médico.',
  },
];
