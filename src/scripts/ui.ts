/**
 * Comportamiento de interfaz: header, apariciones al hacer scroll, barra fija móvil,
 * botón flotante de WhatsApp, carruseles, diálogos de testimonios y clics de contacto.
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
    const banner = root.classList.contains('has-cookie-banner');
    const show = state.heroGone && !state.formVisible && !state.keyboard && !banner;
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
  document.addEventListener('pyp:banner', render);
  render();
}

/** Botón flotante de WhatsApp en escritorio: se esconde sobre el footer. */
function initFab() {
  const fab = document.querySelector<HTMLElement>('[data-wa-fab]');
  const footer = document.querySelector('.site-footer');
  if (!fab || !footer || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => fab.classList.toggle('is-hidden', e.isIntersecting)).observe(footer);
}

/** Carruseles con scroll-snap: flechas en escritorio, deslizar en móvil. */
function initCarousels() {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach((wrap) => {
    const track = wrap.querySelector<HTMLElement>('[data-carousel-track]');
    const prev = wrap.querySelector<HTMLButtonElement>('[data-carousel-prev]');
    const next = wrap.querySelector<HTMLButtonElement>('[data-carousel-next]');
    if (!track || !prev || !next) return;
    const step = () => {
      const item = track.querySelector<HTMLElement>(':scope > *');
      const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
      return item ? item.offsetWidth + gap : track.clientWidth * 0.8;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      wrap.classList.toggle('is-static', max <= 0);
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
}

/** Testimonios: "Leer más" abre un <dialog> nativo. */
function initDialogs() {
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    const opener = target?.closest<HTMLElement>('[data-dialog-open]');
    if (opener) {
      const dlg = document.getElementById(opener.dataset.dialogOpen!) as HTMLDialogElement | null;
      if (dlg && typeof dlg.showModal === 'function') {
        e.preventDefault();
        dlg.showModal();
      }
      return;
    }
    const closer = target?.closest<HTMLElement>('[data-dialog-close]');
    if (closer) closer.closest('dialog')?.close();
    if (target instanceof HTMLDialogElement && target.matches('[data-testimonial-dialog]')) target.close();
  });
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
  initCarousels();
  initDialogs();
  initContactTracking();
  initYear();
}
