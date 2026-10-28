// Enlaces legales en pestaña nueva (la landing y el formulario siguen intactos) y aviso de cookies.
import { test, expect } from '@playwright/test';
import { setup, chooseCookies } from './helpers.mjs';

test('las legales se abren en otra pestaña desde el banner, el modal, el formulario y el footer', async ({ page, context }) => {
  await setup(context);
  await page.goto('/');

  // Banner: "Más información"
  let popup = context.waitForEvent('page');
  await page.locator('[data-cookie-banner] a').click();
  expect((await popup).url()).toMatch(/\/cookies$/);
  await (await popup).close();

  // Modal: "Política de cookies"
  await page.locator('[data-cookie-banner] [data-open-cookies]').click();
  await expect(page.locator('[data-cookie-modal]')).toBeVisible();
  popup = context.waitForEvent('page');
  await page.locator('[data-cookie-modal] a[href="/cookies"]').click();
  expect((await popup).url()).toMatch(/\/cookies$/);
  await (await popup).close();
  await page.locator('[data-cookie-close]').click();
  await chooseCookies(page, 'reject');

  // Formulario a medias: el enlace de la privacidad no lo pierde
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await page.locator('label.option', { hasText: 'De 30 a 39' }).click();
  await page.locator('label.option', { hasText: 'Nunca he entrenado' }).click();
  await page.locator('#lf-name').fill('Lucía');
  await page.locator('[data-next-name]').click();
  await page.locator('[data-step="4"].is-active').waitFor();
  popup = context.waitForEvent('page');
  await page.locator('[data-step="4"] .consent a').click();
  expect((await popup).url()).toMatch(/\/privacidad$/);
  await (await popup).close();
  await expect(page.locator('[data-step="4"]')).toHaveClass(/is-active/);
  expect(page.url()).toMatch(/\/(#formulario)?$/);

  // Footer
  for (const [text, path] of [
    ['Aviso legal', '/aviso-legal'],
    ['Política de privacidad', '/privacidad'],
    ['Política de cookies', '/cookies'],
  ]) {
    popup = context.waitForEvent('page');
    await page.locator('.site-footer a', { hasText: text }).click();
    expect((await popup).url()).toMatch(new RegExp(`${path}$`));
    await (await popup).close();
  }
  await expect(page.locator('#lf-name')).toHaveValue('Lucía');
});

test('aviso de cookies: Aceptar y Rechazar pesan igual, Configurar abre el modal y la elección se recuerda', async ({ page, context }) => {
  await setup(context);
  await page.goto('/');
  const accept = await page.locator('[data-consent-action="accept"]').boundingBox();
  const reject = await page.locator('[data-consent-action="reject"]').boundingBox();
  expect(Math.abs(accept.height - reject.height)).toBeLessThanOrEqual(1);
  const [ca, cr] = await Promise.all(
    ['accept', 'reject'].map((a) =>
      page.locator(`[data-consent-action="${a}"]`).evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.color, s.borderColor, s.fontWeight, s.fontSize].join('|');
      }),
    ),
  );
  expect(ca).toBe(cr);
  await page.locator('[data-cookie-banner] [data-open-cookies]').click();
  await expect(page.locator('[data-cookie-modal]')).toBeVisible();
  await page.locator('[data-cookie-save]').click();
  await page.reload();
  await expect(page.locator('[data-cookie-banner]')).toBeHidden();
});

test('el footer no tiene contacto ni redes y su CTA lleva al formulario', async ({ page, context }) => {
  await setup(context);
  await page.goto('/privacidad');
  const footer = page.locator('.site-footer');
  await expect(footer.locator('a[href^="mailto:"], a[href^="tel:"], a[href*="wa.me"], a[href*="instagram.com"]')).toHaveCount(0);
  await expect(footer.locator('[data-cta="footer"]')).toHaveAttribute('href', '/#formulario');
});
