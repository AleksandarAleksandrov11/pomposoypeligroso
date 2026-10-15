// Pruebas de apps-script/Code.gs en Node (node --test apps-script/test/).
// Se carga Code.gs en un contexto aislado con los servicios de Google simulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(here, '..', 'Code.gs'), 'utf8');

/* ---------- Simulación de una hoja en memoria ---------- */
class FakeRange {
  constructor(sheet, row, col, nr = 1, nc = 1) {
    Object.assign(this, { sheet, row, col, nr, nc });
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nr; r++) {
      const line = [];
      for (let c = 0; c < this.nc; c++) line.push(this.sheet.cell(this.row + r, this.col + c).v ?? '');
      out.push(line);
    }
    return out;
  }
  setValues(vals) {
    vals.forEach((line, r) => line.forEach((v, c) => {
      const cell = this.sheet.cell(this.row + r, this.col + c);
      // Igual que Sheets: un texto que empieza por "=" es una fórmula
      if (typeof v === 'string' && v.startsWith('=')) cell.f = v; else cell.v = v;
    }));
    return this;
  }
  setFormula(f) { this.sheet.cell(this.row, this.col).f = f; return this; }
  setNumberFormat(fmt) {
    for (let r = 0; r < this.nr; r++) for (let c = 0; c < this.nc; c++) this.sheet.cell(this.row + r, this.col + c).fmt = fmt;
    return this;
  }
}
class FakeSheet {
  constructor(name) { this.name = name; this.cells = new Map(); }
  cell(r, c) { const k = `${r},${c}`; if (!this.cells.has(k)) this.cells.set(k, {}); return this.cells.get(k); }
  getLastRow() { let m = 0; for (const [k, v] of this.cells) if (v.v !== undefined && v.v !== '' || v.f) m = Math.max(m, +k.split(',')[0]); return m; }
  getRange(r, c, nr, nc) { return new FakeRange(this, r, c, nr, nc); }
  row(r) { const out = []; for (let c = 1; c <= 35; c++) { const cell = this.cells.get(`${r},${c}`) || {}; out.push(cell.f ?? cell.v); } return out; }
}

/** Objeto "comodín" para setup(): acepta cualquier llamada encadenada y registra fórmulas. */
function chainable(log, overrides = {}) {
  const handler = {
    get(_t, prop) {
      if (prop in overrides) return overrides[prop];
      if (prop === 'then') return undefined;
      return (...args) => {
        if (prop === 'setFormula') log.formulas.push(args[0]);
        if (prop === 'setValue' || prop === 'setValues') log.values.push(args[0]);
        log.calls.push(prop);
        return proxy;
      };
    },
  };
  const proxy = new Proxy(function () {}, handler);
  return proxy;
}

function makeLeadsSheet() {
  const sh = new FakeSheet('Leads');
  for (let c = 1; c <= 35; c++) sh.cell(1, c).v = `col${c}`; // cabecera, como deja setup()
  return sh;
}

function makeContext({ leadsSheet = makeLeadsSheet(), setupMode = false } = {}) {
  const mails = [];
  const log = { formulas: [], values: [], calls: [] };
  let spreadsheet;
  if (setupMode) {
    const sheetMock = () => chainable(log, {
      getMaxRows: () => 1000, getMaxColumns: () => 26, getLastRow: () => 0, getFilter: () => null, getCharts: () => [],
    });
    const sheets = {};
    spreadsheet = chainable(log, {
      getSheetByName: (n) => sheets[n] || null,
      insertSheet: (n) => (sheets[n] = sheetMock()),
      getSheets: () => Object.values(sheets),
      setActiveSheet: () => {},
      setSpreadsheetTimeZone: () => {},
      setSpreadsheetLocale: () => {},
      deleteSheet: () => {},
    });
  } else {
    spreadsheet = { getSheetByName: (n) => (n === 'Leads' ? leadsSheet : null) };
  }
  const ctx = {
    console: { error: () => {}, log: () => {} },
    Utilities: {
      formatDate: (d, tz, pattern) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
        return pattern.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day);
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }),
    },
    MailApp: { sendEmail: (o) => mails.push(o) },
    SpreadsheetApp: chainable(log, {
      getActiveSpreadsheet: () => spreadsheet,
      openById: () => spreadsheet,
      BorderStyle: { SOLID: 'SOLID', SOLID_THICK: 'SOLID_THICK' },
      newDataValidation: () => chainable(log),
      newConditionalFormatRule: () => chainable(log),
    }),
    Charts: { ChartType: { BAR: 'BAR', LINE: 'LINE' } },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, mails, log, leadsSheet };
}

const valid = () => ({
  age_range: 'De 30 a 39',
  experience: 'Nunca he entrenado',
  name: 'María José',
  phone: '+34612345678',
  utm_source: 'ig',
  utm_medium: 'paid_social',
  utm_campaign: 'Captación octubre',
  utm_content: 'Anuncio 1',
  utm_term: 'Mujeres 30-45',
  utm_id: '120200000000001',
  campaign_id: '120200000000001',
  adset_id: '120200000000002',
  ad_id: '120200000000003',
  placement: 'Instagram_Stories',
  fbclid: 'abc',
  fbc: 'fb.1.1700000000000.abc',
  fbp: 'fb.1.1700000000000.123',
  landing_url: 'https://example.com/?utm_source=ig',
  page_url: 'https://example.com/',
  referrer: '',
  first_touch: '{"utm_source":"ig"}',
  last_touch: '{"utm_source":"ig"}',
  device: 'móvil',
  user_agent: 'Mozilla/5.0 Instagram',
  in_app_browser: 'Instagram',
  screen: '390x844',
  language: 'es-ES',
  event_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  submitted_at: new Date().toISOString(),
  time_to_complete: 25,
  consent_marketing: 'si',
  website: '',
});
const post = (ctx, body) => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).content);

/* ---------- Funciones puras ---------- */
test('sanitize_ neutraliza fórmulas y limita longitud', () => {
  const { ctx } = makeContext();
  assert.equal(ctx.sanitize_('=HYPERLINK("x")'), `'=HYPERLINK("x")`);
  assert.equal(ctx.sanitize_('+34 hola'), `'+34 hola`);
  assert.equal(ctx.sanitize_('-1'), `'-1`);
  assert.equal(ctx.sanitize_('@cmd'), `'@cmd`);
  assert.equal(ctx.sanitize_('normal'), 'normal');
  assert.equal(ctx.sanitize_('abcdef', 3), 'abc');
  assert.equal(ctx.sanitize_(null), '');
});

test('validPhone_ aplica las reglas de +34 y del resto de prefijos', () => {
  const { ctx } = makeContext();
  for (const p of ['+34612345678', '+34712345678', '+34812345678', '+34912345678', '+351912345678', '+15551234567']) assert.ok(ctx.validPhone_(p), p);
  for (const p of ['+34512345678', '+3461234567', '612345678', '+34 612345678', '+34612345678a', '']) assert.ok(!ctx.validPhone_(p), p);
});

test('validateLead_ rechaza datos fuera de los valores permitidos', () => {
  const { ctx } = makeContext();
  assert.equal(ctx.validateLead_(valid()).ok, true);
  assert.equal(ctx.validateLead_({ ...valid(), name: 'A' }).error, 'invalid_name');
  assert.equal(ctx.validateLead_({ ...valid(), phone: '+34512345678' }).error, 'invalid_phone');
  assert.equal(ctx.validateLead_({ ...valid(), age_range: '25' }).error, 'invalid_age_range');
  assert.equal(ctx.validateLead_({ ...valid(), experience: 'Mucho' }).error, 'invalid_experience');
  assert.equal(ctx.validateLead_(null).error, 'invalid_payload');
});

test('validateLead_ marca sospechosos (honeypot o < 3 s)', () => {
  const { ctx } = makeContext();
  assert.equal(ctx.validateLead_({ ...valid(), time_to_complete: 1 }).lead.suspicious, true);
  assert.equal(ctx.validateLead_({ ...valid(), website: 'spam' }).lead.suspicious, true);
  assert.equal(ctx.validateLead_(valid()).lead.suspicious, false);
});

test('computeOrigin_ clasifica el origen', () => {
  const { ctx } = makeContext();
  const o = (x) => ctx.computeOrigin_({ utm_source: '', utm_medium: '', referrer: '', fbclid: '', in_app: 'No', ...x });
  assert.equal(o({ fbclid: 'abc' }), 'Meta Ads');
  assert.equal(o({ utm_source: 'fb', utm_medium: 'paid_social' }), 'Meta Ads');
  assert.equal(o({ utm_source: 'instagram' }), 'Instagram orgánico');
  assert.equal(o({ referrer: 'https://l.instagram.com/' }), 'Instagram orgánico');
  assert.equal(o({ in_app: 'Facebook' }), 'Facebook orgánico');
  assert.equal(o({ referrer: 'https://www.google.com/' }), 'Google');
  assert.equal(o({}), 'Directo');
  assert.equal(o({ utm_source: 'newsletter' }), 'Campaña: newsletter');
  assert.equal(o({ referrer: 'https://www.blog.com/post' }), 'Referido: blog.com');
});

test('makeLeadId_ tiene el formato PYP-AAAAMMDD-XXXX', () => {
  const { ctx } = makeContext();
  assert.match(ctx.makeLeadId_(new Date('2026-10-15T10:00:00Z')), /^PYP-20261015-[A-Z2-9]{4}$/);
});

test('buildRow_ devuelve 35 columnas en el orden de la hoja', () => {
  const { ctx } = makeContext();
  const lead = ctx.validateLead_(valid()).lead;
  const row = ctx.buildRow_(lead, 'PYP-1', new Date());
  assert.equal(row.length, 35);
  assert.equal(ctx.COLUMNS.length, 35);
  assert.equal(row[2], 'PYP-1');
  assert.equal(row[3], 'María José');
  assert.equal(row[4], '+34612345678');
  assert.equal(row[8], 'Nuevo');
  assert.equal(row[13], 'Anuncio 1');
  assert.equal(row[20], 'Meta Ads');
  assert.equal(row[25], 'Sí');
  assert.equal(row[27], 'Instagram');
  assert.equal(row[34], 'No');
});

/* ---------- doGet / doPost ---------- */
test('doGet responde alive', () => {
  const { ctx } = makeContext();
  assert.deepEqual(JSON.parse(ctx.doGet().content), { ok: true, status: 'alive' });
});

test('doPost escribe una fila completa y responde ok con id', () => {
  const { ctx, leadsSheet } = makeContext();
  const res = post(ctx, valid());
  assert.equal(res.ok, true);
  assert.match(res.id, /^PYP-\d{8}-[A-Z2-9]{4}$/);
  const row = leadsSheet.row(2);
  assert.equal(row[2], res.id);
  assert.equal(row[4], '+34612345678');
  assert.equal(leadsSheet.cell(2, 5).fmt, '@', 'el teléfono se guarda como texto');
  assert.equal(row[5], '=HYPERLINK("https://wa.me/34612345678","Abrir chat")');
  assert.equal(Object.prototype.toString.call(row[0]), '[object Date]');
  assert.equal(row[32], 25);
  assert.equal(row[34], 'No');
});

test('doPost no duplica el mismo teléfono en 10 minutos', () => {
  const { ctx, leadsSheet } = makeContext();
  const a = post(ctx, valid());
  const b = post(ctx, { ...valid(), name: 'Otra' });
  assert.equal(b.ok, true);
  assert.equal(b.duplicate, true);
  assert.equal(b.id, a.id);
  assert.equal(leadsSheet.getLastRow(), 2);
  const c = post(ctx, { ...valid(), phone: '+34699999999' });
  assert.equal(c.ok, true);
  assert.equal(leadsSheet.getLastRow(), 3);
});

test('doPost descarta el honeypot sin escribir', () => {
  const { ctx, leadsSheet } = makeContext();
  const res = post(ctx, { ...valid(), website: 'http://spam' });
  assert.equal(res.ok, true);
  assert.equal(leadsSheet.getLastRow(), 1);
});

test('doPost nunca escribe sobre la cabecera aunque la hoja esté vacía', () => {
  const { ctx, leadsSheet } = makeContext({ leadsSheet: new FakeSheet('Leads') });
  post(ctx, valid());
  assert.equal(leadsSheet.getLastRow(), 2);
});

test('doPost marca como sospechoso si se completa en menos de 3 s', () => {
  const { ctx, leadsSheet } = makeContext();
  post(ctx, { ...valid(), time_to_complete: 1 });
  assert.equal(leadsSheet.row(2)[34], 'Sí');
});

test('doPost neutraliza inyección de fórmulas', () => {
  const { ctx, leadsSheet } = makeContext();
  post(ctx, { ...valid(), utm_content: '=IMPORTXML("http://x","//a")', name: 'Ana' });
  assert.equal(leadsSheet.row(2)[13], `'=IMPORTXML("http://x","//a")`);
});

test('doPost devuelve errores sin detalles internos', () => {
  const { ctx } = makeContext();
  assert.deepEqual(post(ctx, ''), { ok: false, error: 'empty_body' });
  assert.deepEqual(post(ctx, '{no json'), { ok: false, error: 'invalid_json' });
  assert.deepEqual(post(ctx, { ...valid(), phone: '123' }), { ok: false, error: 'invalid_phone' });
  assert.deepEqual(JSON.parse(ctx.doPost(undefined).content), { ok: false, error: 'empty_body' });
});

test('doPost envía aviso por email si NOTIFY_EMAIL tiene valor', () => {
  const { ctx, mails } = makeContext();
  vm.runInContext("NOTIFY_EMAIL = 'equipo@example.com';", ctx);
  post(ctx, valid());
  assert.equal(mails.length, 1);
  assert.match(mails[0].body, /wa\.me\/34612345678/);
  assert.match(mails[0].subject, /María José/);
});

/* ---------- setup ---------- */
test('setup() se ejecuta sin errores y genera fórmulas bien formadas', () => {
  const { ctx, log } = makeContext({ setupMode: true });
  ctx.setup();
  ctx.setup(); // idempotente
  assert.ok(log.formulas.length > 50, 'genera las fórmulas del resumen');
  for (const f of log.formulas) {
    assert.ok(f.startsWith('='), f);
    assert.ok(!f.includes(';'), 'sin punto y coma (setFormula usa sintaxis inglesa): ' + f);
    let depth = 0;
    let inStr = false;
    for (const ch of f) {
      if (ch === '"') inStr = !inStr;
      if (inStr) continue;
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      assert.ok(depth >= 0, 'paréntesis desequilibrados: ' + f);
    }
    assert.equal(depth, 0, 'paréntesis desequilibrados: ' + f);
    assert.ok(!inStr, 'comillas sin cerrar: ' + f);
  }
  assert.ok(log.formulas.some((f) => f.includes('MAKEARRAY')), 'tablas cruzadas');
  assert.ok(log.formulas.some((f) => f.includes("'Leads'!N2:N")), 'agrupa por utm_content');
  assert.ok(log.calls.includes('insertChart'), 'crea gráficos');
  assert.ok(log.calls.includes('createFilter'), 'crea filtro');
  assert.ok(log.calls.includes('setDataValidation'), 'desplegable de estado');
});
