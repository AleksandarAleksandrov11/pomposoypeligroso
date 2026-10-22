/**
 * CONFIGURACIÓN EDITABLE DE LA LANDING
 * Todo lo que el equipo puede necesitar cambiar está aquí.
 * Mientras un valor esté PENDIENTE, la web funciona igual:
 *  - WhatsApp: si el número es el de ejemplo, se ocultan todos los botones de WhatsApp.
 *  - Píxel: si el ID está vacío, no se carga nada de Meta.
 *  - Formulario: si no hay endpoint, en desarrollo simula el envío y lo muestra en consola.
 */
export const SITE = {
  name: 'Pomposo y Peligroso',
  /** Dominio definitivo con https y sin barra final. PENDIENTE. */
  url: 'https://PENDIENTE-DOMINIO',
  /** ID del píxel de Meta (solo números). Vacío = el píxel NO se carga. PENDIENTE. */
  metaPixelId: '',
  /** URL del Web App de Google Apps Script (termina en /exec). PENDIENTE. */
  formEndpoint: '',
  /** WhatsApp en formato internacional, sin + ni espacios (ej. 34612345678). PENDIENTE. */
  whatsappNumber: '34XXXXXXXXX',
  whatsappMessage: 'Hola, vengo de la web de Pomposo y Peligroso y quiero información.',
  /** Teléfono visible y enlace tel:. PENDIENTE. */
  phoneDisplay: '+34 XXX XXX XXX',
  phoneHref: 'tel:+34XXXXXXXXX',
  email: 'info@themonkeyscommunity.com',
  instagram: 'https://www.instagram.com/pomposoypeligrosotmc/',
  instagramHandle: '@pomposoypeligrosotmc',
  legal: {
    company: 'The Monkeys Centro de Entrenamiento S.L.',
    cif: 'B10618163',
    address: 'Miquel Servet, 14, 08850 Gavà, Barcelona',
    /** Datos del Registro Mercantil de Barcelona (tomo, folio, hoja). PENDIENTE. */
    registry: '',
    /** Fecha de la última revisión de los textos legales. */
    updatedAt: '15 de octubre de 2026',
  },
  /** Mostrar antes/después y caso de Noelia (material facilitado por la marca; ver PENDIENTES.md). */
  showTransformations: true,
  /** Versión del consentimiento de cookies. Súbela si cambian las cookies para volver a preguntar. */
  consentVersion: 1,
} as const;

/** true si el número de WhatsApp ya es real (no el de ejemplo). */
export const hasWhatsApp = /^\d{8,15}$/.test(SITE.whatsappNumber);

/** true si el teléfono ya es real. */
export const hasPhone = !SITE.phoneHref.includes('X');

/** Teléfono para mostrar, con espacios de no separación para que no se parta en dos líneas. */
export const phoneText = SITE.phoneDisplay.replace(/ /g, '\u00A0');

/** Enlace de WhatsApp con el mensaje codificado. */
export function whatsappUrl(message: string = SITE.whatsappMessage): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
