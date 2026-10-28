/**
 * Funciones puras del formulario de leads (sin import.meta.env ni DOM), para usarlas en el navegador
 * y probarlas en Node (tests/unit/lead.test.mjs).
 *
 * Las reglas de nombre y teléfono son las mismas que aplica el Apps Script (validName_ y validPhone_
 * en apps-script/Code.gs): lo que el navegador da por bueno, el servidor también lo acepta.
 */

export const AGE_OPTIONS = ['Menos de 30', 'De 30 a 39', 'De 40 a 49', 'De 50 a 59', '60 o más'] as const;
export const EXPERIENCE_OPTIONS = ['Nunca he entrenado', 'Menos de 1 año', 'Entre 1 y 2 años', 'Entre 2 y 3 años', 'Más de 3 años'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidv4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/* ---------- Teléfono ---------- */

export function normalizePrefix(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length > 4) return null;
  return `+${digits}`;
}

/** Misma regla que validPhone_() del Apps Script. */
export function isServerValidPhone(phone: string): boolean {
  if (!/^\+\d{7,16}$/.test(phone)) return false;
  if (phone.startsWith('+34')) return /^\+34[6789]\d{8}$/.test(phone);
  return true;
}

/** Devuelve el teléfono en E.164 (+34612345678) o null si no es válido para el formulario y para el servidor. */
export function normalizePhone(prefix: string, raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '');
  const pre = prefix.replace('+', '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    if (digits.startsWith(pre)) digits = digits.slice(pre.length);
  } else if (digits.startsWith('00' + pre)) {
    digits = digits.slice(2 + pre.length);
  } else if (pre === '34' && digits.length === 11 && digits.startsWith('34')) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/\D/g, '');
  if (pre === '34') {
    if (!/^[6789]\d{8}$/.test(digits)) return null;
  } else if (!/^\d{6,15}$/.test(digits)) {
    return null;
  }
  const phone = `+${pre}${digits}`;
  return isServerValidPhone(phone) ? phone : null;
}

/** Solo las cifras del teléfono, con el prefijo y sin "+" (formato de Meta para "ph"). */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * País (ISO 3166-1 alfa-2, en minúsculas) a partir del prefijo. Solo los prefijos del formulario
 * que corresponden a un único país; +1 (EE. UU. y Canadá) y los desconocidos devuelven null.
 * La API de conversiones (api/_lib/capi.js) usa la misma tabla; una prueba comprueba que coinciden.
 */
export const COUNTRY_BY_PREFIX: Record<string, string> = {
  '34': 'es',
  '351': 'pt',
  '33': 'fr',
  '39': 'it',
  '49': 'de',
  '44': 'gb',
  '52': 'mx',
  '54': 'ar',
  '57': 'co',
  '56': 'cl',
  '58': 've',
  '593': 'ec',
  '51': 'pe',
};

export function countryFromPhone(phone: string): string | null {
  const digits = phoneDigits(phone);
  const codes = Object.keys(COUNTRY_BY_PREFIX).sort((a, b) => b.length - a.length);
  const code = codes.find((c) => digits.startsWith(c));
  return code ? COUNTRY_BY_PREFIX[code] : null;
}

/* ---------- Nombre ---------- */

/** Letras que acepta el Apps Script (validName_): hace falta al menos una. */
const SERVER_LETTER_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

/** El nombre tal como viaja al Apps Script: sin espacios de más. */
export function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export type NameProblem = 'short' | 'charset' | null;

/** Misma regla que validName_() del Apps Script; distingue si falta longitud o si faltan letras que el servidor admita. */
export function nameProblem(raw: string): NameProblem {
  const v = cleanName(raw);
  if (v.length < 2 || v.length > 60) return 'short';
  if (!SERVER_LETTER_RE.test(v)) return /\p{L}/u.test(v) ? 'charset' : 'short';
  return null;
}

export function validName(raw: string): boolean {
  return nameProblem(raw) === null;
}

/** Nombre de pila normalizado para Meta ("fn"): primera palabra, en minúsculas y sin signos. */
export function firstNameForMatching(name: string): string {
  const first = cleanName(name).split(' ')[0] ?? '';
  return first.toLocaleLowerCase('es').replace(/[^\p{L}]/gu, '');
}

/* ---------- WhatsApp ---------- */

export interface WhatsAppLead {
  name: string;
  age_range: string;
  experience: string;
  /** Llegó al formulario desde "¿Otra duda?" de las preguntas frecuentes. */
  fromFaq?: boolean;
}

export function whatsappMessage(l: WhatsAppLead): string {
  const text =
    `Hola, soy ${cleanName(l.name)}. Acabo de rellenar el formulario de Pomposo y Peligroso. ` +
    `Edad: ${l.age_range}. Experiencia: ${l.experience}. Quiero información sobre el programa.`;
  return l.fromFaq ? `${text} Tengo una duda: ` : text;
}

export function whatsappErrorMessage(l: WhatsAppLead & { phone: string }): string {
  return (
    `Hola, soy ${cleanName(l.name)}. He intentado rellenar el formulario de Pomposo y Peligroso y no se ha enviado. ` +
    `Mi teléfono: ${l.phone}. Edad: ${l.age_range}. Experiencia: ${l.experience}. Quiero información sobre el programa.`
  );
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/* ---------- Envío al Apps Script ---------- */

export interface AppsScriptFields {
  age_range: string;
  experience: string;
  name: string;
  phone: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  event_id: string;
  website: string;
}

/**
 * Lo que recibe el Apps Script: mismas claves, en el mismo orden y con los mismos valores que antes de
 * los cambios de octubre de 2026 (contrato fijado en tests/fixtures/apps-script-payload.json).
 * No añadas ni quites campos: el Apps Script y la hoja no se tocan.
 */
export function buildAppsScriptPayload(f: AppsScriptFields): AppsScriptFields {
  return {
    age_range: f.age_range,
    experience: f.experience,
    name: f.name,
    phone: f.phone,
    utm_source: f.utm_source,
    utm_medium: f.utm_medium,
    utm_campaign: f.utm_campaign,
    utm_content: f.utm_content,
    utm_term: f.utm_term,
    event_id: f.event_id,
    website: f.website,
  };
}

/** Errores de validación que devuelve el Apps Script (no se reintentan) y el campo al que corresponden. */
export const SERVER_FIELD_ERRORS: Record<string, 'age_range' | 'experience' | 'name' | 'phone'> = {
  invalid_age_range: 'age_range',
  invalid_experience: 'experience',
  invalid_name: 'name',
  invalid_phone: 'phone',
};

/** fbc construido a partir del fbclid de la URL, con el formato de Meta. */
export function fbcFromFbclid(fbclid: string, ts: number): string {
  return `fb.1.${ts}.${fbclid}`;
}
