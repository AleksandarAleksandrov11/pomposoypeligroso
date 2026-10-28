// Funciones puras del formulario (src/lib/lead.ts) y de la versión del anuncio (src/data/ad-variants.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  normalizePrefix,
  isServerValidPhone,
  nameProblem,
  validName,
  cleanName,
  firstNameForMatching,
  countryFromPhone,
  phoneDigits,
  whatsappMessage,
  whatsappErrorMessage,
  whatsappLink,
  isUuid,
  uuidv4,
  fbcFromFbclid,
  COUNTRY_BY_PREFIX,
} from '../../src/lib/lead.ts';
import { pickVariant, pickPreselect, AD_PRESELECT, DEFAULT_VARIANT } from '../../src/data/ad-variants.ts';
import { COUNTRY_BY_PREFIX as SERVER_COUNTRIES } from '../../api/_lib/capi.js';

/* Copia literal de validName_ y validPhone_ de apps-script/Code.gs: el navegador no puede aceptar lo que el servidor rechaza */
function serverValidName(name) {
  if (typeof name !== 'string') return false;
  const v = name.trim();
  return v.length >= 2 && v.length <= 60 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(v);
}
function serverValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  if (!/^\+\d{7,16}$/.test(phone)) return false;
  if (phone.indexOf('+34') === 0) return /^\+34[6789]\d{8}$/.test(phone);
  return true;
}

test('normalizePrefix', () => {
  assert.equal(normalizePrefix('+33'), '+33');
  assert.equal(normalizePrefix('0033'), '+0033');
  assert.equal(normalizePrefix('351'), '+351');
  assert.equal(normalizePrefix(''), null);
  assert.equal(normalizePrefix('+12345'), null);
});

test('normalizePhone acepta formatos habituales y devuelve E.164', () => {
  assert.equal(normalizePhone('+34', '612 345 678'), '+34612345678');
  assert.equal(normalizePhone('+34', '+34 612 345 678'), '+34612345678');
  assert.equal(normalizePhone('+34', '0034612345678'), '+34612345678');
  assert.equal(normalizePhone('+34', '34612345678'), '+34612345678');
  assert.equal(normalizePhone('+34', '712-345-678'), '+34712345678');
  assert.equal(normalizePhone('+351', '912 345 678'), '+351912345678');
  assert.equal(normalizePhone('+1', '555 123 4567'), '+15551234567');
});

test('normalizePhone rechaza lo que rechazaría el Apps Script', () => {
  assert.equal(normalizePhone('+34', '512 345 678'), null);
  assert.equal(normalizePhone('+34', '61234567'), null);
  assert.equal(normalizePhone('+593', '123456789012345'), null, 'más de 16 cifras en total');
  assert.equal(normalizePhone('+1', '12345'), null);
  for (const [pre, raw] of [
    ['+34', '612345678'],
    ['+351', '912345678'],
    ['+593', '991234567'],
    ['+1', '5551234567'],
    ['+44', '7700900123'],
    ['+1234', '123456789012'],
  ]) {
    const p = normalizePhone(pre, raw);
    if (p) assert.ok(serverValidPhone(p), `${pre} ${raw} -> ${p} lo aceptaría el servidor`);
    if (p) assert.ok(isServerValidPhone(p));
  }
});

test('validación del nombre: igual que validName_ del Apps Script', () => {
  const cases = ['María José', 'Łucja', 'Анна', '李娜', 'A', 'Al', '  Ana  ', 'x'.repeat(61), '12', 'O\'Neill', 'Zoë', 'Ñu', '\u{1F642}\u{1F642}'];
  for (const c of cases) {
    assert.equal(validName(c), serverValidName(cleanName(c)), `"${c}"`);
  }
  assert.equal(nameProblem('Анна'), 'charset', 'letras que el servidor no admite: mensaje específico');
  assert.equal(nameProblem('A'), 'short');
  assert.equal(nameProblem('12'), 'short');
  assert.equal(nameProblem('María'), null);
});

test('nombre de pila para la coincidencia avanzada', () => {
  assert.equal(firstNameForMatching('  María José '), 'maría');
  assert.equal(firstNameForMatching("O'Neill Smith"), 'oneill');
  assert.equal(firstNameForMatching('ÁNGELA'), 'ángela');
});

test('deducción del país por el prefijo', () => {
  assert.equal(countryFromPhone('+34612345678'), 'es');
  assert.equal(countryFromPhone('+351912345678'), 'pt');
  assert.equal(countryFromPhone('+593991234567'), 'ec');
  assert.equal(countryFromPhone('+51912345678'), 'pe');
  assert.equal(countryFromPhone('+447700900123'), 'gb');
  assert.equal(countryFromPhone('+15551234567'), null, '+1 es EE. UU. o Canadá: no se deduce');
  assert.equal(countryFromPhone('+81312345678'), null);
  assert.equal(phoneDigits('+34 612-345-678'), '34612345678');
});

test('la tabla de países del navegador y la de la API de conversiones coinciden', () => {
  const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [String(k), v]).sort());
  assert.deepEqual(norm(COUNTRY_BY_PREFIX), norm(SERVER_COUNTRIES));
});

test('texto de WhatsApp tras enviar', () => {
  const base = { name: ' María  José ', age_range: 'De 40 a 49', experience: 'Menos de 1 año' };
  assert.equal(
    whatsappMessage(base),
    'Hola, soy María José. Acabo de rellenar el formulario de Pomposo y Peligroso. Edad: De 40 a 49. Experiencia: Menos de 1 año. Quiero información sobre el programa.',
  );
  assert.equal(
    whatsappMessage({ ...base, fromFaq: true }),
    'Hola, soy María José. Acabo de rellenar el formulario de Pomposo y Peligroso. Edad: De 40 a 49. Experiencia: Menos de 1 año. Quiero información sobre el programa. Tengo una duda: ',
  );
  const err = whatsappErrorMessage({ ...base, phone: '+34612345678' });
  assert.match(err, /no se ha enviado/);
  assert.match(err, /\+34612345678/);
  assert.match(err, /De 40 a 49/);
  const link = whatsappLink('34644117740', 'Hola, ñ & más');
  assert.equal(link, 'https://wa.me/34644117740?text=Hola%2C%20%C3%B1%20%26%20m%C3%A1s');
  assert.ok(!/claude|\bIA\b/i.test(whatsappMessage(base)));
});

test('event_id y fbc', () => {
  const id = uuidv4();
  assert.ok(isUuid(id));
  assert.ok(!isUuid('no-es-un-uuid'));
  assert.equal(fbcFromFbclid('abc123', 1700000000000), 'fb.1.1700000000000.abc123');
});

test('versión del inicio según el anuncio', () => {
  assert.equal(pickVariant(null, 'DESCUBRIR_octubre'), 'descubrir');
  assert.equal(pickVariant('', 'descubrir'), 'descubrir');
  assert.equal(pickVariant(null, 'CIERRE - Retargeting'), 'cierre');
  assert.equal(pickVariant(null, 'MOFU/BOFU noviembre'), 'cierre');
  assert.equal(pickVariant('video_cierre_1', 'DESCUBRIR'), 'cierre', 'utm_content manda si encaja');
  assert.equal(pickVariant('video_1', 'DESCUBRIR'), 'descubrir', 'si utm_content no encaja, se mira utm_campaign');
  assert.equal(pickVariant(null, null), null);
  assert.equal(pickVariant('otra cosa', 'otra campaña'), null);
  assert.equal(DEFAULT_VARIANT, 'descubrir');
});

test('preselección por anuncio: tabla preparada y vacía', () => {
  assert.equal(AD_PRESELECT.length, 0);
  assert.equal(pickPreselect('cualquier_anuncio'), null);
});
