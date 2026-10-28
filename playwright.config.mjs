// Pruebas de extremo a extremo sobre el build (dist/) servido en local.
// El Apps Script, /api/lead-capi, Meta y WhatsApp están siempre interceptados (tests/e2e/helpers.mjs):
// ninguna prueba toca la hoja real ni manda nada a Meta.
import { defineConfig } from '@playwright/test';

const PORT = 4700;
// E2E_BASE_URL=https://www.pomposoypeligroso.com repite las pruebas contra producción, con todo lo externo interceptado
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const IG_IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,3; iOS 18_1; es_ES; es; scale=3.00; 1290x2796; 640201398)';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 45_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },
  projects: [
    {
      name: 'movil-instagram',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IG_IPHONE_UA },
    },
    {
      name: 'escritorio',
      use: { viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node tests/e2e/server.mjs ${PORT}`,
        port: PORT,
        reuseExistingServer: false,
      },
});
