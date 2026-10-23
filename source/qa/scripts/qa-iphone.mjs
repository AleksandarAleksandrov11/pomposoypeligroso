import { chromium } from 'playwright';
const out = process.argv[2];
const devices = [['iPhone SE', 375, 667, 2], ['iPhone 13 mini', 375, 812, 3], ['iPhone 15', 393, 852, 3], ['iPhone 15 Pro Max', 430, 932, 3]];
const uas = { safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0' };
const b = await chromium.launch();
for (const [name, w, h, dpr] of devices) for (const [uaName, ua] of Object.entries(uas)) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: ua, locale: 'es-ES' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  const t0 = Date.now(); await p.goto('http://127.0.0.1:4400/', { waitUntil: 'load' }); const load = Date.now() - t0;
  const r = await p.evaluate(async () => {
    const lcp = await new Promise((res) => new PerformanceObserver((l) => res(l.getEntries().at(-1)?.startTime)).observe({ type: 'largest-contentful-paint', buffered: true }));
    const cta = document.querySelector('[data-hero-cta]').getBoundingClientRect();
    const banner = document.querySelector('[data-cookie-banner]'); const bn = banner.hidden ? null : banner.getBoundingClientRect();
    return { lcp: Math.round(lcp), ctaBottom: Math.round(cta.bottom), vh: innerHeight, overflowX: document.documentElement.scrollWidth > innerWidth,
      bannerTapaCTA: bn ? !(bn.bottom <= cta.top || bn.top >= cta.bottom) : false, pantallas: (document.documentElement.scrollHeight / innerHeight).toFixed(1),
      form: (document.querySelector('#formulario').getBoundingClientRect().top / innerHeight).toFixed(1) };
  });
  if (uaName === 'safari') await p.screenshot({ path: `${out}/${name.replace(/ /g, '-')}.png` });
  console.log(`${name} (${uaName}): carga ${load} ms, LCP ${r.lcp} ms, CTA ${r.ctaBottom <= r.vh ? 'visible' : 'FUERA'} (${r.ctaBottom}/${r.vh}), scroll-x ${r.overflowX ? 'SÍ' : 'no'}, banner tapa CTA ${r.bannerTapaCTA ? 'SÍ' : 'no'}, ${r.pantallas} pantallas, formulario en pantalla ${r.form}, errores ${errs.length}`);
  await ctx.close();
}
await b.close();
