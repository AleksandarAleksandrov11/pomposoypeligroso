// Píxel y API de conversiones: un solo Lead por solicitud, mismo event_id en navegador y servidor, embudo sin repeticiones.
import { test, expect } from '@playwright/test';
import { UUID_RE, setup, chooseCookies, fillForm, submit, fbqEvents, watchConsole } from './helpers.mjs';

const AD_URL = '/?utm_source=ig&utm_medium=paid_social&utm_campaign=DESCUBRIR_TEST&utm_content=video_1&fbclid=IwAR0abc_DEF-123';

test('aceptando cookies: 1 Lead con el mismo event_id que la CAPI y el Apps Script, con coincidencia avanzada', async ({ page, context }) => {
  const log = await setup(context);
  const errors = watchConsole(page);
  await page.goto(AD_URL);
  await chooseCookies(page, 'accept');
  await fillForm(page);
  await submit(page);
  await expect.poll(() => log.capi.length).toBe(1);
  await expect.poll(() => fbqEvents(log, 'Lead').length).toBe(1);

  const eventId = log.payloads[0].body.event_id;
  expect(eventId).toMatch(UUID_RE);
  const lead = fbqEvents(log, 'Lead')[0].args;
  expect(lead[3]).toEqual({ eventID: eventId });
  expect(lead[2]).toMatchObject({ content_name: 'Formulario Pomposo', age_range: 'De 30 a 39', experience: 'Nunca he entrenado' });
  expect(log.capi[0].body.event_id).toBe(eventId);

  // Coincidencia avanzada justo antes del Lead
  const inits = log.fbq.filter((c) => c.args[0] === 'init');
  const matching = inits.find((c) => c.args[2]);
  expect(matching.args[2]).toEqual({ ph: '34612345678', fn: 'maría', country: 'es' });
  expect(log.fbq.indexOf(matching)).toBeLessThan(log.fbq.indexOf(fbqEvents(log, 'Lead')[0]));

  // Lo que recibe la función de la CAPI
  const capi = log.capi[0].body;
  expect(capi).toMatchObject({ name: 'María José', phone: '+34612345678', age_range: 'De 30 a 39', experience: 'Nunca he entrenado', fbclid: 'IwAR0abc_DEF-123' });
  expect(capi.fbc).toMatch(/^fb\.1\.\d{13}\.IwAR0abc_DEF-123$/);
  expect(capi.event_source_url).toContain('fbclid=IwAR0abc_DEF-123');
  expect(log.capi[0].headers['content-type']).toContain('application/json');

  // Embudo
  expect(fbqEvents(log, 'FormStart').length).toBe(1);
  expect(fbqEvents(log, 'FormStep').map((c) => c.args[2].step)).toEqual([1, 2, 3, 4]);
  expect(fbqEvents(log, 'ViewContent').length).toBe(1);
  expect(log.external).toEqual([]);
  expect(errors, 'sin errores de consola ni de CSP').toEqual([]);
});

test('rechazando cookies: 0 eventos de navegador, pero sí la llamada a la CAPI con el fbclid', async ({ page, context }) => {
  const log = await setup(context);
  const errors = watchConsole(page);
  await page.goto(AD_URL);
  await chooseCookies(page, 'reject');
  await fillForm(page);
  await submit(page);
  await expect.poll(() => log.capi.length).toBe(1);
  await page.waitForTimeout(500);
  expect(log.fbq).toEqual([]);
  const capi = log.capi[0].body;
  expect(capi.event_id).toBe(log.payloads[0].body.event_id);
  expect(capi.fbclid).toBe('IwAR0abc_DEF-123');
  expect(capi.fbc).toMatch(/^fb\.1\.\d{13}\.IwAR0abc_DEF-123$/);
  expect(capi.fbp).toBe('');
  // Nada de Meta guardado en el navegador sin consentimiento
  const stored = await page.evaluate(() => [...Object.keys(sessionStorage), ...Object.keys(localStorage)]);
  expect(stored.filter((k) => /form_started|form_steps/.test(k))).toEqual([]);
  expect(errors, 'sin errores de consola ni de CSP').toEqual([]);
});

test('ir atrás y adelante no repite FormStep', async ({ page, context }) => {
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await page.locator('label.option', { hasText: 'De 40 a 49' }).click();
  await page.locator('[data-step="2"].is-active').waitFor();
  await page.locator('[data-back]').click();
  await page.locator('[data-step="1"].is-active').waitFor();
  await page.locator('label.option', { hasText: 'De 50 a 59' }).click();
  await page.locator('[data-step="2"].is-active').waitFor();
  await page.locator('label.option', { hasText: 'Menos de 1 año' }).click();
  await page.locator('[data-step="3"].is-active').waitFor();
  await page.locator('[data-back]').click();
  await page.locator('label.option', { hasText: 'Más de 3 años' }).click();
  await page.locator('[data-step="3"].is-active').waitFor();
  await page.waitForTimeout(300);
  const steps = fbqEvents(log, 'FormStep').map((c) => c.args[2].step);
  expect(steps).toEqual([1, 2]);
});

test('un error en el teléfono dispara FormError una sola vez por campo y paso', async ({ page, context }) => {
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await fillForm(page, { phone: '123' });
  await submit(page);
  await expect(page.locator('#lf-phone-error')).toBeVisible();
  await expect(page.locator('#lf-phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#lf-phone')).toBeFocused();
  await submit(page);
  await page.waitForTimeout(300);
  const errors = fbqEvents(log, 'FormError');
  expect(errors.length).toBe(1);
  expect(errors[0].args[2]).toEqual({ step: 4, field: 'phone' });
  expect(log.payloads.length).toBe(0);
});

test('nombre con letras que el servidor no admite: error claro antes de enviar', async ({ page, context }) => {
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await page.locator('label.option', { hasText: 'De 30 a 39' }).click();
  await page.locator('label.option', { hasText: 'Nunca he entrenado' }).click();
  await page.locator('[data-step="3"].is-active').waitFor();
  await page.locator('#lf-name').fill('Анна');
  await page.locator('[data-next-name]').click();
  await expect(page.locator('#lf-name-error')).toHaveText('Escribe tu nombre sin caracteres especiales.');
  await page.locator('#lf-name').fill('A');
  await page.locator('[data-next-name]').click();
  await expect(page.locator('#lf-name-error')).toHaveText('Escribe tu nombre (mínimo 2 letras).');
  expect(fbqEvents(log, 'FormError').map((c) => c.args[2])).toEqual([{ step: 3, field: 'name' }]);
});

test('un fallo y un reintento en la misma visita: mismo event_id y un solo Lead', async ({ page, context }) => {
  const log = await setup(context, { appsScript: 'fail' });
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await fillForm(page);
  await submit(page);
  await expect(page.locator('[data-form-error]')).toBeVisible();
  expect(log.payloads.length).toBe(2); // envío + 1 reintento automático
  const firstId = log.payloads[0].body.event_id;
  expect(log.payloads[1].body.event_id).toBe(firstId);
  const href = await page.locator('[data-error-whatsapp]').getAttribute('href');
  expect(decodeURIComponent(href)).toContain('Mi teléfono: +34612345678');
  expect(decodeURIComponent(href)).toContain('Edad: De 30 a 39');
  let pending = await page.evaluate(() => JSON.parse(localStorage.getItem('pyp_pending_leads') || '[]'));
  expect(pending.map((p) => p.event_id)).toEqual([firstId]);

  // Vuelve a intentarlo con el servidor ya bien
  log.appsScriptMode = 'ok';
  await submit(page);
  await expect(page.locator('[data-thanks]')).toBeVisible();
  expect(log.payloads.at(-1).body.event_id).toBe(firstId);
  pending = await page.evaluate(() => JSON.parse(localStorage.getItem('pyp_pending_leads') || '[]'));
  expect(pending).toEqual([]);
  await expect.poll(() => log.capi.length).toBe(1);
  expect(fbqEvents(log, 'Lead').length).toBe(1);
});

test('una solicitud pendiente se reenvía en la siguiente visita y cuenta un solo Lead', async ({ page, context }) => {
  const log = await setup(context, { appsScript: 'fail' });
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await fillForm(page);
  await submit(page);
  await expect(page.locator('[data-form-error]')).toBeVisible();
  const eventId = log.payloads[0].body.event_id;

  log.appsScriptMode = 'ok';
  await page.goto('/privacidad');
  await expect.poll(() => log.capi.length, { timeout: 10_000 }).toBe(1);
  expect(log.capi[0].body.event_id).toBe(eventId);
  await expect.poll(() => fbqEvents(log, 'Lead').length).toBe(1);
  expect(fbqEvents(log, 'Lead')[0].args[3]).toEqual({ eventID: eventId });

  // Otra visita: ya no queda nada pendiente ni se repite el Lead
  await page.goto('/');
  await page.waitForTimeout(3000);
  expect(log.capi.length).toBe(1);
  expect(fbqEvents(log, 'Lead').length).toBe(1);
});

test('si el Apps Script rechaza el teléfono: no se reintenta ni se guarda, y se marca el campo', async ({ page, context }) => {
  const log = await setup(context, { appsScript: 'invalid_phone' });
  await page.goto('/');
  await chooseCookies(page, 'reject');
  await fillForm(page);
  await submit(page);
  await expect(page.locator('#lf-phone-error')).toBeVisible();
  await expect(page.locator('#lf-phone')).toHaveAttribute('aria-invalid', 'true');
  expect(log.payloads.length).toBe(1);
  const pending = await page.evaluate(() => localStorage.getItem('pyp_pending_leads'));
  expect(pending).toBeNull();
  await expect(page.locator('[data-form-error]')).toBeHidden();
  expect(log.capi.length).toBe(0);
});
