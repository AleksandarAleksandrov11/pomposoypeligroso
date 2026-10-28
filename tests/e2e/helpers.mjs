// Utilidades comunes de las pruebas de extremo a extremo.
// Todo lo externo está interceptado: Apps Script, /api/lead-capi, el píxel de Meta (sustituido por un fbq espía) y WhatsApp.
import fs from 'node:fs';

export const FIXTURE = JSON.parse(fs.readFileSync(new URL('../fixtures/apps-script-payload.json', import.meta.url), 'utf8'));
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Sustituye a fbevents.js: guarda cada llamada a fbq (y las que ya estaban en cola) con su hora. */
const FBQ_SPY = `(function(){var f=window.fbq;if(!f)return;function rec(a){try{window.__pypRecord(JSON.parse(JSON.stringify(Array.prototype.slice.call(a))))}catch(e){}}var q=f.queue||[];f.callMethod=function(){rec(arguments)};for(var i=0;i<q.length;i++)rec(q[i]);f.queue=[];})();`;

/**
 * Prepara el contexto: devuelve los registros de lo que la página manda fuera.
 * appsScript: 'ok' | 'fail' | 'invalid_name' | 'invalid_phone' | función (n) => respuesta, para cambiarla entre envíos.
 */
export async function setup(context, { appsScript = 'ok' } = {}) {
  const log = { payloads: [], capi: [], fbq: [], navs: [], external: [], appsScriptMode: appsScript };

  await context.exposeBinding('__pypRecord', (_src, args) => log.fbq.push({ t: Date.now(), args }));

  // Cualquier otra salida a internet se corta: las pruebas son herméticas.
  // Playwright prueba las rutas en orden inverso al de registro: esta, la primera, solo actúa si ninguna otra coincide.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    log.external.push(route.request().url());
    return route.abort();
  });

  await context.route('https://script.google.com/**', async (route) => {
    const body = route.request().postData();
    log.payloads.push({ t: Date.now(), body: body ? JSON.parse(body) : null });
    const mode = typeof log.appsScriptMode === 'function' ? log.appsScriptMode(log.payloads.length) : log.appsScriptMode;
    if (mode === 'fail') return route.fulfill({ status: 500, contentType: 'text/html', body: 'Error' });
    if (mode?.startsWith?.('invalid_')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: mode }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await context.route('**/api/lead-capi', async (route) => {
    const req = route.request();
    log.capi.push({ t: Date.now(), body: JSON.parse(req.postData() || 'null'), headers: req.headers() });
    return route.fulfill({ status: 204, body: '' });
  });
  await context.route('https://connect.facebook.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: FBQ_SPY }));
  await context.route('https://www.facebook.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await context.route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//, (route) => {
    log.navs.push({ t: Date.now(), url: route.request().url() });
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>WhatsApp</title><p>WhatsApp</p>' });
  });
  return log;
}

/** Errores de consola y de CSP de la página (para comprobar que no hay ninguno). */
export function watchConsole(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export const fbqEvents = (log, name) => log.fbq.filter((c) => (c.args[0] === 'track' || c.args[0] === 'trackCustom') && c.args[1] === name);

export async function chooseCookies(page, action) {
  await page.locator(`[data-consent-action="${action}"]`).click();
  await page.locator('[data-cookie-banner]').waitFor({ state: 'hidden' });
}

/** Rellena los 4 pasos (sin enviar). */
export async function fillForm(page, { age = 'De 30 a 39', experience = 'Nunca he entrenado', name = 'María José', phone = '612 345 678' } = {}) {
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await page.locator('label.option', { hasText: age }).click();
  await page.locator('[data-step="2"].is-active').waitFor();
  await page.locator('label.option', { hasText: experience }).click();
  await page.locator('[data-step="3"].is-active').waitFor();
  await page.locator('#lf-name').fill(name);
  await page.locator('[data-next-name]').click();
  await page.locator('[data-step="4"].is-active').waitFor();
  await page.locator('#lf-phone').fill(phone);
}

export async function submit(page) {
  await page.locator('[data-submit]').click();
}

export const isMobileProject = (testInfo) => testInfo.project.name === 'movil-instagram';
