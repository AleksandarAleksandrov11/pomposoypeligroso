// Capturas de referencia en 390 y 1440 px: primer pantallazo con el aviso, cada paso, estado de gracias y aviso.
import { test } from '@playwright/test';
import { setup, chooseCookies, isMobileProject } from './helpers.mjs';

const DIR = 'source/qa/capturas';

test('capturas del recorrido', async ({ page, context }, testInfo) => {
  const w = isMobileProject(testInfo) ? 390 : 1440;
  const shot = (name) => page.screenshot({ path: `${DIR}/e2e-${w}-${name}.png` });
  await setup(context);

  await page.goto('/?utm_campaign=DESCUBRIR_octubre');
  await page.waitForLoadState('networkidle');
  await shot('01-primer-pantallazo-descubrir');
  await page.locator('[data-cookie-banner]').screenshot({ path: `${DIR}/e2e-${w}-02-aviso-cookies.png` });

  await page.goto('/?utm_campaign=CIERRE_retargeting');
  await page.waitForLoadState('networkidle');
  await shot('03-primer-pantallazo-cierre');
  await chooseCookies(page, 'reject');

  const card = page.locator('.lead-card');
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await card.screenshot({ path: `${DIR}/e2e-${w}-04-paso-1.png` });
  await page.locator('label.option', { hasText: 'De 30 a 39' }).click();
  await page.locator('[data-step="2"].is-active').waitFor();
  await page.waitForTimeout(350);
  await card.screenshot({ path: `${DIR}/e2e-${w}-05-paso-2.png` });
  await page.locator('label.option', { hasText: 'Nunca he entrenado' }).click();
  await page.locator('[data-step="3"].is-active').waitFor();
  await page.waitForTimeout(350);
  await card.screenshot({ path: `${DIR}/e2e-${w}-06-paso-3.png` });
  await page.locator('#lf-name').fill('María José');
  await page.locator('[data-next-name]').click();
  await page.locator('[data-step="4"].is-active').waitFor();
  await page.waitForTimeout(350);
  await page.locator('#lf-phone').fill('612 345 678');
  await card.screenshot({ path: `${DIR}/e2e-${w}-07-paso-4.png` });
  await page.locator('[data-submit]').click();
  await page.locator('[data-thanks]').waitFor();
  await card.screenshot({ path: `${DIR}/e2e-${w}-08-gracias.png` });
});
