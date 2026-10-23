var SPREADSHEET_ID = '';

var NOTIFY_EMAIL = 'aaswebmarketing@gmail.com';

var DUPLICATE_WINDOW_MINUTES = 10;

var TZ = 'Europe/Madrid';
var SHEET_LEADS = 'Leads';

var AGE_OPTIONS = ['Menos de 30', 'De 30 a 39', 'De 40 a 49', 'De 50 a 59', '60 o más'];
var EXPERIENCE_OPTIONS = ['Nunca he entrenado', 'Menos de 1 año', 'Entre 1 y 2 años', 'Entre 2 y 3 años', 'Más de 3 años'];

var COLUMNS = [
  ['Fecha y hora', 130],
  ['Nombre', 170],
  ['Teléfono', 130],
  ['Edad', 115],
  ['Experiencia', 150],
  ['utm_source', 100],
  ['utm_medium', 100],
  ['utm_campaign', 170],
  ['utm_content', 170],
  ['utm_term', 160]
];

var COL = {
  fecha: 1, nombre: 2, telefono: 3, edad: 4, experiencia: 5,
  utm_source: 6, utm_medium: 7, utm_campaign: 8, utm_content: 9, utm_term: 10
};

function doGet() {
  return json_({ ok: true, status: 'alive' });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) return json_({ ok: false, error: 'empty_body' });

    var data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return json_({ ok: false, error: 'invalid_json' });
    }

    var check = validateLead_(data);
    if (!check.ok) return json_({ ok: false, error: check.error });
    var lead = check.lead;

    if (lead.honeypot) return json_({ ok: true });

    var now = new Date();
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = getLeadsSheet_();
      if (isRecentDuplicate_(sheet, lead.phone, now)) return json_({ ok: true, duplicate: true });

      var row = buildRow_(lead, now);
      var r = Math.max(2, sheet.getLastRow() + 1);
      sheet.getRange(r, COL.telefono).setNumberFormat('@');
      sheet.getRange(r, 1, 1, row.length).setValues([row]);
      sheet.getRange(r, COL.fecha).setNumberFormat('dd/mm/yyyy HH:mm');
    } finally {
      lock.releaseLock();
    }

    if (NOTIFY_EMAIL) {
      try {
        notify_(lead);
      } catch (mailErr) {
        console.error('Aviso por email fallido: ' + mailErr);
      }
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function sanitize_(value, maxLen) {
  if (value === null || value === undefined) return '';
  var s = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function validPhone_(phone) {
  if (typeof phone !== 'string') return false;
  if (!/^\+\d{7,16}$/.test(phone)) return false;
  if (phone.indexOf('+34') === 0) return /^\+34[6789]\d{8}$/.test(phone);
  return true;
}

function validName_(name) {
  if (typeof name !== 'string') return false;
  var v = name.trim();
  return v.length >= 2 && v.length <= 60 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(v);
}

function validateLead_(d) {
  if (!d || typeof d !== 'object') return { ok: false, error: 'invalid_payload' };
  if (!validName_(d.name)) return { ok: false, error: 'invalid_name' };
  if (!validPhone_(d.phone)) return { ok: false, error: 'invalid_phone' };
  if (AGE_OPTIONS.indexOf(d.age_range) === -1) return { ok: false, error: 'invalid_age_range' };
  if (EXPERIENCE_OPTIONS.indexOf(d.experience) === -1) return { ok: false, error: 'invalid_experience' };

  return {
    ok: true,
    lead: {
      name: sanitize_(d.name.replace(/\s+/g, ' '), 60),
      phone: d.phone,
      age_range: d.age_range,
      experience: d.experience,
      utm_source: sanitize_(d.utm_source, 200),
      utm_medium: sanitize_(d.utm_medium, 200),
      utm_campaign: sanitize_(d.utm_campaign, 300),
      utm_content: sanitize_(d.utm_content, 300),
      utm_term: sanitize_(d.utm_term, 300),
      honeypot: sanitize_(d.website, 200)
    }
  };
}

function buildRow_(l, now) {
  var row = [];
  row[COL.fecha - 1] = now;
  row[COL.nombre - 1] = l.name;
  row[COL.telefono - 1] = l.phone;
  row[COL.edad - 1] = l.age_range;
  row[COL.experiencia - 1] = l.experience;
  row[COL.utm_source - 1] = l.utm_source;
  row[COL.utm_medium - 1] = l.utm_medium;
  row[COL.utm_campaign - 1] = l.utm_campaign;
  row[COL.utm_content - 1] = l.utm_content;
  row[COL.utm_term - 1] = l.utm_term;
  return row;
}

function getSpreadsheet_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getLeadsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_LEADS);
  }
  return sheet;
}

function isRecentDuplicate_(sheet, phone, now) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var n = Math.min(300, last - 1);
  var start = last - n + 1;
  var stamps = sheet.getRange(start, COL.fecha, n, 1).getValues();
  var phones = sheet.getRange(start, COL.telefono, n, 1).getValues();
  var limit = now.getTime() - DUPLICATE_WINDOW_MINUTES * 60 * 1000;
  for (var i = n - 1; i >= 0; i--) {
    var t = new Date(stamps[i][0]).getTime();
    if (isNaN(t) || t < limit) continue;
    if (String(phones[i][0]).replace(/^'/, '') === phone) return true;
  }
  return false;
}

function notify_(l) {
  var name = l.name.replace(/^'/, '');
  var body = [
    'Nuevo lead en la landing de Pomposo y Peligroso',
    '',
    'Nombre: ' + name,
    'Teléfono: ' + l.phone,
    'Edad: ' + l.age_range,
    'Experiencia: ' + l.experience,
    'Anuncio: ' + (l.utm_content || '(sin anuncio)'),
    'Campaña: ' + (l.utm_campaign || '(sin campaña)'),
    '',
    'Abrir WhatsApp: https://wa.me/' + l.phone.replace(/\D/g, '')
  ].join('\n');
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'Nuevo lead: ' + name + ' (' + l.age_range + ')',
    body: body,
    name: 'Landing Pomposo y Peligroso'
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  var ss = getSpreadsheet_();
  ss.setSpreadsheetTimeZone(TZ);
  ss.setSpreadsheetLocale('es_ES');

  var sheet = ss.getSheetByName(SHEET_LEADS);
  var nCols = COLUMNS.length;
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LEADS, 0);
    var def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  } else if (String(sheet.getRange(1, 1).getValue()) !== COLUMNS[0][0]) {
    var oldFilter = sheet.getFilter();
    if (oldFilter) oldFilter.remove();
    sheet.clear();
    sheet.clearConditionalFormatRules();
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
    if (sheet.getMaxColumns() > nCols) sheet.deleteColumns(nCols + 1, sheet.getMaxColumns() - nCols);
    var oldSummary = ss.getSheetByName('Resumen');
    if (oldSummary) ss.deleteSheet(oldSummary);
  }

  if (sheet.getMaxColumns() < nCols) sheet.insertColumnsAfter(sheet.getMaxColumns(), nCols - sheet.getMaxColumns());
  if (sheet.getMaxRows() < 1000) sheet.insertRowsAfter(sheet.getMaxRows(), 1000 - sheet.getMaxRows());
  var maxRows = sheet.getMaxRows();

  sheet.getRange(1, 1, 1, nCols)
    .setValues([COLUMNS.map(function (c) { return c[0]; })])
    .setFontWeight('bold')
    .setFontColor('#FFFFFF')
    .setBackground('#4B2A91')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  COLUMNS.forEach(function (c, i) { sheet.setColumnWidth(i + 1, c[1]); });

  sheet.getRange(2, 1, maxRows - 1, nCols).setVerticalAlignment('middle').setFontSize(10);
  sheet.getRange(2, COL.fecha, maxRows - 1, 1).setNumberFormat('dd/mm/yyyy HH:mm');
  sheet.getRange(2, COL.telefono, maxRows - 1, 1).setNumberFormat('@');
  sheet.getRange(2, COL.nombre, maxRows - 1, 1).setFontWeight('bold');

  var filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.getRange(1, 1, maxRows, nCols).createFilter();

  ss.setActiveSheet(sheet);
}
