/**
 * API de conversiones de Meta: lógica pura de la función /api/lead-capi (validación, hashes y evento).
 * Sin dependencias: solo node:crypto. Se prueba en tests/unit/capi.test.mjs.
 * Los archivos que empiezan por "_" dentro de api/ no se publican como funciones en Vercel.
 */
import { createHash } from 'node:crypto';

/** Versión de la Graph API vigente según https://developers.facebook.com/docs/graph-api/changelog (v26.0, 29/07/2026). */
export const GRAPH_API_VERSION = 'v26.0';
export const DEFAULT_PIXEL_ID = '1162548892864094';
export const META_TIMEOUT_MS = 5000;

const AGE_OPTIONS = ['Menos de 30', 'De 30 a 39', 'De 40 a 49', 'De 50 a 59', '60 o más'];
const EXPERIENCE_OPTIONS = ['Nunca he entrenado', 'Menos de 1 año', 'Entre 1 y 2 años', 'Entre 2 y 3 años', 'Más de 3 años'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Misma tabla que COUNTRY_BY_PREFIX de src/lib/lead.ts (una prueba comprueba que coinciden). */
export const COUNTRY_BY_PREFIX = {
  34: 'es',
  351: 'pt',
  33: 'fr',
  39: 'it',
  49: 'de',
  44: 'gb',
  52: 'mx',
  54: 'ar',
  57: 'co',
  56: 'cl',
  58: 've',
  593: 'ec',
  51: 'pe',
};

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function countryFromDigits(digits) {
  const codes = Object.keys(COUNTRY_BY_PREFIX).sort((a, b) => b.length - a.length);
  const code = codes.find((c) => digits.startsWith(c));
  return code ? COUNTRY_BY_PREFIX[code] : null;
}

export function firstNameForMatching(name) {
  const first = String(name).trim().replace(/\s+/g, ' ').split(' ')[0] ?? '';
  return first.toLocaleLowerCase('es').replace(/[^\p{L}]/gu, '');
}

const str = (v, max) => (typeof v === 'string' && v.length <= max ? v.trim() : '');

/**
 * Valida y limita lo que manda el navegador. Devuelve { ok: true, lead } o { ok: false, error }.
 * Los campos opcionales que no cumplen el formato se descartan en vez de rechazar el evento.
 */
export function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'invalid_body' };
  const eventId = str(body.event_id, 64);
  if (!UUID_RE.test(eventId)) return { ok: false, error: 'invalid_event_id' };
  const phone = str(body.phone, 20);
  if (!/^\+\d{7,16}$/.test(phone)) return { ok: false, error: 'invalid_phone' };
  const name = str(body.name, 60);
  const age = str(body.age_range, 40);
  const experience = str(body.experience, 40);
  const fbc = str(body.fbc, 500);
  const fbp = str(body.fbp, 200);
  const fbclid = str(body.fbclid, 500);
  const url = str(body.event_source_url, 2000);
  return {
    ok: true,
    lead: {
      event_id: eventId,
      phone,
      name,
      age_range: AGE_OPTIONS.includes(age) ? age : '',
      experience: EXPERIENCE_OPTIONS.includes(experience) ? experience : '',
      fbc: /^fb\.\d\.\d{10,13}\.[\w-]+$/.test(fbc) ? fbc : '',
      fbp: /^fb\.\d\.\d{10,13}\.\d+$/.test(fbp) ? fbp : '',
      fbclid: /^[\w-]+$/.test(fbclid) ? fbclid : '',
      event_source_url: /^https?:\/\//.test(url) ? url : '',
    },
  };
}

/** Evento Lead de la API de conversiones. now en milisegundos. */
export function buildEvent(lead, { ip = '', userAgent = '', now = Date.now() } = {}) {
  const nowSec = Math.floor(now / 1000);
  const digits = lead.phone.replace(/\D/g, '');
  const userData = { ph: [sha256(digits)] };
  const fn = firstNameForMatching(lead.name);
  if (fn) userData.fn = [sha256(fn)];
  const country = countryFromDigits(digits);
  if (country) userData.country = [sha256(country)];
  // Sin _fbc del píxel (sin consentimiento), se construye con el fbclid que llega en la URL del anuncio
  const fbc = lead.fbc || (lead.fbclid ? `fb.1.${now}.${lead.fbclid}` : '');
  if (fbc) userData.fbc = fbc;
  if (lead.fbp) userData.fbp = lead.fbp;
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  const customData = { content_name: 'Formulario Pomposo' };
  if (lead.age_range) customData.age_range = lead.age_range;
  if (lead.experience) customData.experience = lead.experience;

  const event = {
    event_name: 'Lead',
    event_time: nowSec,
    event_id: lead.event_id,
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
  };
  if (lead.event_source_url) event.event_source_url = lead.event_source_url;
  return event;
}

/** Primera IP de x-forwarded-for (la del navegador). */
export function clientIp(headers) {
  const xff = String(headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return xff || String(headers['x-real-ip'] ?? '').trim();
}

/** Solo peticiones del propio dominio: el Origin (o, si falta, el Referer) tiene que ser el mismo host. */
export function isSameOrigin(headers) {
  const host = String(headers['x-forwarded-host'] ?? headers.host ?? '').toLowerCase();
  const from = String(headers.origin ?? headers.referer ?? '');
  if (!host || !from) return false;
  try {
    return new URL(from).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/** Envía el evento a Meta. Nunca lanza: devuelve { ok, status, body }. */
export async function sendToMeta(event, { token, pixelId = DEFAULT_PIXEL_ID, testEventCode = '', fetchImpl = fetch } = {}) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`;
  const payload = { data: [event], access_token: token };
  if (testEventCode) payload.test_event_code = testEventCode;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
    });
    const body = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
  } catch (err) {
    return { ok: false, status: 0, body: String(err && err.message ? err.message : err).slice(0, 500) };
  }
}
