/**
 * Comportamiento de interfaz: header, apariciones al hacer scroll, barra fija móvil,
 * botón flotante de WhatsApp, precarga de fotos en segundo plano, clips de vídeo y clics de contacto.
 */
import { track } from './pixel';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/** Aparición suave (fade + 12 px). Solo para elementos que aún no están en pantalla. */
function initReveal() {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!items.length || reducedMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );
  const vh = window.innerHeight;
  items.forEach((el) => {
    if (el.getBoundingClientRect().top > vh) {
      el.classList.add('reveal');
      io.observe(el);
    }
  });
}

/** Barra fija inferior en móvil: CTA + WhatsApp. */
function initMobileBar() {
  const bar = document.querySelector<HTMLElement>('[data-mobilebar]');
  if (!bar) return;
  const heroCta = document.querySelector('[data-hero-cta]');
  const form = document.querySelector('#formulario');
  const root = document.documentElement;

  const state = { heroGone: false, formVisible: false, keyboard: false };

  const render = () => {
    const show = state.heroGone && !state.formVisible && !state.keyboard;
    bar.classList.toggle('is-visible', show);
    bar.toggleAttribute('inert', !show);
    root.classList.toggle('mobilebar-visible', show);
  };

  if ('IntersectionObserver' in window) {
    if (heroCta) {
      new IntersectionObserver(([e]) => {
        state.heroGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        render();
      }).observe(heroCta);
    } else {
      state.heroGone = true;
    }
    if (form) {
      new IntersectionObserver(([e]) => {
        state.formVisible = e.isIntersecting;
        render();
      }).observe(form);
    }
  }

  // Teclado abierto: el visualViewport se encoge, o hay un campo de texto con foco.
  const isTextField = (el: Element | null) =>
    !!el && (el.matches('input:not([type="radio"]):not([type="checkbox"]), select, textarea') || (el as HTMLElement).isContentEditable);
  const vv = window.visualViewport;
  const checkKeyboard = () => {
    const shrunk = vv ? vv.height < window.innerHeight * 0.75 : false;
    state.keyboard = shrunk || isTextField(document.activeElement);
    render();
  };
  vv?.addEventListener('resize', checkKeyboard);
  document.addEventListener('focusin', checkKeyboard);
  document.addEventListener('focusout', () => setTimeout(checkKeyboard, 50));
  render();
}

/** Botón flotante de WhatsApp en escritorio: se esconde sobre el footer. */
function initFab() {
  const fab = document.querySelector<HTMLElement>('[data-wa-fab]');
  const footer = document.querySelector('.site-footer');
  if (!fab || !footer || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => fab.classList.toggle('is-hidden', e.isIntersecting)).observe(footer);
}

/**
 * Precarga en segundo plano: cuando la página ya ha cargado y el navegador está libre, descarga el resto
 * de fotos (las que tienen loading="lazy") para que al hacer scroll aparezcan al instante.
 * No lo hace con "ahorro de datos" ni con conexiones 2G.
 */
function warmUpImages() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
  const run = () => {
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
      img.loading = 'eager';
    });
  };
  const whenIdle = () => {
    // Safari no tiene requestIdleCallback
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 1200);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

/**
 * Clips de alumnas entrenando: el vídeo se pide cuando la sección se acerca a la pantalla y solo se
 * reproduce mientras se ve. Con "reducir movimiento" no se reproducen solos (llevan controles).
 */
function initVideos() {
  const section = document.querySelector<HTMLElement>('[data-videos]');
  if (!section) return;
  const videos = [...section.querySelectorAll<HTMLVideoElement>('video[data-src]')];
  // data-src lleva la ruta sin extensión: MP4 (H.264) si el navegador lo admite y, si no, WebM (VP9)
  const ext = document.createElement('video').canPlayType('video/mp4; codecs="avc1.4D401E"') ? 'mp4' : 'webm';
  const load = (v: HTMLVideoElement) => {
    if (v.src || !v.dataset.src) return;
    v.src = `${v.dataset.src}.${ext}`;
  };
  if (reducedMotion || !('IntersectionObserver' in window)) {
    videos.forEach((v) => {
      // Con controles deja de ser decorativo: vuelve a ser accesible. Se descarga solo al darle a reproducir.
      v.removeAttribute('aria-hidden');
      v.controls = true;
      load(v);
    });
    return;
  }
  const near = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        videos.forEach(load);
        near.disconnect();
      }
    },
    { rootMargin: '600px 0px' },
  );
  near.observe(section);
  const visible = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          load(v);
          v.play().catch(() => {
            /* el navegador no deja reproducir: se queda la imagen de portada */
          });
        } else v.pause();
      }
    },
    { threshold: 0.25 },
  );
  videos.forEach((v) => visible.observe(v));
}

/** Evento Contact al pulsar WhatsApp o teléfono. */
function initContactTracking() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLElement>('[data-contact]');
    if (!a) return;
    track('Contact', { method: a.dataset.contact, location: a.dataset.location || 'otro' });
  });
}

function initYear() {
  const y = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => {
    if (el.textContent !== y) el.textContent = y;
  });
}

export function initUI() {
  initHeader();
  initReveal();
  initMobileBar();
  initFab();
  warmUpImages();
  initVideos();
  initContactTracking();
  initYear();
}
