// Contrato del envío al Apps Script: mismas claves, mismo orden y mismos valores que antes de los cambios.
// La referencia se capturó en el navegador con el endpoint interceptado (tests/fixtures/apps-script-payload.json).
// La prueba de Playwright (tests/e2e/payload.spec.mjs) compara además el envío real del navegador con la misma referencia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAppsScriptPayload, normalizePhone, cleanName, isUuid, uuidv4 } from '../../src/lib/lead.ts';

const ref = JSON.parse(fs.readFileSync(new URL('../fixtures/apps-script-payload.json', import.meta.url), 'utf8'));

test('el payload del Apps Script es idéntico a la referencia', () => {
  const input = ref.input;
  const url = new URL(input.url, 'https://www.pomposoypeligroso.com');
  const eventId = uuidv4();
  const payload = buildAppsScriptPayload({
    age_range: input.age_range,
    experience: input.experience,
    name: cleanName(input.name),
    phone: normalizePhone(input.prefix, input.phone),
    utm_source: url.searchParams.get('utm_source') ?? '',
    utm_medium: url.searchParams.get('utm_medium') ?? '',
    utm_campaign: url.searchParams.get('utm_campaign') ?? '',
    utm_content: url.searchParams.get('utm_content') ?? '',
    utm_term: url.searchParams.get('utm_term') ?? '',
    event_id: eventId,
    website: '',
  });
  assert.deepEqual(Object.keys(payload), Object.keys(ref.payload), 'mismas claves y en el mismo orden');
  assert.ok(isUuid(payload.event_id));
  assert.deepEqual({ ...payload, event_id: '<uuid-v4>' }, ref.payload);
});

test('el payload no lleva identificadores de Meta ni datos nuevos', () => {
  const keys = Object.keys(ref.payload);
  for (const k of ['fbclid', 'fbc', 'fbp', 'consent_marketing', 'privacy', 'user_agent', 'referrer', 'landing_url']) {
    assert.ok(!keys.includes(k), `${k} no viaja al Apps Script`);
  }
});
