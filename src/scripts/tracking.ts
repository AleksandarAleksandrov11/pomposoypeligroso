/**
 * Atribución: UTMs, IDs de campaña, fbclid/fbc/fbp y datos del dispositivo.
 * Guarda primer y último contacto en localStorage durante 30 días, para no perderlos
 * si la usuaria navega a las páginas legales y vuelve.
 */

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

function read(key: string): Touch | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const t = JSON.parse(raw) as Touch;
    if (!t.ts || Date.now() - t.ts > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

function write(key: string, t: Touch) {
  try {
    localStorage.setItem(key, JSON.stringify(t));
  } catch {
    /* sin almacenamiento disponible */
  }
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
  const first = read(FIRST_KEY);
  const last = read(LAST_KEY) ?? first;
  const src: Partial<Touch> = last ?? {};
  const pick = (k: ParamName) => src[k] ?? '';
  const fbclid = src.fbclid ?? first?.fbclid ?? '';
  const fbc = getCookie('_fbc') || src.fbc || first?.fbc || '';

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
    fbp: getCookie('_fbp'),
    landing_url: src.landing_url ?? location.href,
    page_url: location.href,
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
