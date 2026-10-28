// Cero fugas: ningún enlace saca a la usuaria de la web antes de enviar el formulario.
// Se ejecuta sobre dist/ (npm test hace el build antes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dist = new URL('../../dist/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dist), 'utf8');
const SITE_HOST = 'www.pomposoypeligroso.com';

/** Enlaces <a href>, sin contar <link> del <head> (canonical, iconos, fuentes). */
function anchors(html) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = m[0];
    const href = tag.match(/\bhref="([^"]*)"/i)?.[1] ?? '';
    out.push({ tag, href, blank: /\btarget="_blank"/i.test(tag) });
  }
  return out;
}

const isExternal = (href) => /^(https?:)?\/\//i.test(href) && !href.includes(SITE_HOST);
const CONTACT_RE = /wa\.me|api\.whatsapp|whatsapp:\/\/|^tel:|^mailto:|instagram\.com|facebook\.com|tiktok\.com|t\.me/i;

test('existe el build', () => {
  assert.ok(fs.existsSync(new URL('index.html', dist)), 'ejecuta npm run build antes');
});

for (const page of ['index.html', '404.html']) {
  test(`${page}: sin ningún enlace externo ni de contacto`, () => {
    const bad = anchors(read(page)).filter((a) => isExternal(a.href) || CONTACT_RE.test(a.href));
    assert.deepEqual(bad.map((a) => a.href), []);
  });
}

test('index.html: el HTML no lleva ningún wa.me (los de error y gracias los pone form.ts)', () => {
  assert.ok(!/wa\.me|api\.whatsapp/i.test(read('index.html')));
});

test('gracias.html: el único enlace externo es el de WhatsApp', () => {
  const ext = anchors(read('gracias.html')).filter((a) => isExternal(a.href) || CONTACT_RE.test(a.href));
  assert.ok(ext.length >= 1, 'tiene el botón de WhatsApp');
  for (const a of ext) assert.match(a.href, /^https:\/\/wa\.me\/34644117740\b/, a.href);
});

test('legales: solo enlaces externos de referencia (AEPD, ayuda de navegadores y política de Meta)', () => {
  const allowed = [
    /^https:\/\/www\.aepd\.es\/?$/,
    /^https:\/\/www\.facebook\.com\/privacy\/policy\/?$/,
    /^https:\/\/support\.google\.com\/chrome\//,
    /^https:\/\/support\.apple\.com\/es-es\//,
    /^https:\/\/support\.mozilla\.org\/es\//,
    /^https:\/\/support\.microsoft\.com\/es-es\//,
  ];
  for (const page of ['privacidad.html', 'cookies.html', 'aviso-legal.html']) {
    for (const a of anchors(read(page))) {
      if (/^(tel|mailto):/i.test(a.href)) assert.fail(`${page}: enlace de contacto ${a.href}`);
      if (!isExternal(a.href)) continue;
      assert.ok(allowed.some((re) => re.test(a.href)), `${page}: enlace externo no permitido ${a.href}`);
    }
  }
});

test('todos los enlaces a /privacidad, /cookies y /aviso-legal se abren en pestaña nueva', () => {
  const pages = fs.readdirSync(dist).filter((f) => f.endsWith('.html'));
  const bad = [];
  for (const page of pages) {
    for (const a of anchors(read(page))) {
      if (/^\/(privacidad|cookies|aviso-legal)(\/|#|$)/.test(a.href) && !a.blank) bad.push(`${page}: ${a.href}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('todos los CTA llevan al formulario', () => {
  for (const page of ['index.html']) {
    const ctas = anchors(read(page)).filter((a) => /\bdata-cta="/.test(a.tag));
    assert.ok(ctas.length >= 10, `${page}: hay CTA`);
    for (const a of ctas) assert.match(a.href, /^\/?#formulario$/, `${page}: ${a.tag}`);
  }
});

test('ningún texto de la web menciona a Claude ni a una IA', () => {
  const pages = fs.readdirSync(dist).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const text = read(page).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
    assert.ok(!/\bclaude\b/i.test(text), `${page} menciona Claude`);
  }
});
