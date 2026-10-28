/**
 * POST /api/lead-capi: envía el Lead a la API de conversiones de Meta desde el servidor (función de Vercel).
 *
 * El navegador la llama solo después de que el Apps Script haya guardado el lead (ok: true), con el
 * mismo event_id que el Lead del píxel, para que Meta los deduplique.
 *
 * Variables de entorno (Vercel, Settings, Environment Variables):
 *  - META_CAPI_TOKEN: token de acceso de la API de conversiones. Sin él no se envía nada (204).
 *  - META_PIXEL_ID: opcional, por defecto 1162548892864094.
 *  - META_TEST_EVENT_CODE: opcional, solo mientras se prueba en "Probar eventos".
 *
 * A la usuaria nunca le llega un error de Meta: la respuesta es 204 tanto si Meta acepta el evento
 * como si falla (el resultado queda en el log de Vercel).
 */
import { DEFAULT_PIXEL_ID, buildEvent, clientIp, isSameOrigin, sendToMeta, validateInput } from './_lib/capi.js';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res, { fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    return res.end();
  }
  const headers = req.headers ?? {};
  if (!isSameOrigin(headers)) {
    res.statusCode = 403;
    return res.end();
  }
  const check = validateInput(readBody(req));
  if (!check.ok) {
    res.statusCode = 400;
    return res.end();
  }

  const token = env.META_CAPI_TOKEN;
  if (!token) {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const event = buildEvent(check.lead, {
      ip: clientIp(headers),
      userAgent: String(headers['user-agent'] ?? '').slice(0, 500),
      now: now(),
    });
    const result = await sendToMeta(event, {
      token,
      pixelId: env.META_PIXEL_ID || DEFAULT_PIXEL_ID,
      testEventCode: env.META_TEST_EVENT_CODE || '',
      fetchImpl,
    });
    if (result.ok) console.log(`[lead-capi] Meta ${result.status} ${result.body}`);
    else console.error(`[lead-capi] Meta respondió ${result.status}: ${result.body}`);
  } catch (err) {
    console.error('[lead-capi] Error inesperado', err);
  }
  res.statusCode = 204;
  return res.end();
}
