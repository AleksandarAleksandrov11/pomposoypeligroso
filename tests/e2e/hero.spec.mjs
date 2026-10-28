// Hero según el anuncio: titular correcto, sin saltos (CLS 0), botón en la primera pantalla y versión recordada.
import { test, expect } from '@playwright/test';
import { setup, isMobileProject } from './helpers.mjs';

const CASES = [
  { name: 'sin parámetros', url: '/', h1: 'Un glúteo pomposo y peligroso.', cta: 'Quiero mi plaza' },
  { name: 'DESCUBRIR', url: '/?utm_source=ig&utm_campaign=DESCUBRIR_octubre&utm_content=video_1', h1: 'Un glúteo pomposo y peligroso.', cta: 'Quiero mi plaza' },
  { name: 'cierre', url: '/?utm_source=ig&utm_campaign=CIERRE_retargeting&utm_content=video_2', h1: 'Tu glúteo no se va a poner pomposo solo.', cta: 'Pedir mi videollamada' },
];

/** Suma de layout-shift desde la carga (con buffer), tras dejar que todo se asiente. */
async function cls(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 1500);
      }),
  );
}

for (const c of CASES) {
  test(`hero ${c.name}: titular, CLS 0 y botón visible con el aviso de cookies`, async ({ page, context }, testInfo) => {
    await setup(context);
    await page.goto(c.url);
    const h1 = page.locator('#hero-title');
    expect((await h1.innerText()).replace(/\s+/g, ' ').trim().toLowerCase()).toBe(c.h1.toLowerCase());
    const cta = page.locator('[data-hero-cta]:visible');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveText(c.cta);
    await expect(cta).toHaveAttribute('href', '#formulario');
    expect(await cls(page)).toBe(0);

    // Con el aviso de cookies a la vista, el botón cabe en la primera pantalla y el aviso no lo tapa
    const banner = page.locator('[data-cookie-banner]');
    await expect(banner).toBeVisible();
    const vh = page.viewportSize().height;
    const b = await banner.boundingBox();
    const k = await cta.boundingBox();
    expect(k.y + k.height).toBeLessThanOrEqual(vh);
    expect(k.y).toBeGreaterThanOrEqual(b.y + b.height);
    if (isMobileProject(testInfo)) {
      // En 390x844 se ven también el beneficio y la tira de antes y después
      const lead = page.locator('.hero__lead:visible');
      const proof = await page.locator('.proof').boundingBox();
      expect((await lead.boundingBox()).y).toBeGreaterThanOrEqual(b.y + b.height);
      expect(proof.y + proof.height).toBeLessThanOrEqual(vh);
    }
  });
}

test('la versión del anuncio se mantiene tras ir a /privacidad y volver', async ({ page, context }) => {
  await setup(context);
  await page.goto(CASES[2].url);
  await expect(page.locator('html')).toHaveAttribute('data-ad', 'cierre');
  await page.goto('/privacidad');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ad', 'cierre');
  await expect(page.locator('[data-hero-cta]:visible')).toHaveText('Pedir mi videollamada');
});

test('la barra fija móvil tiene un solo botón y aparece al pasar el hero (también en la versión de cierre)', async ({ page, context }, testInfo) => {
  test.skip(!isMobileProject(testInfo), 'solo en móvil');
  await setup(context);
  for (const url of [CASES[0].url, CASES[2].url]) {
    await page.goto(url);
    const bar = page.locator('[data-mobilebar]');
    await expect(bar.locator('a')).toHaveCount(1);
    await expect(bar.locator('a')).toHaveAttribute('href', '#formulario');
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.6));
    await expect(bar).toHaveClass(/is-visible/);
    // El aviso de cookies (arriba) no tapa la barra (abajo)
    const bb = await page.locator('[data-cookie-banner]').boundingBox();
    const mb = await bar.boundingBox();
    expect(bb.y + bb.height).toBeLessThanOrEqual(mb.y);
  }
});
