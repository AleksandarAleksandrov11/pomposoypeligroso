import { chromium } from 'playwright';
const BASE = process.argv[2]; const OUT = process.argv[3];
const res = [];
const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' :: ' + x : ''}`);
const b = await chromium.launch();
const UAS = {
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,3; iOS 18_1; es_ES; es; scale=3.00; 1290x2796; 640201398)',
  facebook: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/485.0.0.43.109;]',
};
for (const [name, ua] of Object.entries(UAS)) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 700 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: ua });
  const p = await ctx.newPage();
  const errs = []; p.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text())); p.on('pageerror', (e) => errs.push(e.message));
  let payload = null;
  await ctx.route('https://script.google.com/**', (r) => { payload = JSON.parse(r.request().postData()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"X"}' }); });
  await ctx.route('https://connect.facebook.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await p.goto(BASE + '/?utm_source=ig&utm_medium=paid_social&utm_content=ad2', { waitUntil: 'networkidle' });
  // Diálogo de cookies (<dialog>) funciona
  await p.locator('[data-cookie-banner] [data-open-cookies]').click();
  ok(`${name}: <dialog> de cookies abre`, await p.locator('[data-cookie-modal]').evaluate((d) => d.open));
  await p.locator('[data-cookie-save]').click();
  ok(`${name}: <dialog> se cierra al guardar`, !(await p.locator('[data-cookie-modal]').evaluate((d) => d.open)));
  // Barra fija y enlace de WhatsApp
  await p.evaluate(() => window.scrollTo({ top: document.querySelector('#como-funciona').offsetTop, behavior: 'instant' }));
  await p.waitForTimeout(400);
  const bar = await p.evaluate(() => { const el = document.querySelector('[data-mobilebar]'); const r = el.getBoundingClientRect(); return { vis: el.classList.contains('is-visible'), bottom: r.bottom, vh: innerHeight, pos: getComputedStyle(el).position }; });
  ok(`${name}: barra fija visible y pegada abajo`, bar.vis && Math.abs(bar.bottom - bar.vh) < 2 && bar.pos === 'fixed', JSON.stringify(bar));
  const wa = await p.locator('.mobilebar__wa').getAttribute('href');
  ok(`${name}: enlace wa.me correcto`, /^https:\/\/wa\.me\/34644117740\?text=Hola%2C%20vengo/.test(wa), wa);
  ok(`${name}: wa.me abre en pestaña nueva con noopener`, (await p.locator('.mobilebar__wa').getAttribute('target')) === '_blank' && (await p.locator('.mobilebar__wa').getAttribute('rel')) === 'noopener');
  // Teclado: al enfocar el campo de nombre la barra desaparece
  await p.locator('#formulario').scrollIntoViewIfNeeded();
  await p.locator('label.option', { hasText: 'De 40 a 49' }).click(); await p.waitForTimeout(350);
  await p.locator('label.option', { hasText: 'Menos de 1 año' }).click(); await p.waitForTimeout(350);
  await p.locator('#lf-name').fill('Lucía'); await p.locator('#lf-name').press('Enter'); await p.waitForTimeout(350);
  await p.locator('#lf-phone').focus();
  await p.evaluate(() => window.scrollTo({ top: document.querySelector('#preguntas').offsetTop, behavior: 'instant' }));
  await p.waitForTimeout(300);
  ok(`${name}: barra oculta con el teclado abierto (campo enfocado)`, !(await p.evaluate(() => document.querySelector('[data-mobilebar]').classList.contains('is-visible'))));
  await p.locator('#formulario').scrollIntoViewIfNeeded();
  // Campo de teléfono visible con el teclado (viewport reducido)
  await p.setViewportSize({ width: 390, height: 420 });
  await p.locator('#lf-phone').focus();
  await p.locator('#lf-phone').scrollIntoViewIfNeeded();
  const vis = await p.locator('#lf-phone').evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 60 && r.bottom <= innerHeight + 1; });
  ok(`${name}: el teléfono queda visible con el teclado abierto`, vis);
  await p.screenshot({ path: `${OUT}/inapp-${name}-teclado.png` });
  await p.setViewportSize({ width: 390, height: 700 });
  await p.locator('#lf-phone').fill('699 111 222');
  await p.locator('#lf-privacy').check({ force: true });
  await p.waitForTimeout(3100);
  await p.locator('[data-submit]').click();
  await p.waitForURL('**/gracias', { timeout: 8000 }).catch(() => {});
  ok(`${name}: envío y redirección a /gracias`, p.url().endsWith('/gracias'));
  ok(`${name}: in_app_browser detectado`, payload?.in_app_browser === (name === 'instagram' ? 'Instagram' : 'Facebook'), payload?.in_app_browser);
  ok(`${name}: device móvil`, payload?.device === 'móvil', payload?.device);
  ok(`${name}: sin errores de consola`, errs.length === 0, errs.join(' | '));
  await p.screenshot({ path: `${OUT}/inapp-${name}-gracias.png` });
  await ctx.close();
}
// Modo oscuro: la web sigue en claro
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true });
  const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok('modo oscuro: fondo blanco', bg === 'rgb(255, 255, 255)', bg);
  await p.screenshot({ path: `${OUT}/modo-oscuro-390.png` });
  await ctx.close();
}
// Zoom 200 % (equivale a 720 px de ancho CSS en una pantalla de 1440)
{
  const ctx = await b.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.locator('[data-consent-action="reject"]').click();
  const sw = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  ok('zoom 200 %: sin scroll horizontal', sw);
  await p.locator('.site-header__cta').click(); await p.waitForTimeout(900);
  ok('zoom 200 %: CTA del header lleva al formulario', await p.locator('#form-title').isVisible());
  await p.screenshot({ path: `${OUT}/zoom-200.png` });
  await ctx.close();
}
// Sin JavaScript
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, isMobile: true });
  const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'load' });
  ok('sin JS: titular visible', await p.locator('h1').isVisible());
  ok('sin JS: secciones visibles (sin opacidad 0)', await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1')));
  ok('sin JS: el formulario se oculta y aparece la alternativa', !(await p.locator('.lead-form').isVisible()) && (await p.locator('.lead-form__noscript').isVisible()));
  ok('sin JS: no aparece el banner de cookies', !(await p.locator('[data-cookie-banner]').isVisible()));
  await p.locator('#formulario').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/sin-js-formulario.png` });
  await p.screenshot({ path: `${OUT}/sin-js-completa.png`, fullPage: true });
  await ctx.close();
}
// Teclado: recorrido con Tab y foco visible
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.keyboard.press('Tab');
  const first = await p.evaluate(() => document.activeElement.textContent.trim());
  ok('teclado: el primer Tab es "Saltar al formulario"', first === 'Saltar al formulario', first);
  await p.screenshot({ path: `${OUT}/teclado-skip-link.png`, clip: { x: 0, y: 0, width: 600, height: 120 } });
  await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  let outline = true; const seen = [];
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    const info = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); const sib = a.matches('input') ? a.nextElementSibling : null; const s2 = sib ? getComputedStyle(sib) : null; return { t: (a.textContent || a.value || a.name || a.tagName).trim().slice(0, 30), o: cs.outlineStyle !== 'none' || (s2 && s2.outlineStyle !== 'none') || cs.boxShadow !== 'none' }; });
    seen.push(info.t); if (!info.o) outline = false;
  }
  ok('teclado: foco visible en cada elemento', outline, seen.join(' → '));
  // Selección por teclado en el paso 1: flechas + Intro
  await p.locator('#formulario input[name="age_range"]').first().focus();
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(300);
  ok('teclado: con flechas no avanza solo', (await p.locator('[data-step-count]').textContent()) === '1');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok('teclado: Intro confirma y avanza', (await p.locator('[data-step-count]').textContent()) === '2');
  ok('teclado: el foco va al título del paso', (await p.evaluate(() => document.activeElement.textContent.trim())) === '¿Cuánto tiempo llevas entrenando?');
  await ctx.close();
}
await b.close();
console.log(res.join('\n'));
