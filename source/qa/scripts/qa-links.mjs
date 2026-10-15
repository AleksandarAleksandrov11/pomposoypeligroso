import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const BASE = process.argv[2];
const pages = ['/', '/gracias', '/aviso-legal', '/privacidad', '/cookies', '/no-existe'];
const res = []; const ok = (n, c, x = '') => res.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' :: ' + x : ''}`);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const external = new Set();
for (const path of pages) {
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  const bad = [];
  for (const h of links) {
    if (h.startsWith('#')) { if (h !== '#' && !(await p.$(h))) bad.push('ancla rota ' + h); continue; }
    if (h.startsWith('mailto:')) { if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}(\?subject=.+)?$/i.test(h)) bad.push(h); continue; }
    if (h.startsWith('tel:')) { if (!/^tel:\+\d{8,15}$/.test(h)) bad.push(h); continue; }
    if (h.startsWith('https://wa.me/')) { if (!/^https:\/\/wa\.me\/\d{8,15}\?text=[^ ]+$/.test(h)) bad.push(h); continue; }
    if (h.startsWith('/')) {
      const [pathOnly, hash] = h.split('#');
      const r = await ctx.request.get(BASE + pathOnly);
      if (r.status() !== 200) bad.push(`${h} → ${r.status()}`);
      if (hash) { const q = await ctx.newPage(); await q.goto(BASE + pathOnly); if (!(await q.$('#' + hash))) bad.push('ancla rota ' + h); await q.close(); }
      continue;
    }
    if (h.startsWith('http')) { external.add(h); continue; }
    bad.push('formato desconocido ' + h);
  }
  ok(`enlaces internos y formatos en ${path}`, bad.length === 0, bad.join(', '));
  // Texto visible prohibido
  // Texto visible tal como está escrito (sin text-transform: los titulares van en mayúsculas por CSS)
  const text = await p.evaluate(() => { document.querySelectorAll('*').forEach((e) => e.style.setProperty('text-transform', 'none', 'important')); return document.body.innerText; });
  const hits = ['—', '–', 'Lorem', 'TODO', 'undefined', 'null', 'NaN', 'PENDIENTE', 'XXX'].filter((w) => text.includes(w));
  ok(`texto visible limpio en ${path}`, hits.length === 0, hits.join(', '));
  // Accesibilidad (axe), con el banner y el modal visibles también
  const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  ok(`axe sin violaciones en ${path}`, axe.violations.length === 0, axe.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' ; ')}`).join(' | '));
  await p.close();
}
// Modal de cookies abierto
{
  const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.locator('[data-cookie-banner] [data-open-cookies]').click();
  const axe = await new AxeBuilder({ page: p }).include('[data-cookie-modal]').analyze();
  ok('axe en el modal de cookies', axe.violations.length === 0, axe.violations.map((v) => v.id).join(', '));
  await p.close();
}
// Pasos 2-4 del formulario
{
  const p = await ctx.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.locator('[data-consent-action="reject"]').click();
  await p.locator('label.option', { hasText: 'De 30 a 39' }).click(); await p.waitForTimeout(350);
  await p.locator('label.option', { hasText: 'Nunca he entrenado' }).click(); await p.waitForTimeout(350);
  await p.locator('#lf-name').fill('Eva'); await p.locator('[data-next-name]').click(); await p.waitForTimeout(350);
  await p.locator('[data-submit]').click(); await p.waitForTimeout(200);
  const axe = await new AxeBuilder({ page: p }).include('#formulario').analyze();
  ok('axe en el paso 4 con errores', axe.violations.length === 0, axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' ; ')}`).join(' | '));
  await p.close();
}
// Enlaces externos
for (const h of external) {
  try {
    const r = await ctx.request.get(h, { timeout: 20000, maxRedirects: 5, headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' } });
    res.push(`${r.status() < 400 ? 'PASS' : 'WARN'} externo ${h} → ${r.status()}`);
  } catch (e) { res.push(`WARN externo ${h} → ${e.message.split('\n')[0]}`); }
}
await b.close();
console.log(res.join('\n'));
