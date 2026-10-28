// Contrato con el Apps Script: el navegador envía exactamente lo mismo que antes de los cambios.
import { test, expect } from '@playwright/test';
import { FIXTURE, UUID_RE, setup, chooseCookies, fillForm, submit } from './helpers.mjs';

for (const consent of ['reject', 'accept']) {
  test(`payload idéntico a la referencia (${consent === 'accept' ? 'aceptando' : 'rechazando'} cookies)`, async ({ page, context }) => {
    const log = await setup(context);
    await page.goto(FIXTURE.input.url);
    await chooseCookies(page, consent);
    await fillForm(page, { age: FIXTURE.input.age_range, experience: FIXTURE.input.experience, name: FIXTURE.input.name, phone: FIXTURE.input.phone });
    await submit(page);
    await expect.poll(() => log.payloads.length).toBe(1);
    const body = log.payloads[0].body;
    expect(Object.keys(body)).toEqual(Object.keys(FIXTURE.payload));
    expect(body.event_id).toMatch(UUID_RE);
    expect({ ...body, event_id: '<uuid-v4>' }).toEqual(FIXTURE.payload);
  });
}

test('los UTM no se pierden al recargar, aunque se rechacen las cookies', async ({ page, context }) => {
  const log = await setup(context);
  await page.goto('/?utm_source=ig&utm_medium=paid_social&utm_campaign=DESCUBRIR_TEST&utm_content=video_2&utm_term=conjunto_a');
  await chooseCookies(page, 'reject');
  await page.goto('/');
  await page.reload();
  await fillForm(page);
  await submit(page);
  await expect.poll(() => log.payloads.length).toBe(1);
  const body = log.payloads[0].body;
  expect(body.utm_source).toBe('ig');
  expect(body.utm_medium).toBe('paid_social');
  expect(body.utm_campaign).toBe('DESCUBRIR_TEST');
  expect(body.utm_content).toBe('video_2');
  expect(body.utm_term).toBe('conjunto_a');
  expect(Object.keys(body)).toEqual(Object.keys(FIXTURE.payload));
});
