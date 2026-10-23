// QA funcional: formulario + píxel + cookies sobre el build de QA (http://127.0.0.1:4400)
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://127.0.0.1:4400';
const ONLY = process.argv[3] || 'all';
const results = [];
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };

const FAKE_FBEVENTS = `(function(){var f=window.fbq;window.__fbq=window.__fbq||[];var q=(f&&f.queue)||[];f.callMethod=function(){window.__fbq.push(JSON.parse(JSON.stringify(Array.from(arguments))))};q.forEach(function(a){window.__fbq.push(JSON.parse(JSON.stringify(Array.from(a))))});f.queue=[];})();`;

async function newCtx(browser, { mode = 'ok', realPixel = false, mobile = true } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : { viewport: { width: 1440, height: 900 } });
  const state = { fbRequests: [], posts: [], console: [], csp: [] };
  ctx.on('request', (r) => { if (/facebook\.(net|com)/.test(r.url())) state.fbRequests.push(r.url()); });
  if (!realPixel) {
    await ctx.route('https://connect.facebook.net/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_FBEVENTS }));
  }
  await ctx.route('https://script.google.com/**', async (route) => {
    const req = route.request();
    state.posts.push({ method: req.method(), ct: req.headers()['content-type'], body: req.postData() });
    if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'PYP-TEST-0001' }) });
    if (mode === 'error') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'invalid' }) });
    if (mode === 'timeout') { await new Promise((r) => setTimeout(r, 15000)); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }).catch(() => {}); }
  });
  return { ctx, state };
}

function watch(page, state) {
  page.on('console', (m) => { const t = m.text(); if (['error', 'warning'].includes(m.type())) state.console.push(`${m.type()}: ${t}`); if (/Content Security Policy/i.test(t)) state.csp.push(t); });
  page.on('pageerror', (e) => state.console.push('pageerror: ' + e.message));
}

async function fillForm(page, { phone = '612 345 678' } = {}) {
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('label.option', { hasText: 'De 30 a 39' }).click();
  await page.waitForTimeout(350);
  await page.locator('label.option', { hasText: 'Nunca he entrenado' }).click();
  await page.waitForTimeout(350);
  await page.locator('#lf-name').fill('María José');
  await page.locator('[data-next-name]').click();
  await page.waitForTimeout(350);
  await page.locator('#lf-phone').fill(phone);
  await page.locator('#lf-privacy').check({ force: true });
  await page.waitForTimeout(3100); // > 3 s para no marcarse como sospechoso
}

const browser = await chromium.launch();

/* A. Sin consentimiento: nada de Meta, el lead se guarda con consent_marketing = no */
if (ONLY === 'all' || ONLY === 'A') {
  const { ctx, state } = await newCtx(browser);
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/?utm_source=fb&utm_campaign=test&utm_content=anuncio1&fbclid=abc', { waitUntil: 'networkidle' });
  ok('A banner visible al entrar', await page.locator('[data-cookie-banner]').isVisible());
  await page.locator('[data-consent-action="reject"]').click();
  await fillForm(page);
  await page.locator('[data-submit]').click();
  await page.waitForURL('**/gracias', { timeout: 8000 }).catch(() => {});
  ok('A redirige a /gracias', page.url().endsWith('/gracias'), page.url());
  ok('A cero peticiones a Meta sin consentimiento', state.fbRequests.length === 0, state.fbRequests.join(','));
  const body = state.posts[0] ? JSON.parse(state.posts[0].body) : {};
  ok('A POST text/plain', state.posts[0]?.ct?.startsWith('text/plain'), state.posts[0]?.ct);
  ok('A consent_marketing = no', body.consent_marketing === 'no', body.consent_marketing);
  ok('A UTMs llegan sin consentimiento (misma página)', body.utm_source === 'fb' && body.utm_content === 'anuncio1', JSON.stringify({ s: body.utm_source, c: body.utm_content }));
  ok('A sin consentimiento no viajan identificadores de Meta', !body.fbclid && !body.fbc && !body.fbp && !/fbclid/.test(body.landing_url + body.page_url + body.first_touch + body.last_touch), JSON.stringify({ f: body.fbclid, l: body.landing_url }));
  const stored = await page.evaluate(() => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage) }));
  ok('A sin consentimiento solo se guarda lo necesario', !stored.ls.concat(stored.ss).some((k) => /touch|form_started|lead_sent/.test(k)), JSON.stringify(stored));
  ok('A sin localStorage de atribución sin consentimiento', (await page.evaluate(() => localStorage.getItem('pyp_last_touch'))) === null);
  ok('A /gracias con nombre', (await page.locator('[data-thanks-title]').textContent())?.includes('María'), await page.locator('[data-thanks-title]').textContent());
  ok('A sin errores de consola', state.console.length === 0, state.console.join(' | '));
  await ctx.close();
}

/* B. Con consentimiento: eventos en orden, UTMs tras navegar a legal, Lead con eventID = event_id */
if (ONLY === 'all' || ONLY === 'B') {
  const { ctx, state } = await newCtx(browser);
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/?utm_source=fb&utm_campaign=test&utm_content=anuncio1&fbclid=abc', { waitUntil: 'networkidle' });
  ok('B nada de Meta antes de aceptar', state.fbRequests.length === 0, state.fbRequests.join(','));
  await page.locator('[data-consent-action="accept"]').click();
  await page.waitForTimeout(500);
  ok('B fbevents cargado tras aceptar', state.fbRequests.some((u) => u.includes('fbevents.js')));
  // Navega a una página legal y vuelve sin parámetros
  await page.goto(BASE + '/privacidad', { waitUntil: 'networkidle' });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__fbq = []; });
  // Contact: WhatsApp en la barra del FAQ
  await page.evaluate(() => document.addEventListener('click', (e) => { const a = e.target.closest('a[data-contact]'); if (a) e.preventDefault(); }, true));
  await page.locator('#preguntas a[data-contact="whatsapp"]').click();
  await fillForm(page);
  await page.locator('[data-submit]').click();
  await page.waitForURL('**/gracias', { timeout: 8000 }).catch(() => {});
  const calls = await page.evaluate(() => window.__fbq || []).catch(() => []);
  // Las llamadas de la página anterior se pierden al navegar: las recogemos antes del redirect
  ok('B redirige a /gracias', page.url().endsWith('/gracias'));
  const body = state.posts[0] ? JSON.parse(state.posts[0].body) : {};
  const required = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','campaign_id','adset_id','ad_id','adset_name','ad_name','placement','site_source','fbclid','fbc','fbp','landing_url','page_url','referrer','first_touch','last_touch','device','user_agent','in_app_browser','screen','language','event_id','submitted_at','time_to_complete','consent_marketing','website','age_range','experience','name','phone'];
  const missing = required.filter((k) => !(k in body));
  ok('B payload incluye todos los campos de 9.3', missing.length === 0, 'faltan: ' + missing.join(','));
  ok('B UTMs se conservan tras ir a legal y volver', body.utm_source === 'fb' && body.utm_campaign === 'test' && body.utm_content === 'anuncio1');
  ok('B fbc construido desde fbclid', /^fb\.1\.\d+\.abc$/.test(body.fbc), body.fbc);
  ok('B landing_url es la de llegada con UTMs', body.landing_url.includes('utm_content=anuncio1'), body.landing_url);
  ok('B page_url es la del envío', body.page_url === BASE + '/', body.page_url);
  ok('B teléfono E.164', body.phone === '+34612345678', body.phone);
  ok('B consent_marketing = si', body.consent_marketing === 'si');
  ok('B device móvil', body.device === 'móvil', body.device);
  ok('B event_id uuid v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.event_id), body.event_id);
  ok('B time_to_complete >= 3', body.time_to_complete >= 3, String(body.time_to_complete));
  ok('B atribución en localStorage con consentimiento', !!(await page.evaluate(() => localStorage.getItem('pyp_last_touch'))));
  ok('B sin errores de consola / CSP', state.console.length === 0, state.console.join(' | '));
  await ctx.close();
}

/* B2. Orden y número de eventos (se lee la cola antes del redirect) */
if (ONLY === 'all' || ONLY === 'B2') {
  const { ctx, state } = await newCtx(browser);
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('[data-consent-action="accept"]').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { const o = location.assign.bind(location); window.__redirect = null; });
  // Bloquea la navegación a /gracias para poder leer la cola completa
  await page.route('**/gracias', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub</body></html>' }));
  await page.evaluate(() => document.addEventListener('click', (e) => { const a = e.target.closest('a[data-contact]'); if (a) e.preventDefault(); }, true));
  await page.locator('#preguntas a[data-contact="whatsapp"]').click();
  await fillForm(page);
  const queueBefore = await page.evaluate(() => window.__fbq.map((c) => c.slice(0, 2).join(':')));
  await page.locator('[data-submit]').click();
  await page.waitForTimeout(200);
  const calls = await page.evaluate(() => window.__fbq);
  const seq = calls.map((c) => `${c[0]}:${c[1]}`);
  const body = JSON.parse(state.posts[0].body);
  const leads = calls.filter((c) => c[1] === 'Lead');
  ok('B2 secuencia consent→init→PageView', seq.slice(0, 3).join(' ') === 'consent:grant init:123456789012345 track:PageView', seq.slice(0, 3).join(' '));
  ok('B2 ViewContent una vez', seq.filter((s) => s === 'track:ViewContent').length === 1);
  ok('B2 FormStart una vez', seq.filter((s) => s === 'trackCustom:FormStart').length === 1);
  ok('B2 FormStep x4', seq.filter((s) => s === 'trackCustom:FormStep').length === 4, seq.join(' '));
  ok('B2 Lead exactamente una vez', leads.length === 1);
  ok('B2 Lead eventID = event_id del payload', leads[0]?.[3]?.eventID === body.event_id, `${leads[0]?.[3]?.eventID} vs ${body.event_id}`);
  ok('B2 Lead params', leads[0]?.[2]?.content_name === 'Formulario Pomposo' && leads[0]?.[2]?.age_range === 'De 30 a 39' && leads[0]?.[2]?.experience === 'Nunca he entrenado', JSON.stringify(leads[0]?.[2]));
  ok('B2 Contact con method y location', calls.some((c) => c[1] === 'Contact' && c[2].method === 'whatsapp' && c[2].location === 'faq'), JSON.stringify(calls.filter((c) => c[1] === 'Contact')));
  ok('B2 FormStep params', calls.filter((c) => c[1] === 'FormStep').map((c) => c[2].step + c[2].step_name).join(',') === '1edad,2experiencia,3nombre,4telefono');
  results.push('INFO secuencia: ' + seq.join(' → '));
  await page.waitForTimeout(600);
  await ctx.close();
}

/* C. Error del servidor: reintenta 1 vez, guarda el lead y muestra alternativa */
if (ONLY === 'all' || ONLY === 'C') {
  const { ctx, state } = await newCtx(browser, { mode: 'error' });
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('[data-consent-action="accept"]').click();
  await fillForm(page);
  await page.evaluate(() => { window.__fbq = []; });
  await page.locator('[data-submit]').click();
  await page.waitForSelector('[data-form-error]:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('C muestra caja de error', await page.locator('[data-form-error]').isVisible());
  ok('C 2 intentos (1 reintento)', state.posts.length === 2, String(state.posts.length));
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('pyp_pending_leads') || '[]'));
  ok('C lead guardado en localStorage', pending.length === 1 && pending[0].phone === '+34612345678');
  const wa = await page.locator('[data-error-whatsapp]').getAttribute('href');
  ok('C WhatsApp prerrellenado con el nombre', decodeURIComponent(wa || '').includes('soy María José'), wa);
  ok('C sin Lead si falla', (await page.evaluate(() => window.__fbq.filter((c) => c[1] === 'Lead').length)) === 0);
  ok('C botón vuelve a estar activo', !(await page.locator('[data-submit]').isDisabled()));
  await page.locator('.lead-form__error').screenshot({ path: './error-box.png' });
  // Siguiente visita con el servidor ya bien: se reintenta solo
  await ctx.unroute('https://script.google.com/**');
  const posts2 = [];
  await ctx.route('https://script.google.com/**', (route) => { posts2.push(route.request().postData()); route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"id":"PYP-RETRY"}' }); });
  await page.goto(BASE + '/privacidad', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
  ok('C reintento en la siguiente visita', posts2.length === 1 && JSON.parse(posts2[0]).retried === 'si', String(posts2.length));
  ok('C cola vacía tras reintento', (await page.evaluate(() => localStorage.getItem('pyp_pending_leads'))) === null);
  ok('C sin errores de consola', state.console.length === 0, state.console.join(' | '));
  await ctx.close();
}

/* D. Timeout (servidor tarda 15 s): aborta a los 12 s, reintenta y muestra error */
if (ONLY === 'all' || ONLY === 'D') {
  const { ctx, state } = await newCtx(browser, { mode: 'timeout' });
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('[data-consent-action="reject"]').click();
  await fillForm(page);
  const t0 = Date.now();
  await page.locator('[data-submit]').click();
  await page.waitForTimeout(500);
  ok('D estado "Enviando..." con botón deshabilitado', (await page.locator('[data-submit-label]').textContent()) === 'Enviando...' && (await page.locator('[data-submit]').isDisabled()));
  await page.waitForSelector('[data-form-error]:not([hidden])', { timeout: 30000 }).catch(() => {});
  const secs = (Date.now() - t0) / 1000;
  ok('D error tras 2 timeouts (~24 s)', (await page.locator('[data-form-error]').isVisible()) && secs > 22 && secs < 28, secs.toFixed(1) + ' s');
  ok('D 2 intentos', state.posts.length === 2, String(state.posts.length));
  await ctx.close();
}

/* E. Recarga a mitad: se recupera el paso */
if (ONLY === 'all' || ONLY === 'E') {
  const { ctx, state } = await newCtx(browser);
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('[data-consent-action="reject"]').click();
  await page.locator('#formulario').scrollIntoViewIfNeeded();
  await page.locator('label.option', { hasText: 'De 50 a 59' }).click();
  await page.waitForTimeout(350);
  await page.locator('label.option', { hasText: 'Más de 3 años' }).click();
  await page.waitForTimeout(350);
  await page.locator('#lf-name').fill('Ana');
  await page.reload({ waitUntil: 'networkidle' });
  const step = await page.locator('[data-step-count]').textContent();
  ok('E recupera el paso 3 tras recargar', step === '3', step);
  ok('E recupera el nombre', (await page.locator('#lf-name').inputValue()) === 'Ana');
  ok('E recupera la edad', await page.locator('input[value="De 50 a 59"]').isChecked());
  // Validaciones de teléfono
  await page.locator('[data-next-name]').click();
  await page.waitForTimeout(350);
  const cases = [['612345678', true], ['712 345 678', true], ['512345678', false], ['61234567', false], ['+34 612 345 678', true], ['0034612345678', true]];
  for (const [num, valid] of cases) {
    await page.locator('#lf-phone').fill(num);
    await page.locator('#lf-privacy').uncheck({ force: true });
    await page.locator('[data-submit]').click();
    await page.waitForTimeout(80);
    const err = await page.locator('#lf-phone-error').isVisible();
    ok(`E teléfono ${num} ${valid ? 'válido' : 'inválido'}`, err === !valid);
  }
  // Otro prefijo
  await page.selectOption('#lf-prefix', '+351');
  await page.locator('#lf-phone').fill('912345678');
  await page.locator('[data-submit]').click();
  await page.waitForTimeout(80);
  ok('E +351 con 9 dígitos válido', !(await page.locator('#lf-phone-error').isVisible()));
  ok('E error de privacidad visible sin marcar', await page.locator('#lf-privacy-error').isVisible());
  ok('E sin errores de consola', state.console.length === 0, state.console.join(' | '));
  await ctx.close();
}

/* F. Píxel real de Meta + CSP (ID falso): sin violaciones de CSP */
if (ONLY === 'all' || ONLY === 'F') {
  const { ctx, state } = await newCtx(browser, { realPixel: true, mobile: false });
  const page = await ctx.newPage(); watch(page, state);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('[data-consent-action="accept"]').click();
  await page.waitForTimeout(3000);
  const tr = state.fbRequests.filter((u) => u.includes('facebook.com/tr'));
  ok('F fbevents real cargado', state.fbRequests.some((u) => u.includes('fbevents.js')), state.fbRequests.slice(0, 3).join(' '));
  ok('F PageView enviado a facebook.com/tr', tr.some((u) => u.includes('ev=PageView')), tr.slice(0, 2).join(' '));
  ok('F sin violaciones de CSP', state.csp.length === 0, state.csp.join(' | '));
  results.push('INFO consola con píxel real: ' + (state.console.join(' | ') || 'limpia'));
  // Revocar
  await page.locator('.site-footer [data-open-cookies]').click();
  await page.locator('[data-cookie-marketing]').uncheck({ force: true });
  await page.locator('[data-cookie-save]').click();
  await page.waitForTimeout(300);
  const cookies = await ctx.cookies();
  ok('F revocar borra _fbp', !cookies.some((c) => c.name === '_fbp'), cookies.map((c) => c.name).join(','));
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
