// Capturas y comprobaciones automáticas en todos los anchos.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4400';
const OUT = process.argv[3];
const only = process.argv[4] ? process.argv[4].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });

const sizes = [
  [320, 568], [360, 740], [375, 812], [375, 667], [390, 844], [393, 852], [412, 915], [414, 896], [430, 932],
  [480, 854], [600, 960], [768, 1024], [820, 1180], [834, 1194], [1024, 768], [1180, 820], [1280, 800],
  [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440], [667, 375], [844, 390],
].filter(([w, h]) => !only || only.includes(`${w}x${h}`) || only.includes(String(w)));

const report = [];
const browser = await chromium.launch();
for (const [w, h] of sizes) {
  const touch = w < 1024 || h < 500;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    isMobile: touch && w < 1024,
    hasTouch: touch,
    userAgent: touch && w < 1024 ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0' : undefined,
  });
  const page = await ctx.newPage();
  const issues = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => issues.push('pageerror: ' + e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const tag = `${w}x${h}`;

  // 1. Primera pantalla con el banner de cookies (primera visita real)
  const first = await page.evaluate(() => {
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const cta = r(document.querySelector('[data-hero-cta]'));
    const banner = document.querySelector('[data-cookie-banner]');
    const b = banner && !banner.hidden ? r(banner) : null;
    const overlap = cta && b ? !(b.bottom <= cta.top || b.top >= cta.bottom) : false;
    return { ctaBottom: cta?.bottom, vh: innerHeight, overlap, bannerVisible: !!b };
  });
  if (first.overlap) issues.push('el banner de cookies tapa el CTA del hero');
  if (w < 1024 && h > 500 && first.ctaBottom > first.vh) issues.push(`CTA del hero fuera de la primera pantalla (${Math.round(first.ctaBottom)} > ${first.vh})`);
  await page.screenshot({ path: `${OUT}/${tag}-1-primera-pantalla.png` });

  // 2. Rechazar cookies y comprobar primera pantalla limpia
  await page.locator('[data-consent-action="reject"]').click();
  await page.waitForTimeout(200);

  // 3. Recorrer la página (activa apariciones y carga imágenes)
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += Math.round(h * 0.6)) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(110);
  }
  await page.waitForFunction(() => [...document.images].every((i) => i.complete || i.getBoundingClientRect().width === 0 || i.getBoundingClientRect().left >= innerWidth), null, { timeout: 20000 }).catch(() => issues.push('imágenes sin cargar'));

  // 4. Barra fija móvil: visible al pasar el hero, oculta con el formulario
  if (w < 768) {
    await page.evaluate(() => window.scrollTo({ top: document.querySelector('#como-funciona').offsetTop, behavior: 'instant' }));
    await page.waitForTimeout(400);
    const barVisible = await page.evaluate(() => document.querySelector('[data-mobilebar]').classList.contains('is-visible'));
    if (!barVisible) issues.push('la barra móvil no aparece al pasar el hero');
    await page.screenshot({ path: `${OUT}/${tag}-2-barra-movil.png` });
    await page.evaluate(() => window.scrollTo({ top: document.querySelector('#formulario').offsetTop + 100, behavior: 'instant' }));
    await page.waitForTimeout(400);
    const barOnForm = await page.evaluate(() => document.querySelector('[data-mobilebar]').classList.contains('is-visible'));
    if (barOnForm) issues.push('la barra móvil se ve encima del formulario');
    // Final de la página: el footer no queda tapado
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(400);
    const footerOk = await page.evaluate(() => {
      const bar = document.querySelector('[data-mobilebar]');
      const top = document.querySelector('.site-footer__top').getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return !bar.classList.contains('is-visible') || top.bottom <= b.top;
    });
    if (!footerOk) issues.push('la barra móvil tapa el final del footer');
    await page.screenshot({ path: `${OUT}/${tag}-3-final.png` });
  }

  // 5. Ancla al formulario: el título no queda debajo del header
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('.site-header__cta').click();
  await page.waitForTimeout(1200);
  const anchor = await page.evaluate(() => {
    const hdr = document.querySelector('[data-header]').getBoundingClientRect().bottom;
    const t = document.querySelector('#form-title').getBoundingClientRect().top;
    return { hdr, t };
  });
  if (anchor.t < anchor.hdr - 1) issues.push(`el ancla #formulario queda tapada por el header (${anchor.t} < ${anchor.hdr})`);
  await page.screenshot({ path: `${OUT}/${tag}-4-formulario.png` });

  // 6. Desbordes: scroll horizontal y textos que no caben
  const overflow = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth) out.push(`scroll horizontal ${document.documentElement.scrollWidth} > ${innerWidth}`);
    document.querySelectorAll('h1,h2,h3,.btn,.pill,.option span,p,li,a,summary').forEach((el) => {
      if (el.closest('.marquee,.carousel__track,.site-footer__giant,.visually-hidden,.hp,[hidden]')) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push('texto cortado: ' + el.textContent.trim().slice(0, 50));
      if (r.right > innerWidth + 1 || r.left < -1) out.push('fuera de pantalla: ' + el.tagName + ' ' + el.textContent.trim().slice(0, 40));
    });
    return [...new Set(out)].slice(0, 8);
  });
  issues.push(...overflow);

  // 7. Página completa
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const full = `${OUT}/${tag}-0-completa.png`;
  await page.screenshot({ path: full, fullPage: true });
  report.push(`${tag}: ${issues.length ? 'PROBLEMAS → ' + issues.join(' | ') : 'OK'}`);
  await ctx.close();
}
await browser.close();
console.log(report.join('\n'));
