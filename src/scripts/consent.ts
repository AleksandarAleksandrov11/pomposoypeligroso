/**
 * Consentimiento de cookies (guía de la AEPD).
 * Guarda la elección en localStorage (pyp_consent) con versión y fecha, durante 12 meses.
 * Necesarias: siempre activas. Marketing: píxel de Meta.
 *
 * Para añadir otros píxeles (TikTok, Google...), cárgalos dentro de applyConsent()
 * con la misma condición que el de Meta.
 */
import { SITE } from '../config/site';
import { setMarketingConsent } from './pixel';

export interface Consent {
  v: number;
  date: string;
  necessary: true;
  marketing: boolean;
}

const KEY = 'pyp_consent';
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    if (c.v !== SITE.consentVersion) return null;
    if (!c.date || Date.now() - new Date(c.date).getTime() > MAX_AGE_MS) return null;
    return c;
  } catch {
    return null;
  }
}

function saveConsent(marketing: boolean): Consent {
  const c: Consent = { v: SITE.consentVersion, date: new Date().toISOString(), necessary: true, marketing };
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* modo privado: la elección vale solo para esta visita */
  }
  return c;
}

function applyConsent(c: Consent | null) {
  setMarketingConsent(!!c?.marketing);
  // Aquí irían otros píxeles con consentimiento de marketing:
  // if (c?.marketing) loadTikTokPixel();
  document.dispatchEvent(new CustomEvent('pyp:consent', { detail: c }));
}

export function initConsent() {
  const banner = document.querySelector<HTMLElement>('[data-cookie-banner]');
  const modal = document.querySelector<HTMLDialogElement>('[data-cookie-modal]');
  const marketingInput = modal?.querySelector<HTMLInputElement>('[data-cookie-marketing]');
  const root = document.documentElement;

  let bannerObserver: ResizeObserver | null = null;

  const setBanner = (visible: boolean) => {
    if (!banner) return;
    banner.hidden = !visible;
    root.classList.toggle('has-cookie-banner', visible);
    if (visible) {
      const update = () => root.style.setProperty('--banner-h', `${banner.offsetHeight + 12}px`);
      update();
      if ('ResizeObserver' in window) {
        bannerObserver = new ResizeObserver(update);
        bannerObserver.observe(banner);
      }
    } else {
      bannerObserver?.disconnect();
      root.style.removeProperty('--banner-h');
    }
    document.dispatchEvent(new CustomEvent('pyp:banner', { detail: visible }));
  };

  const decide = (marketing: boolean) => {
    const c = saveConsent(marketing);
    setBanner(false);
    applyConsent(c);
  };

  const openModal = () => {
    if (!modal) return;
    if (marketingInput) marketingInput.checked = !!readConsent()?.marketing;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  };

  const closeModal = () => {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  };

  banner?.querySelector('[data-consent-action="accept"]')?.addEventListener('click', () => decide(true));
  banner?.querySelector('[data-consent-action="reject"]')?.addEventListener('click', () => decide(false));

  document.addEventListener('click', (e) => {
    const t = (e.target as Element | null)?.closest('[data-open-cookies]');
    if (t) {
      e.preventDefault();
      openModal();
    }
  });

  modal?.querySelector('[data-cookie-close]')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    // Cerrar al pulsar fuera de la tarjeta
    if (e.target === modal) closeModal();
  });
  modal?.querySelector('[data-cookie-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    decide(!!marketingInput?.checked);
    closeModal();
  });

  const current = readConsent();
  applyConsent(current);
  setBanner(!current);
}
