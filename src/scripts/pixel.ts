/**
 * Meta Pixel con consentimiento.
 * - No se carga nada de Meta hasta que hay ID y consentimiento de marketing.
 * - track() descarta los eventos si no hay consentimiento y los encola si fbq aún no existe.
 * - En desarrollo, cada evento se muestra en consola con console.info('[pixel]', ...).
 */
import { SITE } from '../config/site';

type Params = Record<string, string | number | boolean | undefined>;
type Options = { eventID?: string };
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const DEV = import.meta.env.DEV;
const STANDARD_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'Contact',
  'CompleteRegistration',
  'Schedule',
  'SubmitApplication',
]);

/** ID efectivo: el de la configuración; para pruebas, PUBLIC_META_PIXEL_ID en .env. */
export const pixelId: string = SITE.metaPixelId || (import.meta.env.PUBLIC_META_PIXEL_ID as string | undefined) || '';

let granted = false;
let loaded = false;
const pending: Array<[string, string, Params, Options]> = [];

function devLog(...args: unknown[]) {
  if (DEV) console.info('[pixel]', ...args);
}

/** Inyecta el snippet base de Meta (asíncrono, no bloqueante). */
function injectSnippet() {
  if (window.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod.apply(n, args);
    else n.queue!.push(args);
  } as Fbq;
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
}

function loadMetaPixel() {
  if (loaded || !pixelId) return;
  injectSnippet();
  window.fbq!('consent', 'grant');
  window.fbq!('init', pixelId);
  window.fbq!('track', 'PageView');
  loaded = true;
  devLog('PageView', { pixelId });
  while (pending.length) {
    const [kind, event, params, opts] = pending.shift()!;
    window.fbq!(kind, event, params, opts);
  }
}

/** Borra las cookies de Meta al retirar el consentimiento. */
function clearMetaCookies() {
  const host = location.hostname;
  const parts = host.split('.');
  const domains = ['', host];
  for (let i = 1; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
  for (const name of ['_fbp', '_fbc']) {
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
}

/** Llamado por consent.ts cada vez que cambia (o se lee) la elección de cookies. */
export function setMarketingConsent(on: boolean) {
  const was = granted;
  granted = on;
  if (on) {
    if (pixelId) loadMetaPixel();
    else devLog('Consentimiento concedido, pero no hay ID de píxel: no se carga Meta.');
  } else {
    pending.length = 0;
    if (was && window.fbq) window.fbq('consent', 'revoke');
    if (was) clearMetaCookies();
  }
}

export function hasMarketingConsent() {
  return granted;
}

/** Envía un evento al píxel (estándar o personalizado). */
export function track(event: string, params: Params = {}, options: Options = {}) {
  const clean: Params = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') clean[k] = v;
  if (!granted) {
    devLog(event, clean, options, '(sin consentimiento de marketing: descartado)');
    return;
  }
  devLog(event, clean, options);
  if (!pixelId) return;
  const kind = STANDARD_EVENTS.has(event) ? 'track' : 'trackCustom';
  if (!loaded || !window.fbq) {
    pending.push([kind, event, clean, options]);
    return;
  }
  window.fbq(kind, event, clean, options);
}
