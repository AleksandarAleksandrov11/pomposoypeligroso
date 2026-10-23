/**
 * Atribución: UTMs, IDs de campaña, fbclid/fbc/fbp y datos del dispositivo.
 * Guarda primer y último contacto para no perderlos si la usuaria navega a las páginas
 * legales y vuelve:
 *  - Con consentimiento de marketing: localStorage durante 30 días.
 *  - Sin consentimiento: nada en el dispositivo (LSSI art. 22.2), solo en memoria mientras dura la página.
 *    Además no viajan con el lead los identificadores de Meta (fbclid, _fbc, _fbp).
 */
import { readConsent } from './consent';

const FIRST_KEY = 'pyp_first_touch';
const LAST_KEY = 'pyp_last_touch';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const CAMPAIGN_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'campaign_id',
  'adset_id',
  'ad_id',
  'adset_name',
  'ad_name',
  'placement',
  'site_source',
  'fbclid',
] as const;

type ParamName = (typeof CAMPAIGN_PARAMS)[number];

export interface Touch extends Partial<Record<ParamName, string>> {
  landing_url: string;
  referrer: string;
  fbc?: string;
  ts: number;
}

const memory = new Map<string, string>();

const hasMarketing = () => !!readConsent()?.marketing;

function read(key: string): Touch | null {
  try {
    const raw = memory.get(key) ?? (hasMarketing() ? localStorage.getItem(key) : null);
    if (!raw) return null;
    const t = JSON.parse(raw) as Touch;
    if (!t.ts || Date.now() - t.ts > TTL_MS) {
      memory.delete(key);
      localStorage.removeItem(key);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

function write(key: string, t: Touch) {
  const raw = JSON.stringify(t);
  memory.set(key, raw);
  if (!hasMarketing()) return;
  try {
    localStorage.setItem(key, raw);
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Cuando cambia el consentimiento: con marketing se guarda en el dispositivo; sin él se borra de ahí. */
export function syncAttributionStorage() {
  try {
    const marketing = hasMarketing();
    for (const key of [FIRST_KEY, LAST_KEY]) {
      sessionStorage.removeItem(key); // versiones anteriores lo guardaban aquí sin consentimiento
      if (marketing) {
        const raw = memory.get(key);
        if (raw) localStorage.setItem(key, raw);
      } else {
        const raw = localStorage.getItem(key);
        if (raw && !memory.has(key)) memory.set(key, raw);
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* sin almacenamiento */
  }
}

/** Quita fbclid de una URL (identificador de clic de Meta). */
function withoutFbclid(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('fbclid')) return url;
    u.searchParams.delete('fbclid');
    return u.toString();
  } catch {
    return url;
  }
}

function anonymousTouch(t: Touch | null): Partial<Touch> {
  if (!t) return {};
  const { fbclid: _fbclid, fbc: _fbc, ...rest } = t;
  return { ...rest, landing_url: withoutFbclid(t.landing_url), referrer: withoutFbclid(t.referrer) };
}

function isExternalReferrer(ref: string) {
  if (!ref) return false;
  try {
    return new URL(ref).hostname !== location.hostname;
  } catch {
    return false;
  }
}

/** Se llama en cada carga de página. */
export function captureAttribution() {
  const params = new URLSearchParams(location.search);
  const found: Partial<Record<ParamName, string>> = {};
  for (const p of CAMPAIGN_PARAMS) {
    const v = params.get(p);
    if (v) found[p] = v.slice(0, 500);
  }
  const hasCampaign = Object.keys(found).length > 0;
  const last = read(LAST_KEY);
  const first = read(FIRST_KEY);

  // Solo se registra un contacto nuevo si llega con parámetros, desde fuera, o si no había ninguno.
  if (!hasCampaign && last && !isExternalReferrer(document.referrer)) return;

  const now = Date.now();
  const touch: Touch = {
    ...found,
    landing_url: location.href.slice(0, 2000),
    referrer: document.referrer.slice(0, 1000),
    ts: now,
  };
  if (found.fbclid) touch.fbc = `fb.1.${now}.${found.fbclid}`;
  write(LAST_KEY, touch);
  if (!first) write(FIRST_KEY, touch);
}

function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export function detectDevice(): 'móvil' | 'tablet' | 'escritorio' {
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || touchMac || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|IEMobile|Opera Mini/i.test(ua)) return 'móvil';
  return 'escritorio';
}

export function detectInAppBrowser(): 'Instagram' | 'Facebook' | 'No' {
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return 'Facebook';
  return 'No';
}

/** Campos de atribución que viajan con cada lead. */
export function getAttribution() {
  const marketing = hasMarketing();
  const first = marketing ? read(FIRST_KEY) : (anonymousTouch(read(FIRST_KEY)) as Touch);
  const lastRaw = read(LAST_KEY);
  const last = lastRaw ? (marketing ? lastRaw : (anonymousTouch(lastRaw) as Touch)) : first;
  const src: Partial<Touch> = last ?? {};
  const pick = (k: ParamName) => src[k] ?? '';
  const fbclid = marketing ? (src.fbclid ?? first?.fbclid ?? '') : '';
  const fbc = marketing ? getCookie('_fbc') || src.fbc || first?.fbc || '' : '';

  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'),
    utm_term: pick('utm_term'),
    utm_id: pick('utm_id'),
    campaign_id: pick('campaign_id'),
    adset_id: pick('adset_id'),
    ad_id: pick('ad_id'),
    adset_name: pick('adset_name'),
    ad_name: pick('ad_name'),
    placement: pick('placement'),
    site_source: pick('site_source'),
    fbclid,
    fbc,
    fbp: marketing ? getCookie('_fbp') : '',
    landing_url: src.landing_url ?? (marketing ? location.href : withoutFbclid(location.href)),
    page_url: marketing ? location.href : withoutFbclid(location.href),
    referrer: src.referrer ?? document.referrer,
    first_touch: JSON.stringify(first ?? {}),
    last_touch: JSON.stringify(last ?? {}),
    device: detectDevice(),
    user_agent: navigator.userAgent,
    in_app_browser: detectInAppBrowser(),
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language || '',
  };
}
