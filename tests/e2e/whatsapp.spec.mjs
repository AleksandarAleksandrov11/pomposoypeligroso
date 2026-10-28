// WhatsApp tras enviar: estado de gracias en la tarjeta; en móvil se abre solo, en escritorio solo con el botón.
import { test, expect } from '@playwright/test';
import { setup, chooseCookies, fillForm, submit, fbqEvents, isMobileProject } from './helpers.mjs';

const WA_TEXT =
  'Hola, soy María José. Acabo de rellenar el formulario de Pomposo y Peligroso. Edad: De 30 a 39. Experiencia: Nunca he entrenado. Quiero información sobre el programa.';
const WA_URL = `https://wa.me/34644117740?text=${encodeURIComponent(WA_TEXT)}`;

test('móvil (Instagram en iPhone): gracias en la tarjeta y WhatsApp solo antes de 2 s, al menos 800 ms después del Lead', async ({ page, context }, testInfo) => {
  test.skip(!isMobileProject(testInfo), 'solo en móvil');
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await fillForm(page);
  await submit(page);
  await expect(page.locator('[data-thanks]')).toBeVisible();
  await expect(page.locator('[data-thanks-title]')).toContainText('Gracias, María.');
  await expect(page.locator('[data-thanks-whatsapp]')).toHaveAttribute('href', WA_URL);
  await expect(page.locator('[data-lead-form]')).toBeHidden();
  const answeredAt = log.payloads[0].t;

  await expect.poll(() => log.navs.length, { timeout: 4000 }).toBe(1);
  expect(log.navs[0].url).toBe(WA_URL);
  expect(log.navs[0].t - answeredAt).toBeLessThan(2000);
  const lead = fbqEvents(log, 'Lead')[0];
  expect(log.navs[0].t - lead.t).toBeGreaterThanOrEqual(800);
  const contact = fbqEvents(log, 'Contact').map((c) => c.args[2]);
  expect(contact).toEqual([{ content_category: 'gracias-auto' }]);
});

test('escritorio: sin redirección, botón con el enlace correcto y Contact gracias-boton', async ({ page, context }, testInfo) => {
  test.skip(isMobileProject(testInfo), 'solo en escritorio');
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'accept');
  await fillForm(page);
  await submit(page);
  await expect(page.locator('[data-thanks]')).toBeVisible();
  await page.waitForTimeout(2500);
  expect(log.navs).toEqual([]);
  expect(page.url()).not.toContain('wa.me');
  const btn = page.locator('[data-thanks-whatsapp]');
  await expect(btn).toHaveAttribute('href', WA_URL);
  await expect(btn).toHaveAttribute('target', '_blank');
  const popup = context.waitForEvent('page');
  await btn.click();
  await (await popup).waitForLoadState();
  expect(log.navs.map((n) => n.url)).toEqual([WA_URL]);
  expect(fbqEvents(log, 'Contact').map((c) => c.args[2])).toEqual([{ content_category: 'gracias-boton' }]);
  expect(page.url()).not.toContain('wa.me');
});

test('desde "¿Otra duda?" el mensaje termina con "Tengo una duda: "', async ({ page, context }, testInfo) => {
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'reject');
  const faq = page.locator('[data-cta="faq-duda"]');
  await expect(faq).toHaveText('¿Otra duda? Déjanos tu WhatsApp y te la resolvemos');
  await faq.click();
  await fillForm(page);
  await submit(page);
  const expected = `https://wa.me/34644117740?text=${encodeURIComponent(`${WA_TEXT} Tengo una duda: `)}`;
  if (isMobileProject(testInfo)) {
    // En móvil la página se va sola a WhatsApp: se comprueba la navegación
    await expect.poll(() => log.navs.map((n) => n.url), { timeout: 4000 }).toEqual([expected]);
  } else {
    await expect(page.locator('[data-thanks-whatsapp]')).toHaveAttribute('href', expected);
  }
});

test('al volver a la página después de enviar se ve el estado de gracias, no el formulario', async ({ page, context }, testInfo) => {
  const log = await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'reject');
  await fillForm(page);
  await submit(page);
  await expect(page.locator('[data-thanks]')).toBeVisible();
  if (isMobileProject(testInfo)) {
    await expect.poll(() => log.navs.length, { timeout: 4000 }).toBe(1);
    await page.goBack();
  } else {
    await page.reload();
  }
  await expect(page.locator('[data-thanks]')).toBeVisible();
  await expect(page.locator('[data-lead-form]')).toBeHidden();
  await page.waitForTimeout(2000);
  expect(log.payloads.length).toBe(1);
  expect(log.capi.length).toBe(1);
  expect(log.navs.length).toBe(isMobileProject(testInfo) ? 1 : 0);
});

test('el botón final dice "Enviar y abrir WhatsApp" y no hay casilla de privacidad', async ({ page, context }) => {
  await setup(context);
  await page.goto('/');
  await chooseCookies(page, 'reject');
  await fillForm(page);
  await expect(page.locator('[data-submit-label]')).toHaveText('Enviar y abrir WhatsApp');
  await expect(page.locator('#lf-privacy')).toHaveCount(0);
  const notice = page.locator('[data-step="4"] .consent');
  await expect(notice).toContainText('Al enviar aceptas la política de privacidad y que Pomposo y Peligroso te contacte sobre tu solicitud.');
  await expect(notice.locator('a')).toHaveAttribute('target', '_blank');
});
