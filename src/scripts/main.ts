/**
 * Punto de entrada común a todas las páginas.
 * Orden: atribución → consentimiento (y píxel si procede) → interfaz → leads pendientes.
 */
import { captureAttribution } from './tracking';
import { initConsent } from './consent';
import { initUI } from './ui';
import { retryPendingLeads } from './form';

captureAttribution();
initConsent();
initUI();

const idle = (cb: () => void) =>
  'requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2000);
idle(() => {
  void retryPendingLeads();
});
