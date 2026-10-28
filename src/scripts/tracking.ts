/**
 * Atribución: de qué anuncio llega la visita (UTM, IDs de campaña y fbclid).
 * Guarda el primer y el último contacto para no perderlos si la usuaria recarga o vuelve de una página legal:
 *  - sessionStorage (funcional, se borra al cerrar la pestaña), siempre;
 *  - localStorage durante 30 días, solo con consentimiento de marketing.
 * Al Apps Script solo viajan los cinco UTM (ver buildAppsScriptPayload en src/lib/lead.ts).
 * fbclid y fbc solo viajan a la API de conversiones (/api/lead-capi), nunca a la hoja.
 */
import { readConsent } from './consent';
import { fbcFromFbclid } from '../lib/lead';

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
  'placement',
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

function parse(raw: string | null | undefined): Touch | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Touch;
    return t.ts && Date.now() - t.ts <= TTL_MS ? t : null;
  } catch {
    return null;
  }
}

function read(key: string): Touch | null {
  let raw = memory.get(key) ?? null;
  try {
    raw ??= sessionStorage.getItem(key);
    if (!raw && hasMarketing()) raw = localStorage.getItem(key);
  } catch {
    /* sin almacenamiento: solo memoria */
  }
  return parse(raw);
}

function write(key: string, t: Touch) {
  const raw = JSON.stringify(t);
  memory.set(key, raw);
  try {
    sessionStorage.setItem(key, raw);
    if (hasMarketing()) localStorage.setItem(key, raw);
  } catch {
    /* sin almacenamiento disponible */
  }
}

/** Cuando cambia el consentimiento: con marketing se guarda 30 días; sin él se borra de localStorage (queda la sesión). */
export function syncAttributionStorage() {
  try {
    const marketing = hasMarketing();
    for (const key of [FIRST_KEY, LAST_KEY]) {
      const raw = memory.get(key) ?? sessionStorage.getItem(key);
      if (marketing) {
        if (raw) localStorage.setItem(key, raw);
      } else {
        const stored = localStorage.getItem(key);
        if (stored && !raw) sessionStorage.setItem(key, stored);
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* sin almacenamiento */
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
  if (found.fbclid) touch.fbc = fbcFromFbclid(found.fbclid, now);
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

/** Los cinco UTM que viajan con el lead al Apps Script (último contacto con anuncio; si no, el primero). */
export function getAttribution() {
  const last = read(LAST_KEY);
  const first = read(FIRST_KEY);
  const src: Partial<Touch> = last ?? first ?? {};
  const pick = (k: ParamName) => src[k] ?? '';
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'),
    utm_term: pick('utm_term'),
  };
}

/**
 * Identificadores del clic del anuncio para la API de conversiones.
 * fbclid (y el fbc construido con él) llegan en la URL, con o sin consentimiento.
 * _fbc y _fbp son cookies del píxel: solo existen si se aceptó el marketing.
 */
export function getAdIdentifiers() {
  const last = read(LAST_KEY);
  const first = read(FIRST_KEY);
  const fbclid = last?.fbclid ?? first?.fbclid ?? '';
  return {
    fbclid,
    fbc: getCookie('_fbc') || last?.fbc || first?.fbc || '',
    fbp: getCookie('_fbp'),
  };
}
