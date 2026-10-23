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

const N_COLS = 10;

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
      if (typeof v === 'string' && v.startsWith('=')) cell.f = v; else cell.v = v;
    }));
    return this;
  }
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
  row(r) { const out = []; for (let c = 1; c <= N_COLS; c++) out.push((this.cells.get(`${r},${c}`) || {}).v); return out; }
}

/** Objeto "comodín" para setup(): acepta cualquier llamada encadenada y registra las llamadas. */
function chainable(log, overrides = {}) {
  const handler = {
    get(_t, prop) {
      if (prop in overrides) return overrides[prop];
      if (prop === 'then') return undefined;
      return (...args) => {
        log.calls.push(prop);
        log.args.push([prop, args]);
        return proxy;
      };
    },
  };
  const proxy = new Proxy(function () {}, handler);
  return proxy;
}

function makeLeadsSheet() {
  const sh = new FakeSheet('Leads');
  for (let c = 1; c <= N_COLS; c++) sh.cell(1, c).v = `col${c}`;
  return sh;
}

function makeContext({ leadsSheet = makeLeadsSheet(), setupMode = null } = {}) {
  const mails = [];
  const log = { calls: [], args: [] };
  let spreadsheet;
  if (setupMode) {
    const sheetMock = (header) => chainable(log, {
      getMaxRows: () => 1000, getMaxColumns: () => 35, getLastRow: () => 0, getFilter: () => null,
      getRange: () => chainable(log, { getValue: () => header }),
    });
    const sheets = {};
    if (setupMode.existing !== undefined) sheets.Leads = sheetMock(setupMode.existing);
    if (setupMode.oldSummary) sheets.Resumen = sheetMock('');
    spreadsheet = chainable(log, {
      getSheetByName: (n) => sheets[n] || null,
      insertSheet: (n) => (sheets[n] = sheetMock('')),
      getSheets: () => Object.values(sheets),
      deleteSheet: (s) => { log.calls.push('deleteSheet:' + Object.keys(sheets).find((k) => sheets[k] === s)); },
    });
  } else {
    spreadsheet = { getSheetByName: (n) => (n === 'Leads' ? leadsSheet : null) };
  }
  const ctx = {
    console: { error: () => {}, log: () => {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }),
    },
    MailApp: { sendEmail: (o) => mails.push(o) },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet },
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
  event_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
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

test('la hoja solo tiene fecha y hora juntas, los datos del formulario y los cinco utm', () => {
  const { ctx } = makeContext();
  assert.equal(ctx.COLUMNS.length, N_COLS);
  assert.deepEqual(
    JSON.parse(JSON.stringify(ctx.COLUMNS)).map((c) => c[0]),
    ['Fecha y hora', 'Nombre', 'Teléfono', 'Edad', 'Experiencia', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
  );
});

test('buildRow_ devuelve las columnas en el orden de la hoja', () => {
  const { ctx } = makeContext();
  const lead = ctx.validateLead_(valid()).lead;
  const when = new Date();
  const row = ctx.buildRow_(lead, when);
  assert.equal(row.length, N_COLS);
  assert.equal(row[0], when);
  assert.equal(row[1], 'María José');
  assert.equal(row[2], '+34612345678');
  assert.equal(row[3], 'De 30 a 39');
  assert.equal(row[4], 'Nunca he entrenado');
  assert.equal(row.slice(5).join('|'), 'ig|paid_social|Captación octubre|Anuncio 1|Mujeres 30-45');
});

/* ---------- doGet / doPost ---------- */
test('doGet responde alive', () => {
  const { ctx } = makeContext();
  assert.deepEqual(JSON.parse(ctx.doGet().content), { ok: true, status: 'alive' });
});

test('doPost escribe una fila y responde ok', () => {
  const { ctx, leadsSheet } = makeContext();
  const res = post(ctx, valid());
  assert.deepEqual(res, { ok: true });
  const row = leadsSheet.row(2);
  assert.equal(Object.prototype.toString.call(row[0]), '[object Date]');
  assert.equal(leadsSheet.cell(2, 1).fmt, 'dd/mm/yyyy HH:mm');
  assert.equal(row[2], '+34612345678');
  assert.equal(leadsSheet.cell(2, 3).fmt, '@', 'el teléfono se guarda como texto');
  assert.equal(row[8], 'Anuncio 1');
});

test('doPost ignora cualquier dato que no sea de la hoja', () => {
  const { ctx, leadsSheet } = makeContext();
  post(ctx, { ...valid(), referrer: 'https://x', user_agent: 'UA', fbclid: 'abc', time_to_complete: 1, device: 'móvil' });
  assert.equal(leadsSheet.getLastRow(), 2);
  const stored = leadsSheet.row(2).join('|');
  assert.ok(!/https:\/\/x|UA|abc|móvil/.test(stored));
  assert.equal(leadsSheet.cell(2, N_COLS + 1).v, undefined, 'no escribe columnas de más');
});

test('doPost no duplica el mismo teléfono en 10 minutos', () => {
  const { ctx, leadsSheet } = makeContext();
  post(ctx, valid());
  const b = post(ctx, { ...valid(), name: 'Otra' });
  assert.deepEqual(b, { ok: true, duplicate: true });
  assert.equal(leadsSheet.getLastRow(), 2);
  const c = post(ctx, { ...valid(), phone: '+34699999999' });
  assert.equal(c.ok, true);
  assert.equal(leadsSheet.getLastRow(), 3);
});

test('doPost descarta el honeypot sin escribir ni avisar', () => {
  const { ctx, leadsSheet, mails } = makeContext();
  const res = post(ctx, { ...valid(), website: 'http://spam' });
  assert.equal(res.ok, true);
  assert.equal(leadsSheet.getLastRow(), 1);
  assert.equal(mails.length, 0);
});

test('doPost nunca escribe sobre la cabecera aunque la hoja esté vacía', () => {
  const { ctx, leadsSheet } = makeContext({ leadsSheet: new FakeSheet('Leads') });
  post(ctx, valid());
  assert.equal(leadsSheet.getLastRow(), 2);
});

test('doPost neutraliza inyección de fórmulas', () => {
  const { ctx, leadsSheet } = makeContext();
  post(ctx, { ...valid(), utm_content: '=IMPORTXML("http://x","//a")', name: 'Ana' });
  assert.equal(leadsSheet.row(2)[8], `'=IMPORTXML("http://x","//a")`);
});

test('doPost devuelve errores sin detalles internos', () => {
  const { ctx } = makeContext();
  assert.deepEqual(post(ctx, ''), { ok: false, error: 'empty_body' });
  assert.deepEqual(post(ctx, '{no json'), { ok: false, error: 'invalid_json' });
  assert.deepEqual(post(ctx, { ...valid(), phone: '123' }), { ok: false, error: 'invalid_phone' });
  assert.deepEqual(JSON.parse(ctx.doPost(undefined).content), { ok: false, error: 'empty_body' });
});

test('doPost avisa por email a aaswebmarketing@gmail.com', () => {
  const { ctx, mails } = makeContext();
  post(ctx, valid());
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'aaswebmarketing@gmail.com');
  assert.match(mails[0].body, /wa\.me\/34612345678/);
  assert.match(mails[0].body, /Anuncio: Anuncio 1/);
  assert.match(mails[0].subject, /María José/);
});

test('doPost no avisa de un duplicado ni si NOTIFY_EMAIL está vacío', () => {
  const { ctx, mails } = makeContext();
  post(ctx, valid());
  post(ctx, valid());
  assert.equal(mails.length, 1);
  vm.runInContext("NOTIFY_EMAIL = '';", ctx);
  post(ctx, { ...valid(), phone: '+34699999999' });
  assert.equal(mails.length, 1);
});

/* ---------- setup ---------- */
test('setup() crea la hoja Leads cuando no existe', () => {
  const { ctx, log } = makeContext({ setupMode: {} });
  ctx.setup();
  assert.ok(log.calls.includes('setFrozenRows'));
  assert.ok(log.calls.includes('createFilter'));
  assert.ok(!log.calls.includes('clear'), 'no borra nada en una hoja nueva');
});

test('setup() con el diseño antiguo lo limpia y quita el Resumen', () => {
  const { ctx, log } = makeContext({ setupMode: { existing: 'Fecha', oldSummary: true } });
  ctx.setup();
  assert.ok(log.calls.includes('clear'));
  assert.ok(log.calls.includes('clearDataValidations'));
  assert.ok(log.calls.includes('deleteColumns'));
  assert.ok(log.calls.includes('deleteSheet:Resumen'));
});

test('setup() con la hoja ya nueva conserva los leads', () => {
  const { ctx, log } = makeContext({ setupMode: { existing: 'Fecha y hora' } });
  ctx.setup();
  assert.ok(!log.calls.includes('clear'));
  assert.ok(!log.calls.includes('deleteSheet:Resumen'));
  assert.ok(log.calls.includes('createFilter'));
});
