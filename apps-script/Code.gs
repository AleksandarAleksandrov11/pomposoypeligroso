var SPREADSHEET_ID = '';

var NOTIFY_EMAIL = 'aaswebmarketing@gmail.com';

var DISCARD_HONEYPOT = true;

var DUPLICATE_WINDOW_MINUTES = 10;

var MIN_SECONDS = 3;

var RESERVED_ROWS = 40;

var TZ = 'Europe/Madrid';
var SHEET_LEADS = 'Leads';
var SHEET_SUMMARY = 'Resumen';

var AGE_OPTIONS = ['Menos de 30', 'De 30 a 39', 'De 40 a 49', 'De 50 a 59', '60 o más'];
var EXPERIENCE_OPTIONS = ['Nunca he entrenado', 'Menos de 1 año', 'Entre 1 y 2 años', 'Entre 2 y 3 años', 'Más de 3 años'];
var STATUS_OPTIONS = ['Nuevo', 'Contactado', 'No contesta', 'Videollamada agendada', 'Videollamada hecha', 'Alumna', 'Descartada'];

var STATUS_COLORS = {
  'Nuevo': ['#EBE3FF', '#4B2A91'],
  'Contactado': ['#E3F0FF', '#1D4E89'],
  'No contesta': ['#FFF1D6', '#8A5A00'],
  'Videollamada agendada': ['#FFE3F0', '#A2215F'],
  'Videollamada hecha': ['#FCD3E6', '#7D1A4A'],
  'Alumna': ['#D7F5E3', '#1B6B3A'],
  'Descartada': ['#EEEEEE', '#666666']
};

var BRAND = {
  lilac: '#B9A4F2',
  lilac50: '#F5F0FF',
  purple: '#6F42C9',
  purpleDark: '#4B2A91',
  pink: '#F28DB8',
  ink: '#1E1530',
  muted: '#6B6280',
  line: '#ECE6F5',
  white: '#FFFFFF'
};

var COLUMNS = [
  ['Fecha', 95],
  ['Hora', 60],
  ['ID lead', 150],
  ['Nombre', 140],
  ['Teléfono', 130],
  ['WhatsApp', 95],
  ['Tramo de edad', 110],
  ['Experiencia entrenando', 150],
  ['Estado', 175],
  ['Notas', 260],
  ['utm_source', 100],
  ['utm_medium', 100],
  ['utm_campaign', 160],
  ['utm_content (anuncio)', 170],
  ['utm_term (conjunto)', 160],
  ['utm_id', 120],
  ['campaign_id', 130],
  ['adset_id', 130],
  ['ad_id', 130],
  ['placement', 140],
  ['Origen', 140],
  ['fbclid', 140],
  ['fbc', 140],
  ['fbp', 140],
  ['event_id', 140],
  ['Consentimiento marketing', 110],
  ['Dispositivo', 100],
  ['Navegador in-app', 110],
  ['URL de llegada', 220],
  ['Referrer', 160],
  ['Primer contacto (JSON)', 200],
  ['User agent', 200],
  ['Tiempo en completar (s)', 100],
  ['Marca de tiempo ISO', 190],
  ['Sospechoso', 95]
];

var COL = {
  fecha: 1, hora: 2, id: 3, nombre: 4, telefono: 5, whatsapp: 6, edad: 7, experiencia: 8, estado: 9, notas: 10,
  utm_source: 11, utm_medium: 12, utm_campaign: 13, utm_content: 14, utm_term: 15, utm_id: 16,
  campaign_id: 17, adset_id: 18, ad_id: 19, placement: 20, origen: 21, fbclid: 22, fbc: 23, fbp: 24,
  event_id: 25, consent: 26, dispositivo: 27, inapp: 28, landing: 29, referrer: 30, first_touch: 31,
  user_agent: 32, tiempo: 33, iso: 34, sospechoso: 35
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

    if (lead.honeypot && DISCARD_HONEYPOT) {
      return json_({ ok: true, id: '' });
    }

    var now = new Date();
    var id;
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = getLeadsSheet_();
      var duplicate = findRecentDuplicate_(sheet, lead.phone, now);
      if (duplicate) return json_({ ok: true, id: duplicate, duplicate: true });

      id = makeLeadId_(now);
      var row = buildRow_(lead, id, now);
      var r = Math.max(2, sheet.getLastRow() + 1);
      var range = sheet.getRange(r, 1, 1, row.length);
      sheet.getRange(r, COL.telefono).setNumberFormat('@');
      [COL.campaign_id, COL.adset_id, COL.ad_id, COL.utm_id].forEach(function (c) {
        sheet.getRange(r, c).setNumberFormat('@');
      });
      range.setValues([row]);
      sheet.getRange(r, COL.whatsapp).setFormula(whatsappFormula_(lead.phone));
      sheet.getRange(r, COL.fecha).setNumberFormat('dd/mm/yyyy');
      sheet.getRange(r, COL.hora).setNumberFormat('HH:mm');
    } finally {
      lock.releaseLock();
    }

    if (NOTIFY_EMAIL) {
      try {
        notify_(lead, id);
      } catch (mailErr) {
        console.error('Aviso por email fallido: ' + mailErr);
      }
    }

    return json_({ ok: true, id: id });
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

  var seconds = Number(d.time_to_complete);
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  seconds = Math.min(Math.round(seconds), 86400);

  var honeypot = sanitize_(d.website, 200);
  var lead = {
    name: sanitize_(d.name.replace(/\s+/g, ' '), 60),
    phone: d.phone,
    age_range: d.age_range,
    experience: d.experience,
    utm_source: sanitize_(d.utm_source, 200),
    utm_medium: sanitize_(d.utm_medium, 200),
    utm_campaign: sanitize_(d.utm_campaign, 300),
    utm_content: sanitize_(d.utm_content, 300),
    utm_term: sanitize_(d.utm_term, 300),
    utm_id: sanitize_(d.utm_id, 100),
    campaign_id: sanitize_(d.campaign_id, 100),
    adset_id: sanitize_(d.adset_id, 100),
    ad_id: sanitize_(d.ad_id, 100),
    placement: sanitize_(d.placement, 100),
    fbclid: sanitize_(d.fbclid, 500),
    fbc: sanitize_(d.fbc, 600),
    fbp: sanitize_(d.fbp, 200),
    event_id: sanitize_(d.event_id, 100),
    consent: d.consent_marketing === 'si' ? 'Sí' : 'No',
    device: sanitize_(d.device, 30),
    in_app: d.in_app_browser === 'Instagram' || d.in_app_browser === 'Facebook' ? d.in_app_browser : 'No',
    landing_url: sanitize_(d.landing_url, 2000),
    referrer: sanitize_(d.referrer, 1000),
    first_touch: sanitize_(d.first_touch, 3000),
    user_agent: sanitize_(d.user_agent, 500),
    seconds: seconds,
    submitted_at: sanitize_(d.submitted_at, 40),
    honeypot: honeypot
  };
  lead.origin = computeOrigin_(lead);
  lead.suspicious = !!honeypot || seconds < MIN_SECONDS;
  return { ok: true, lead: lead };
}

function computeOrigin_(l) {
  var src = (l.utm_source || '').toLowerCase();
  var med = (l.utm_medium || '').toLowerCase();
  var ref = (l.referrer || '').toLowerCase();
  var metaSource = /^(fb|facebook|ig|instagram|meta|msg|messenger|an|audience_network|threads)$/.test(src);
  var paidMedium = /^(paid_social|paid|cpc|ads?|paidsocial)$/.test(med);
  if (l.fbclid || med === 'paid_social' || (metaSource && paidMedium)) return 'Meta Ads';
  if (/^(ig|instagram)$/.test(src)) return 'Instagram orgánico';
  if (/^(fb|facebook)$/.test(src)) return 'Facebook orgánico';
  if (src) return 'Campaña: ' + l.utm_source.replace(/^'/, '');
  if (/instagram\.com/.test(ref) || l.in_app === 'Instagram') return 'Instagram orgánico';
  if (/(facebook\.com|fb\.com|fb\.me)/.test(ref) || l.in_app === 'Facebook') return 'Facebook orgánico';
  if (/google\./.test(ref)) return 'Google';
  if (!ref) return 'Directo';
  var m = ref.match(/^https?:\/\/([^\/]+)/);
  return 'Referido: ' + (m ? m[1].replace(/^www\./, '') : ref.slice(0, 60));
}

function makeLeadId_(date) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var suffix = '';
  for (var i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'PYP-' + Utilities.formatDate(date, TZ, 'yyyyMMdd') + '-' + suffix;
}

function whatsappFormula_(phone) {
  return '=HYPERLINK("https://wa.me/' + String(phone).replace(/\D/g, '') + '","Abrir chat")';
}

function buildRow_(l, id, now) {
  var row = [];
  row[COL.fecha - 1] = now;
  row[COL.hora - 1] = now;
  row[COL.id - 1] = id;
  row[COL.nombre - 1] = l.name;
  row[COL.telefono - 1] = l.phone;
  row[COL.whatsapp - 1] = '';
  row[COL.edad - 1] = l.age_range;
  row[COL.experiencia - 1] = l.experience;
  row[COL.estado - 1] = 'Nuevo';
  row[COL.notas - 1] = '';
  row[COL.utm_source - 1] = l.utm_source;
  row[COL.utm_medium - 1] = l.utm_medium;
  row[COL.utm_campaign - 1] = l.utm_campaign;
  row[COL.utm_content - 1] = l.utm_content;
  row[COL.utm_term - 1] = l.utm_term;
  row[COL.utm_id - 1] = l.utm_id;
  row[COL.campaign_id - 1] = l.campaign_id;
  row[COL.adset_id - 1] = l.adset_id;
  row[COL.ad_id - 1] = l.ad_id;
  row[COL.placement - 1] = l.placement;
  row[COL.origen - 1] = l.origin;
  row[COL.fbclid - 1] = l.fbclid;
  row[COL.fbc - 1] = l.fbc;
  row[COL.fbp - 1] = l.fbp;
  row[COL.event_id - 1] = l.event_id;
  row[COL.consent - 1] = l.consent;
  row[COL.dispositivo - 1] = l.device;
  row[COL.inapp - 1] = l.in_app;
  row[COL.landing - 1] = l.landing_url;
  row[COL.referrer - 1] = l.referrer;
  row[COL.first_touch - 1] = l.first_touch;
  row[COL.user_agent - 1] = l.user_agent;
  row[COL.tiempo - 1] = l.seconds;
  row[COL.iso - 1] = now.toISOString();
  row[COL.sospechoso - 1] = l.suspicious ? 'Sí' : 'No';
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

function findRecentDuplicate_(sheet, phone, now) {
  var last = sheet.getLastRow();
  if (last < 2) return '';
  var n = Math.min(300, last - 1);
  var start = last - n + 1;
  var ids = sheet.getRange(start, COL.id, n, 1).getValues();
  var phones = sheet.getRange(start, COL.telefono, n, 1).getValues();
  var stamps = sheet.getRange(start, COL.iso, n, 1).getValues();
  var limit = now.getTime() - DUPLICATE_WINDOW_MINUTES * 60 * 1000;
  for (var i = n - 1; i >= 0; i--) {
    var t = new Date(stamps[i][0]).getTime();
    if (isNaN(t) || t < limit) continue;
    if (String(phones[i][0]).replace(/^'/, '') === phone) return String(ids[i][0]);
  }
  return '';
}

function notify_(l, id) {
  var wa = 'https://wa.me/' + l.phone.replace(/\D/g, '');
  var subject = 'Nuevo lead: ' + l.name.replace(/^'/, '') + ' (' + l.age_range + ')';
  var body = [
    'Nuevo lead en la landing de Pomposo y Peligroso',
    '',
    'Nombre: ' + l.name.replace(/^'/, ''),
    'Teléfono: ' + l.phone,
    'Tramo de edad: ' + l.age_range,
    'Experiencia: ' + l.experience,
    'Anuncio: ' + (l.utm_content || '(sin anuncio)'),
    'Origen: ' + l.origin,
    'ID: ' + id,
    '',
    'Abrir WhatsApp: ' + wa
  ].join('\n');
  MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: subject, body: body, name: 'Landing Pomposo y Peligroso' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function setup() {
  var ss = getSpreadsheet_();
  ss.setSpreadsheetTimeZone(TZ);
  ss.setSpreadsheetLocale('es_ES');
  setupLeads_(ss);
  setupSummary_(ss);
  ss.setActiveSheet(ss.getSheetByName(SHEET_LEADS));
}

function setupLeads_(ss) {
  var sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LEADS, 0);
    var def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  var nCols = COLUMNS.length;
  if (sheet.getMaxColumns() < nCols) sheet.insertColumnsAfter(sheet.getMaxColumns(), nCols - sheet.getMaxColumns());
  if (sheet.getMaxRows() < 1000) sheet.insertRowsAfter(sheet.getMaxRows(), 1000 - sheet.getMaxRows());
  var maxRows = sheet.getMaxRows();

  var headers = COLUMNS.map(function (c) { return c[0]; });
  sheet.getRange(1, 1, 1, nCols)
    .setValues([headers])
    .setFontWeight('bold')
    .setFontColor(BRAND.white)
    .setBackground(BRAND.purpleDark)
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 42);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(0);
  COLUMNS.forEach(function (c, i) { sheet.setColumnWidth(i + 1, c[1]); });

  var body = function (col) { return sheet.getRange(2, col, maxRows - 1, 1); };
  body(COL.fecha).setNumberFormat('dd/mm/yyyy');
  body(COL.hora).setNumberFormat('HH:mm');
  [COL.telefono, COL.utm_id, COL.campaign_id, COL.adset_id, COL.ad_id].forEach(function (c) { body(c).setNumberFormat('@'); });
  body(COL.tiempo).setNumberFormat('0');
  body(COL.notas).setWrap(true);
  sheet.getRange(2, 1, maxRows - 1, nCols).setVerticalAlignment('middle').setFontFamily('Inter').setFontSize(10);
  sheet.getRange(1, 1, 1, nCols).setFontFamily('Inter').setFontSize(10);
  body(COL.nombre).setFontWeight('bold');

  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
  body(COL.estado).setDataValidation(rule);

  var rules = [];
  var statusRange = body(COL.estado);
  STATUS_OPTIONS.forEach(function (s) {
    var c = STATUS_COLORS[s];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(c[0]).setFontColor(c[1]).setRanges([statusRange]).build());
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Sí').setBackground('#FDE2E2').setFontColor('#9B1C1C').setRanges([body(COL.sospechoso)]).build());
  var suspiciousRow = '=$' + colLetter_(COL.sospechoso) + '2="Sí"';
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(suspiciousRow).setFontColor('#9B1C1C').setRanges([sheet.getRange(2, COL.nombre, maxRows - 1, 1)]).build());
  sheet.setConditionalFormatRules(rules);

  var filter = sheet.getFilter();
  if (filter) filter.remove();
  sheet.getRange(1, 1, maxRows, nCols).createFilter();
}

function setupSummary_(ss) {
  var sheet = ss.getSheetByName(SHEET_SUMMARY);
  if (!sheet) sheet = ss.insertSheet(SHEET_SUMMARY, 1);
  sheet.getCharts().forEach(function (ch) { sheet.removeChart(ch); });
  sheet.clear();
  sheet.clearConditionalFormatRules();
  if (sheet.getMaxRows() < 420) sheet.insertRowsAfter(sheet.getMaxRows(), 420 - sheet.getMaxRows());
  if (sheet.getMaxColumns() < 20) sheet.insertColumnsAfter(sheet.getMaxColumns(), 20 - sheet.getMaxColumns());
  sheet.setHiddenGridlines(true);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setFontFamily('Inter').setFontSize(10).setFontColor(BRAND.ink).setVerticalAlignment('middle');
  sheet.setColumnWidth(1, 24);
  for (var c = 2; c <= 8; c++) sheet.setColumnWidth(c, 150);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(9, 24);

  var L = "'" + SHEET_LEADS + "'!";
  var rng = function (col) { var l = colLetter_(col); return L + l + '2:' + l; };
  var VALID = rng(COL.id) + ',"<>",' + rng(COL.sospechoso) + ',"<>Sí"';
  var okMask = 'ARRAYFORMULA((' + rng(COL.id) + '<>"")*(' + rng(COL.sospechoso) + '<>"Sí"))';

  sheet.getRange('B1:H1').merge().setValue('Pomposo y Peligroso · Resumen de leads')
    .setFontSize(20).setFontWeight('bold').setFontColor(BRAND.white).setBackground(BRAND.purpleDark).setVerticalAlignment('middle');
  sheet.setRowHeight(1, 56);
  sheet.getRange('B2:H2').merge()
    .setValue('Se actualiza solo con cada lead. Los leads sospechosos (honeypot o menos de ' + MIN_SECONDS + ' s) no cuentan, salvo en su casilla.')
    .setFontColor(BRAND.muted).setFontSize(10);

  var kpis = [
    ['Total leads', '=COUNTIFS(' + VALID + ')', '0'],
    ['Hoy', '=COUNTIFS(' + rng(COL.fecha) + ',">="&TODAY(),' + rng(COL.fecha) + ',"<"&TODAY()+1,' + VALID + ')', '0'],
    ['Últimos 7 días', '=COUNTIFS(' + rng(COL.fecha) + ',">="&TODAY()-6,' + VALID + ')', '0'],
    ['Últimos 30 días', '=COUNTIFS(' + rng(COL.fecha) + ',">="&TODAY()-29,' + VALID + ')', '0'],
    ['Alumnas', '=COUNTIFS(' + rng(COL.estado) + ',"Alumna",' + VALID + ')', '0'],
    ['Lead → alumna', '=IFERROR(F5/B5,0)', '0.0%'],
    ['Sospechosos', '=COUNTIF(' + rng(COL.sospechoso) + ',"Sí")', '0']
  ];
  kpis.forEach(function (k, i) {
    var col = 2 + i;
    sheet.getRange(4, col).setValue(k[0]).setFontColor(BRAND.muted).setFontWeight('bold').setBackground(BRAND.lilac50).setHorizontalAlignment('center');
    sheet.getRange(5, col).setFormula(k[1]).setNumberFormat(k[2]).setFontSize(26).setFontWeight('bold')
      .setFontColor(i === 6 ? '#9B1C1C' : BRAND.purpleDark).setBackground(BRAND.lilac50).setHorizontalAlignment('center');
  });
  sheet.setRowHeight(4, 30);
  sheet.setRowHeight(5, 54);
  sheet.getRange(4, 2, 2, 7).setBorder(true, true, true, true, true, false, BRAND.white, SpreadsheetApp.BorderStyle.SOLID_THICK);

  var row = 8;

  row = groupTable_(sheet, row, 'Leads por anuncio (utm_content)', 'Anuncio', COL.utm_content, okMask, rng, true);
  row = groupTable_(sheet, row, 'Leads por campaña (utm_campaign)', 'Campaña', COL.utm_campaign, okMask, rng, true);
  row = groupTable_(sheet, row, 'Leads por conjunto (utm_term)', 'Conjunto', COL.utm_term, okMask, rng, true);

  var ageRow = row;
  row = fixedTable_(sheet, row, 'Leads por tramo de edad', 'Tramo de edad', AGE_OPTIONS, COL.edad, VALID, rng);
  addBarChart_(sheet, ageRow + 1, AGE_OPTIONS.length, 'Leads por tramo de edad', ageRow);
  var expRow = row;
  row = fixedTable_(sheet, row, 'Leads por experiencia entrenando', 'Experiencia', EXPERIENCE_OPTIONS, COL.experiencia, VALID, rng);
  addBarChart_(sheet, expRow + 1, EXPERIENCE_OPTIONS.length, 'Leads por experiencia entrenando', expRow);

  row = crossTable_(sheet, row, 'Anuncio × tramo de edad', COL.edad, AGE_OPTIONS, okMask, rng);
  row = crossTable_(sheet, row, 'Anuncio × experiencia', COL.experiencia, EXPERIENCE_OPTIONS, okMask, rng);

  row = simpleGroup_(sheet, row, 'Leads por origen', 'Origen', COL.origen, okMask, rng, 14);
  row = simpleGroup_(sheet, row, 'Leads por dispositivo', 'Dispositivo', COL.dispositivo, okMask, rng, 8);

  row = dailyTable_(sheet, row, VALID, rng);
}

function sectionTitle_(sheet, row, text) {
  sheet.getRange(row, 2, 1, 7).merge().setValue(text).setFontSize(13).setFontWeight('bold').setFontColor(BRAND.purpleDark)
    .setBackground(BRAND.lilac).setVerticalAlignment('middle');
  sheet.setRowHeight(row, 32);
}

function headerRow_(sheet, row, values) {
  sheet.getRange(row, 2, 1, values.length).setValues([values]).setFontWeight('bold').setFontColor(BRAND.muted)
    .setBackground(BRAND.lilac50).setBorder(null, null, true, null, null, null, BRAND.line, SpreadsheetApp.BorderStyle.SOLID);
}

function groupTable_(sheet, row, title, label, col, okMask, rng, withRates) {
  sectionTitle_(sheet, row, title);
  headerRow_(sheet, row + 1, [label, 'Leads', 'Últimos 7 días', 'Alumnas', 'Conversión']);
  var key = 'ARRAYFORMULA(IF(' + rng(col) + '="","(sin dato)",' + rng(col) + '))';
  var f = '=IFERROR(LET(ok,' + okMask + ',' +
    'k,FILTER(' + key + ',ok=1),' +
    'd,FILTER(' + rng(COL.fecha) + ',ok=1),' +
    'st,FILTER(' + rng(COL.estado) + ',ok=1),' +
    'u,UNIQUE(k),' +
    'tot,MAP(u,LAMBDA(x,SUMPRODUCT(--(k=x)))),' +
    'w7,MAP(u,LAMBDA(x,SUMPRODUCT((k=x)*(d>=TODAY()-6)))),' +
    'al,MAP(u,LAMBDA(x,SUMPRODUCT((k=x)*(st="Alumna")))),' +
    'ta,MAP(tot,al,LAMBDA(t,a,IF(t=0,0,a/t))),' +
    'SORT(HSTACK(u,tot,w7,al,ta),2,FALSE)),"Sin datos todavía")';
  sheet.getRange(row + 2, 2).setFormula(f);
  sheet.getRange(row + 2, 6, RESERVED_ROWS, 1).setNumberFormat('0.0%');
  sheet.getRange(row + 2, 3, RESERVED_ROWS, 3).setNumberFormat('0');
  return row + 2 + RESERVED_ROWS + 1;
}

function simpleGroup_(sheet, row, title, label, col, okMask, rng, reserved) {
  sectionTitle_(sheet, row, title);
  headerRow_(sheet, row + 1, [label, 'Leads', '%']);
  var key = 'ARRAYFORMULA(IF(' + rng(col) + '="","(sin dato)",' + rng(col) + '))';
  var f = '=IFERROR(LET(ok,' + okMask + ',k,FILTER(' + key + ',ok=1),u,UNIQUE(k),' +
    'tot,MAP(u,LAMBDA(x,SUMPRODUCT(--(k=x)))),pc,MAP(tot,LAMBDA(t,t/ROWS(k))),SORT(HSTACK(u,tot,pc),2,FALSE)),"Sin datos todavía")';
  sheet.getRange(row + 2, 2).setFormula(f);
  sheet.getRange(row + 2, 4, reserved, 1).setNumberFormat('0.0%');
  return row + 2 + reserved + 1;
}

function fixedTable_(sheet, row, title, label, options, col, VALID, rng) {
  sectionTitle_(sheet, row, title);
  headerRow_(sheet, row + 1, [label, 'Leads', '%']);
  options.forEach(function (o, i) {
    var r = row + 2 + i;
    sheet.getRange(r, 2).setValue(o);
    sheet.getRange(r, 3).setFormula('=COUNTIFS(' + rng(col) + ',B' + r + ',' + VALID + ')').setNumberFormat('0');
    sheet.getRange(r, 4).setFormula('=IFERROR(C' + r + '/SUM(C' + (row + 2) + ':C' + (row + 1 + options.length) + '),0)').setNumberFormat('0.0%');
  });
  return row + 2 + options.length + 12;
}

function addBarChart_(sheet, firstDataRow, n, title, anchorRow) {
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange(firstDataRow, 2, n + 1, 2))
    .setNumHeaders(1)
    .setPosition(anchorRow, 6, 0, 0)
    .setOption('title', title)
    .setOption('legend', { position: 'none' })
    .setOption('colors', [BRAND.purple])
    .setOption('width', 520)
    .setOption('height', 300)
    .build();
  sheet.insertChart(chart);
}

function crossTable_(sheet, row, title, col, options, okMask, rng) {
  sectionTitle_(sheet, row, title);
  var key = 'ARRAYFORMULA(IF(' + rng(COL.utm_content) + '="","(sin anuncio)",' + rng(COL.utm_content) + '))';
  var opts = '{' + options.map(function (o) { return '"' + o + '"'; }).join(',') + '}';
  var f = '=IFERROR(LET(ok,' + okMask + ',k,FILTER(' + key + ',ok=1),g,FILTER(' + rng(col) + ',ok=1),u,SORT(UNIQUE(k)),o,' + opts + ',' +
    'body,MAKEARRAY(ROWS(u),COLUMNS(o),LAMBDA(r,c,SUMPRODUCT((k=INDEX(u,r))*(g=INDEX(o,1,c))))),' +
    'VSTACK(HSTACK("Anuncio",o),HSTACK(u,body))),"Sin datos todavía")';
  sheet.getRange(row + 1, 2).setFormula(f);
  sheet.getRange(row + 1, 2, 1, options.length + 1).setFontWeight('bold').setFontColor(BRAND.muted).setBackground(BRAND.lilac50);
  return row + 1 + RESERVED_ROWS + 1;
}

function dailyTable_(sheet, row, VALID, rng) {
  sectionTitle_(sheet, row, 'Leads por día (últimos 30 días)');
  headerRow_(sheet, row + 1, ['Día', 'Leads']);
  for (var i = 0; i < 30; i++) {
    var r = row + 2 + i;
    sheet.getRange(r, 2).setFormula('=TODAY()-' + (29 - i)).setNumberFormat('ddd dd/mm');
    sheet.getRange(r, 3).setFormula('=COUNTIFS(' + rng(COL.fecha) + ',">="&B' + r + ',' + rng(COL.fecha) + ',"<"&B' + r + '+1,' + VALID + ')').setNumberFormat('0');
  }
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sheet.getRange(row + 1, 2, 31, 2))
    .setNumHeaders(1)
    .setPosition(row, 5, 0, 0)
    .setOption('title', 'Leads por día')
    .setOption('legend', { position: 'none' })
    .setOption('colors', [BRAND.purple])
    .setOption('curveType', 'function')
    .setOption('width', 620)
    .setOption('height', 320)
    .build();
  sheet.insertChart(chart);
  return row + 2 + 30 + 2;
}
