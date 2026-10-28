// Función /api/lead-capi (api/lead-capi.js y api/_lib/capi.js) con fetch simulado: nunca llama a Meta de verdad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import handler from '../../api/lead-capi.js';
import { GRAPH_API_VERSION, DEFAULT_PIXEL_ID, validateInput, buildEvent, isSameOrigin, clientIp } from '../../api/_lib/capi.js';

const sha = (v) => createHash('sha256').update(v, 'utf8').digest('hex');
const EVENT_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NOW = 1798000000000;

const validBody = () => ({
  event_id: EVENT_ID,
  name: 'María José',
  phone: '+34612345678',
  age_range: 'De 30 a 39',
  experience: 'Nunca he entrenado',
  fbc: '',
  fbp: 'fb.1.1797999990000.1234567890',
  fbclid: 'IwAR0abc_DEF-123',
  event_source_url: 'https://www.pomposoypeligroso.com/?utm_campaign=DESCUBRIR&fbclid=IwAR0abc_DEF-123',
});

function makeReq(body, headers = {}) {
  return {
    method: 'POST',
    body,
    headers: {
      host: 'www.pomposoypeligroso.com',
      origin: 'https://www.pomposoypeligroso.com',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Instagram 357.0',
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'content-type': 'application/json',
      ...headers,
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    ended: false,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function fakeFetch(response = { ok: true, status: 200, text: '{"events_received":1}' }) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (response instanceof Error) throw response;
    return { ok: response.ok, status: response.status, text: async () => response.text };
  };
  fn.calls = calls;
  return fn;
}

const quiet = () => {
  const log = console.log;
  const err = console.error;
  const logs = [];
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  return () => {
    console.log = log;
    console.error = err;
    return logs;
  };
};

test('con token: una llamada a Meta con el evento correcto y los hashes bien hechos', async () => {
  const fetchImpl = fakeFetch();
  const res = makeRes();
  const restore = quiet();
  await handler(makeReq(validBody()), res, { fetchImpl, env: { META_CAPI_TOKEN: 'TOKEN_DE_PRUEBA' }, now: () => NOW });
  restore();
  assert.equal(res.statusCode, 204);
  assert.equal(fetchImpl.calls.length, 1);
  const { url, init, body } = fetchImpl.calls[0];
  assert.equal(url, `https://graph.facebook.com/${GRAPH_API_VERSION}/${DEFAULT_PIXEL_ID}/events`);
  assert.equal(init.method, 'POST');
  assert.equal(body.access_token, 'TOKEN_DE_PRUEBA');
  assert.equal(body.test_event_code, undefined);
  assert.equal(body.data.length, 1);
  const ev = body.data[0];
  assert.equal(ev.event_name, 'Lead');
  assert.equal(ev.event_time, Math.floor(NOW / 1000));
  assert.equal(ev.event_id, EVENT_ID);
  assert.equal(ev.action_source, 'website');
  assert.equal(ev.event_source_url, validBody().event_source_url);
  assert.deepEqual(ev.user_data.ph, [sha('34612345678')]);
  assert.deepEqual(ev.user_data.fn, [sha('maría')]);
  assert.deepEqual(ev.user_data.country, [sha('es')]);
  assert.equal(ev.user_data.fbc, `fb.1.${NOW}.IwAR0abc_DEF-123`, 'fbc construido con el fbclid de la URL, sin hash');
  assert.equal(ev.user_data.fbp, 'fb.1.1797999990000.1234567890');
  assert.equal(ev.user_data.client_ip_address, '203.0.113.7');
  assert.match(ev.user_data.client_user_agent, /Instagram/);
  assert.deepEqual(ev.custom_data, { content_name: 'Formulario Pomposo', age_range: 'De 30 a 39', experience: 'Nunca he entrenado' });
  // El nombre y el teléfono nunca viajan en claro
  assert.ok(!JSON.stringify(body).includes('612345678"'));
  assert.ok(!JSON.stringify(body).includes('María'));
});

test('con META_TEST_EVENT_CODE y META_PIXEL_ID se usan; el _fbc del píxel tiene prioridad', async () => {
  const fetchImpl = fakeFetch();
  const restore = quiet();
  await handler(makeReq({ ...validBody(), fbc: 'fb.1.1797999990000.PIXELCLICK' }), makeRes(), {
    fetchImpl,
    env: { META_CAPI_TOKEN: 'T', META_PIXEL_ID: '999', META_TEST_EVENT_CODE: 'TEST123' },
    now: () => NOW,
  });
  restore();
  const { url, body } = fetchImpl.calls[0];
  assert.match(url, /\/999\/events$/);
  assert.equal(body.test_event_code, 'TEST123');
  assert.equal(body.data[0].user_data.fbc, 'fb.1.1797999990000.PIXELCLICK');
});

test('sin token: ninguna llamada y 204', async () => {
  const fetchImpl = fakeFetch();
  const res = makeRes();
  await handler(makeReq(validBody()), res, { fetchImpl, env: {}, now: () => NOW });
  assert.equal(res.statusCode, 204);
  assert.equal(fetchImpl.calls.length, 0);
});

test('error de Meta (500 o red caída): responde igual y no lanza', async () => {
  for (const response of [{ ok: false, status: 500, text: '{"error":{"message":"x"}}' }, new Error('ECONNRESET')]) {
    const fetchImpl = fakeFetch(response);
    const res = makeRes();
    const restore = quiet();
    await assert.doesNotReject(handler(makeReq(validBody()), res, { fetchImpl, env: { META_CAPI_TOKEN: 'T' }, now: () => NOW }));
    const logs = restore();
    assert.equal(res.statusCode, 204);
    assert.equal(fetchImpl.calls.length, 1);
    assert.ok(logs.some((l) => l.includes('[lead-capi]')), 'el error queda en el log');
  }
});

test('solo POST del propio origen y con event_id UUID', async () => {
  const fetchImpl = fakeFetch();
  const env = { META_CAPI_TOKEN: 'T' };
  const get = makeRes();
  await handler({ ...makeReq(validBody()), method: 'GET' }, get, { fetchImpl, env });
  assert.equal(get.statusCode, 405);

  const cross = makeRes();
  await handler(makeReq(validBody(), { origin: 'https://otra-web.com' }), cross, { fetchImpl, env });
  assert.equal(cross.statusCode, 403);

  const noOrigin = makeRes();
  await handler(makeReq(validBody(), { origin: undefined, referer: undefined }), noOrigin, { fetchImpl, env });
  assert.equal(noOrigin.statusCode, 403);

  const badId = makeRes();
  await handler(makeReq({ ...validBody(), event_id: '123' }), badId, { fetchImpl, env });
  assert.equal(badId.statusCode, 400);

  const badPhone = makeRes();
  await handler(makeReq({ ...validBody(), phone: '612345678' }), badPhone, { fetchImpl, env });
  assert.equal(badPhone.statusCode, 400);

  const textBody = makeRes();
  const restore = quiet();
  await handler(makeReq(JSON.stringify(validBody())), textBody, { fetchImpl, env });
  restore();
  assert.equal(textBody.statusCode, 204, 'acepta el cuerpo como texto JSON');

  assert.equal(fetchImpl.calls.length, 1, 'solo la petición válida llega a Meta');
});

test('validación: limita longitudes y descarta formatos raros sin rechazar el evento', () => {
  const r = validateInput({
    ...validBody(),
    name: 'x'.repeat(61),
    age_range: 'Otra',
    fbp: '<script>',
    fbclid: 'a b',
    event_source_url: 'javascript:alert(1)',
  });
  assert.equal(r.ok, true);
  assert.equal(r.lead.name, '');
  assert.equal(r.lead.age_range, '');
  assert.equal(r.lead.fbp, '');
  assert.equal(r.lead.fbclid, '');
  assert.equal(r.lead.event_source_url, '');
  const ev = buildEvent(r.lead, { now: NOW });
  assert.equal(ev.user_data.fn, undefined);
  assert.equal(ev.custom_data.age_range, undefined);
  assert.equal(ev.event_source_url, undefined);
  assert.equal(validateInput(null).ok, false);
  assert.equal(validateInput([]).ok, false);
});

test('país solo si el prefijo lo permite; IP y origen', () => {
  const ev = buildEvent({ ...validateInput(validBody()).lead, phone: '+15551234567' }, { now: NOW });
  assert.equal(ev.user_data.country, undefined);
  assert.equal(clientIp({ 'x-forwarded-for': ' 198.51.100.4 , 10.0.0.2' }), '198.51.100.4');
  assert.equal(clientIp({ 'x-real-ip': '198.51.100.5' }), '198.51.100.5');
  assert.equal(isSameOrigin({ host: 'a.com', origin: 'https://a.com' }), true);
  assert.equal(isSameOrigin({ host: 'a.com', referer: 'https://a.com/privacidad' }), true);
  assert.equal(isSameOrigin({ host: 'a.com', origin: 'https://b.com' }), false);
  assert.equal(isSameOrigin({ host: 'a.com' }), false);
});
