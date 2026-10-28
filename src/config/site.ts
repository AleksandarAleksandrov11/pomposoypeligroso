/**
 * CONFIGURACIÓN EDITABLE DE LA LANDING
 * Todo lo que el equipo puede necesitar cambiar está aquí.
 *  - Píxel: si el ID está vacío, no se carga nada de Meta.
 *  - Formulario: si no hay endpoint, en desarrollo simula el envío y lo muestra en consola.
 */
export const SITE = {
  name: 'Pomposo y Peligroso',
  /** Dominio definitivo con https y sin barra final. */
  url: 'https://www.pomposoypeligroso.com',
  /** ID del píxel de Meta (solo números). Vacío = el píxel NO se carga. */
  metaPixelId: '1162548892864094',
  /** URL del Web App de Google Apps Script (termina en /exec). */
  formEndpoint: 'https://script.google.com/macros/s/AKfycbzFifMV_tthy36EBoAiqkljf6n8xunkG4TyZTqCabP8pXFZeCMt_HQMnT_NXx9HrFlD/exec',
  /** WhatsApp que atiende los leads, en formato internacional sin + ni espacios. Confirmado. */
  whatsappNumber: '34644117740',
  whatsappMessage: 'Hola, vengo de la web de Pomposo y Peligroso y quiero información.',
  /** Teléfono. En la web solo se muestra como texto (páginas legales y /gracias), nunca como enlace. */
  phoneDisplay: '+34 644 11 77 40',
  phoneHref: 'tel:+34644117740',
  /** Email e Instagram: solo como texto en las páginas legales y en el JSON-LD de la portada. */
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
    updatedAt: '28 de octubre de 2026',
  },
  /** Mostrar antes/después y caso de Noelia (material facilitado por la marca; ver PENDIENTES.md). */
  showTransformations: true,
  /** Versión del consentimiento de cookies. Súbela si cambian las cookies para volver a preguntar. */
  consentVersion: 1,
} as const;

/** true si el teléfono ya es real. */
export const hasPhone = !SITE.phoneHref.includes('X');

/** Teléfono para mostrar, con espacios de no separación para que no se parta en dos líneas. */
export const phoneText = SITE.phoneDisplay.replace(/ /g, '\u00A0');

/** Enlace de WhatsApp con el mensaje codificado. */
export function whatsappUrl(message: string = SITE.whatsappMessage): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
