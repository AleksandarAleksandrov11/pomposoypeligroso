/**
 * Punto de entrada común a todas las páginas.
 * Orden: consentimiento (y píxel si procede) → atribución → interfaz → leads pendientes.
 */
import { captureAttribution, syncAttributionStorage } from './tracking';
import { initConsent } from './consent';
import { initUI } from './ui';
import { retryPendingLeads } from './form';

initConsent();
syncAttributionStorage();
captureAttribution();
document.addEventListener('pyp:consent', syncAttributionStorage);
initUI();

const idle = (cb: () => void) =>
  'requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2000);
idle(() => {
  void retryPendingLeads();
});
