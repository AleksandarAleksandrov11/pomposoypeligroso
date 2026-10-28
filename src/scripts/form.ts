/**
 * Formulario de 4 pasos (una pregunta cada vez).
 * Envío a Google Apps Script como text/plain (sin preflight CORS), timeout 12 s y 1 reintento.
 * Si vuelve a fallar por red, la solicitud se guarda en localStorage y se reintenta en la siguiente visita;
 * si el Apps Script la rechaza por un dato no válido (invalid_*), no se reintenta: se marca el campo.
 *
 * Cuando el Apps Script responde ok: true:
 *  1. Lead una sola vez por solicitud (mismo event_id en el píxel y en la API de conversiones).
 *  2. Estado de gracias en la propia tarjeta con el botón "Abrir WhatsApp".
 *  3. En móvil, WhatsApp se abre solo a los 1,5 s (nunca antes de 800 ms desde el Lead).
 */
import { SITE } from '../config/site';
import { track, hasMarketingConsent, isPixelLoaded, setAdvancedMatching } from './pixel';
import { detectDevice, getAdIdentifiers, getAttribution } from './tracking';
import { pickPreselect } from '../data/ad-variants';
import {
  SERVER_FIELD_ERRORS,
  buildAppsScriptPayload,
  cleanName,
  countryFromPhone,
  firstNameForMatching,
  isUuid,
  nameProblem,
  normalizePhone,
  normalizePrefix,
  phoneDigits,
  uuidv4,
  validName,
  whatsappErrorMessage,
  whatsappLink,
  whatsappMessage,
  type AppsScriptFields,
} from '../lib/lead';

const DEV = import.meta.env.DEV;
const ENDPOINT: string = SITE.formEndpoint;
const CAPI_ENDPOINT = '/api/lead-capi';
const TIMEOUT_MS = 12000;
const PROGRESS_KEY = 'pyp_form_progress';
const STARTED_KEY = 'pyp_form_started';
const STEPS_KEY = 'pyp_form_steps';
const LEAD_SENT_KEY = 'pyp_lead_sent';
const PENDING_KEY = 'pyp_pending_leads';
const TOTAL = 4;
const STEP_NAMES = ['', 'edad', 'experiencia', 'nombre', 'telefono'];
/** Tiempo mínimo entre el Lead y cualquier navegación, para que el evento salga. */
const MIN_LEAD_TO_NAV_MS = 800;
/** En móvil, WhatsApp se abre solo pasado este tiempo desde el envío. */
const AUTO_WHATSAPP_MS = 1500;

type Payload = AppsScriptFields;
type Field = 'age_range' | 'experience' | 'name' | 'phone';

/** El Apps Script ha rechazado un dato: no tiene sentido reintentarlo. */
class ServerValidationError extends Error {
  field: Field;
  constructor(field: Field) {
    super(field);
    this.field = field;
  }
}

/* ---------- Envío ---------- */

async function postOnce(payload: Payload): Promise<void> {
  if (!ENDPOINT) {
    if (DEV) {
      console.info('[form] Sin endpoint: envío simulado en desarrollo', payload);
      await new Promise((r) => setTimeout(r, 600));
      return;
    }
    throw new Error('Formulario sin endpoint configurado');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: unknown; error?: unknown };
    if (data.ok === true) return;
    const field = typeof data.error === 'string' ? SERVER_FIELD_ERRORS[data.error] : undefined;
    if (field) throw new ServerValidationError(field);
    throw new Error('Respuesta no válida');
  } finally {
    clearTimeout(timer);
  }
}

async function sendLead(payload: Payload) {
  try {
    await postOnce(payload);
  } catch (err) {
    if (err instanceof ServerValidationError) throw err;
    await postOnce(payload); // un reintento
  }
}

/* ---------- Solicitudes pendientes (una por event_id) ---------- */

function readPending(): Payload[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    return Array.isArray(list) ? (list as Payload[]) : [];
  } catch {
    return [];
  }
}

function writePending(list: Payload[]) {
  // Sin duplicados: si dos entradas comparten event_id, se queda la última
  const byId = new Map<string, Payload>();
  for (const p of list) {
    byId.delete(String(p.event_id));
    byId.set(String(p.event_id), p);
  }
  const unique = [...byId.values()].slice(-5);
  try {
    if (unique.length) localStorage.setItem(PENDING_KEY, JSON.stringify(unique));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

const addPending = (p: Payload) => writePending([...readPending(), p]);
const removePending = (eventId: string) => {
  const list = readPending();
  if (list.some((p) => p.event_id === eventId)) writePending(list.filter((p) => p.event_id !== eventId));
};

/* ---------- Lead: una sola vez por event_id ---------- */

function reportedIds(): string[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(LEAD_SENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(String) : [String(list)];
  } catch {
    // Versiones anteriores guardaban un solo ID como texto
    return raw ? [raw] : [];
  }
}

function markReported(id: string) {
  try {
    sessionStorage.setItem(LEAD_SENT_KEY, JSON.stringify([...reportedIds(), id].slice(-20)));
  } catch {
    /* sin sessionStorage: el Set en memoria evita repetir en esta página */
  }
}

const reportedInPage = new Set<string>();

/** Lead del píxel (solo con consentimiento), con coincidencia avanzada antes del evento. */
function firePixelLead(p: Payload) {
  if (!hasMarketingConsent()) return;
  if (isPixelLoaded()) {
    setAdvancedMatching({ ph: phoneDigits(p.phone), fn: firstNameForMatching(p.name), country: countryFromPhone(p.phone) });
  }
  track('Lead', { content_name: 'Formulario Pomposo', age_range: p.age_range, experience: p.experience }, { eventID: p.event_id });
}

/** Lead por la API de conversiones (función de Vercel). Para todas las solicitudes, con o sin consentimiento. */
function sendCapi(p: Payload) {
  const ids = getAdIdentifiers();
  const body = JSON.stringify({
    event_id: p.event_id,
    name: p.name,
    phone: p.phone,
    age_range: p.age_range,
    experience: p.experience,
    fbc: ids.fbc,
    fbp: ids.fbp,
    fbclid: ids.fbclid,
    event_source_url: location.href.slice(0, 2000),
  });
  try {
    void fetch(CAPI_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {
      /* nunca afecta a la usuaria */
    });
  } catch {
    /* navegador sin fetch con keepalive: sin API de conversiones */
  }
}

/** Devuelve true si se ha informado ahora (false si ya se había hecho para ese event_id). */
function reportLead(p: Payload): boolean {
  const id = String(p.event_id);
  if (!isUuid(id) || reportedInPage.has(id) || reportedIds().includes(id)) return false;
  reportedInPage.add(id);
  markReported(id);
  firePixelLead(p);
  sendCapi(p);
  return true;
}

/** Reintenta en segundo plano las solicitudes que no se pudieron enviar en una visita anterior. */
export async function retryPendingLeads() {
  const list = readPending();
  if (!list.length || !ENDPOINT) return;
  for (const p of list) {
    try {
      await sendLead(p);
      removePending(String(p.event_id));
      if (!p.website) reportLead(p);
    } catch (err) {
      // Un dato rechazado por el servidor no se va a aceptar nunca: se descarta
      if (err instanceof ServerValidationError) removePending(String(p.event_id));
    }
  }
}

/* ---------- Interfaz ---------- */

export function initForm() {
  const form = document.querySelector<HTMLFormElement>('[data-lead-form]');
  if (!form) return;

  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')];
  const bar = form.querySelector<HTMLElement>('[data-progress]');
  const count = form.querySelector<HTMLElement>('[data-step-count]');
  const live = form.querySelector<HTMLElement>('[data-live]');
  const back = form.querySelector<HTMLButtonElement>('[data-back]');
  const errorBox = form.querySelector<HTMLElement>('[data-form-error]');
  const errorWa = form.querySelector<HTMLAnchorElement>('[data-error-whatsapp]');
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-submit]');
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]');
  const nameInput = form.querySelector<HTMLInputElement>('#lf-name')!;
  const nameError = form.querySelector<HTMLElement>('#lf-name-error');
  const prefixSelect = form.querySelector<HTMLSelectElement>('#lf-prefix')!;
  const prefixOther = form.querySelector<HTMLInputElement>('#lf-prefix-other')!;
  const prefixValue = form.querySelector<HTMLElement>('[data-prefix-value]');
  const phoneInput = form.querySelector<HTMLInputElement>('#lf-phone')!;
  const phoneError = form.querySelector<HTMLElement>('#lf-phone-error');
  const honeypot = form.querySelector<HTMLInputElement>('[name="website"]')!;
  const card = form.closest<HTMLElement>('.lead-card');
  const thanks = card?.querySelector<HTMLElement>('[data-thanks]') ?? null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const submitText = submitLabel?.textContent?.trim() || 'Enviar y abrir WhatsApp';

  let current = 1;
  let sending = false;
  let submitted = false;
  let startedAt = 0;
  let lastKey = '';
  let eventId = '';
  let fromFaq = false;
  let autoTimer = 0;
  let contactTimer = 0;
  let done: { name: string; url: string } | null = null;

  /* Progreso guardado por si recarga (incluye el event_id de la solicitud) */
  const save = () => {
    try {
      sessionStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify(
          done
            ? { done: true, name: done.name, url: done.url }
            : {
                step: current,
                age_range: (form.elements.namedItem('age_range') as RadioNodeList).value,
                experience: (form.elements.namedItem('experience') as RadioNodeList).value,
                name: nameInput.value,
                prefix: prefixSelect.value,
                prefix_other: prefixOther.value,
                phone: phoneInput.value,
                startedAt,
                event_id: eventId,
                from_faq: fromFaq,
              },
        ),
      );
    } catch {
      /* sin sessionStorage */
    }
  };

  /* Llegar al formulario desde "¿Otra duda?" de las preguntas frecuentes */
  document.addEventListener('click', (e) => {
    const cta = (e.target as Element | null)?.closest<HTMLElement>('[data-cta]');
    if (!cta || submitted) return;
    fromFaq = cta.dataset.cta === 'faq-duda';
    save();
  });

  const ensureEventId = () => {
    if (!isUuid(eventId)) eventId = uuidv4();
    return eventId;
  };

  const markStarted = () => {
    if (!startedAt) startedAt = Date.now();
    ensureEventId();
    save();
    if (!hasMarketingConsent()) return;
    try {
      if (sessionStorage.getItem(STARTED_KEY)) return;
      sessionStorage.setItem(STARTED_KEY, '1');
    } catch {
      /* continúa */
    }
    track('FormStart');
  };

  /** FormStep: una vez por paso y sesión. */
  const completeStep = (n: number) => {
    if (!hasMarketingConsent()) return;
    let doneSteps: number[] = [];
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STEPS_KEY) || '[]');
      if (Array.isArray(parsed)) doneSteps = parsed;
    } catch {
      doneSteps = [];
    }
    if (doneSteps.includes(n)) return;
    try {
      sessionStorage.setItem(STEPS_KEY, JSON.stringify([...doneSteps, n]));
    } catch {
      /* sin sessionStorage */
    }
    track('FormStep', { step: n, step_name: STEP_NAMES[n] });
  };

  /** FormError: solo con el píxel cargado y una vez por campo y paso. */
  const errorsSent = new Set<string>();
  const formError = (step: number, field: 'name' | 'phone' | 'prefix') => {
    if (!isPixelLoaded()) return;
    const key = `${step}:${field}`;
    if (errorsSent.has(key)) return;
    errorsSent.add(key);
    track('FormError', { step, field });
  };

  const showError = (el: HTMLElement | null, input: HTMLInputElement, text: string) => {
    if (el) {
      el.textContent = text;
      el.hidden = false;
    }
    input.setAttribute('aria-invalid', 'true');
  };
  const clearError = (el: HTMLElement | null, ...inputs: HTMLInputElement[]) => {
    if (el) el.hidden = true;
    inputs.forEach((i) => i.removeAttribute('aria-invalid'));
  };

  const scrollIntoViewIfNeeded = () => {
    const target = card ?? form;
    const rect = target.getBoundingClientRect();
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 60;
    if (rect.top < headerH || rect.top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + rect.top - headerH - 12, behavior: reduced ? 'auto' : 'smooth' });
    }
  };

  const stepsWrap = form.querySelector<HTMLElement>('.lead-form__steps');
  let resizeTimer = 0;

  /** La tarjeta toma el alto de cada pregunta; el cambio de alto se anima (salvo con reduced motion). */
  const animateHeight = (from: number) => {
    if (!stepsWrap || reduced) return;
    const to = stepsWrap.offsetHeight;
    if (Math.abs(to - from) < 2) return;
    window.clearTimeout(resizeTimer);
    stepsWrap.classList.add('is-resizing');
    stepsWrap.style.height = `${from}px`;
    void stepsWrap.offsetHeight; // fuerza el reflow para que la transición arranque desde "from"
    stepsWrap.style.height = `${to}px`;
    resizeTimer = window.setTimeout(() => {
      stepsWrap.style.height = '';
      stepsWrap.classList.remove('is-resizing');
    }, 320);
  };

  const go = (n: number, opts: { focus?: boolean } = {}) => {
    current = Math.min(Math.max(n, 1), TOTAL);
    const fromHeight = stepsWrap?.offsetHeight ?? 0;
    steps.forEach((s) => {
      const active = Number(s.dataset.step) === current;
      s.classList.toggle('is-active', active);
      s.toggleAttribute('inert', !active);
      s.setAttribute('aria-hidden', String(!active));
    });
    if (opts.focus !== false) animateHeight(fromHeight);
    if (bar) bar.style.transform = `scaleX(${current / TOTAL})`;
    if (count) count.textContent = String(current);
    if (back) back.hidden = current === 1;
    const title = steps[current - 1]?.querySelector<HTMLElement>('[data-step-title]');
    // Solo se anuncia al cambiar de paso (no al cargar la página)
    if (live && title && opts.focus !== false) live.textContent = `Paso ${current} de ${TOTAL}. ${title.textContent?.trim() ?? ''}`;
    if (opts.focus !== false && title) {
      title.focus({ preventScroll: true });
      scrollIntoViewIfNeeded();
    }
    save();
  };

  /* Pasos 1 y 2: opciones que avanzan solas al tocar */
  form.addEventListener('keydown', (e) => {
    lastKey = e.key;
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.type === 'radio') {
      e.preventDefault();
      t.checked = true;
      advanceFromRadio(t);
    }
  });

  const advanceFromRadio = (input: HTMLInputElement) => {
    const stepEl = input.closest<HTMLElement>('[data-step]');
    const n = Number(stepEl?.dataset.step);
    if (n !== current) return;
    markStarted();
    save();
    setTimeout(() => {
      if (current !== n) return;
      completeStep(n);
      go(n + 1);
    }, 200);
  };

  form.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => {
    input.addEventListener('click', () => {
      // Con flechas del teclado solo se selecciona; se avanza al tocar, con Espacio o con Intro.
      if (lastKey.startsWith('Arrow')) {
        lastKey = '';
        save();
        return;
      }
      advanceFromRadio(input);
    });
  });

  form.querySelector('[data-step="1"]')?.addEventListener('pointerdown', markStarted, { once: true });
  form.querySelector('[data-step="1"]')?.addEventListener('focusin', markStarted, { once: true });

  /* Paso 3: nombre (mismo criterio que el Apps Script) */
  const nameMessage = (problem: ReturnType<typeof nameProblem>) =>
    problem === 'charset' ? 'Escribe tu nombre sin caracteres especiales.' : 'Escribe tu nombre (mínimo 2 letras).';

  const nextFromName = () => {
    const problem = nameProblem(nameInput.value);
    if (problem) {
      showError(nameError, nameInput, nameMessage(problem));
      formError(3, 'name');
      nameInput.focus();
      return;
    }
    clearError(nameError, nameInput);
    completeStep(3);
    go(4);
  };
  form.querySelector('[data-next-name]')?.addEventListener('click', nextFromName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextFromName();
    }
  });
  nameInput.addEventListener('input', () => {
    if (validName(nameInput.value)) clearError(nameError, nameInput);
    save();
  });

  /* Paso 4: prefijo y teléfono */
  const syncPrefix = () => {
    const other = prefixSelect.value === 'otro';
    if (prefixValue) prefixValue.textContent = other ? 'Otro' : prefixSelect.value;
    prefixOther.hidden = !other;
    prefixOther.required = other;
    form.querySelector('.phone-row')?.classList.toggle('has-other', other);
  };
  prefixSelect.addEventListener('change', () => {
    syncPrefix();
    if (prefixSelect.value === 'otro') prefixOther.focus();
    save();
  });
  phoneInput.addEventListener('input', () => {
    clearError(phoneError, phoneInput);
    save();
  });
  prefixOther.addEventListener('input', () => {
    clearError(phoneError, prefixOther);
    save();
  });

  back?.addEventListener('click', () => go(current - 1));

  const currentPrefix = () => (prefixSelect.value === 'otro' ? normalizePrefix(prefixOther.value) : prefixSelect.value);

  const setSending = (on: boolean) => {
    sending = on;
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.setAttribute('aria-busy', String(on));
    if (submitLabel) submitLabel.textContent = on ? 'Enviando...' : submitText;
  };

  const showFailure = (p: Payload) => {
    if (errorWa) {
      errorWa.href = whatsappLink(
        SITE.whatsappNumber,
        whatsappErrorMessage({ name: p.name, phone: p.phone, age_range: p.age_range, experience: p.experience }),
      );
    }
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.focus();
    }
  };

  /** El Apps Script ha rechazado un dato: se marca ese campo (sin reintentos ni pendientes). */
  const showServerFieldError = (field: Field) => {
    if (field === 'name') {
      go(3);
      showError(nameError, nameInput, 'Revisa tu nombre: escríbelo sin caracteres especiales.');
      formError(3, 'name');
      nameInput.focus();
    } else if (field === 'phone') {
      showError(phoneError, phoneInput, 'Revisa el número: no parece válido.');
      formError(4, 'phone');
      phoneInput.focus();
    } else {
      go(field === 'age_range' ? 1 : 2);
    }
  };

  /* Estado de gracias en la tarjeta */
  const thanksTitle = thanks?.querySelector<HTMLElement>('[data-thanks-title]');
  const thanksName = thanks?.querySelector<HTMLElement>('[data-thanks-name]');
  const thanksWa = thanks?.querySelector<HTMLAnchorElement>('[data-thanks-whatsapp]');
  const isMobile = detectDevice() === 'móvil';

  thanksWa?.addEventListener('click', () => {
    window.clearTimeout(autoTimer);
    window.clearTimeout(contactTimer);
    track('Contact', { content_category: 'gracias-boton' });
  });

  const showThanks = (name: string, url: string) => {
    if (!thanks) return;
    if (thanksName) thanksName.textContent = cleanName(name).split(' ')[0] ?? '';
    if (thanksWa) {
      thanksWa.href = url;
      if (!isMobile) {
        thanksWa.target = '_blank';
        thanksWa.rel = 'noopener';
      }
    }
    form.hidden = true;
    thanks.hidden = false;
    card?.classList.add('is-done');
    thanksTitle?.focus({ preventScroll: true });
    scrollIntoViewIfNeeded();
  };

  /** En móvil abre WhatsApp solo, a los 1,5 s y nunca antes de 800 ms desde el Lead. */
  const scheduleAutoWhatsApp = (url: string, leadAt: number) => {
    if (!isMobile) return;
    const wait = Math.max(AUTO_WHATSAPP_MS, leadAt + MIN_LEAD_TO_NAV_MS - Date.now());
    contactTimer = window.setTimeout(() => track('Contact', { content_category: 'gracias-auto' }), Math.max(0, wait - 300));
    autoTimer = window.setTimeout(() => {
      window.location.href = url;
    }, wait);
  };

  /* Al volver atrás desde WhatsApp (bfcache), la página no se queda bloqueada */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    window.clearTimeout(autoTimer);
    window.clearTimeout(contactTimer);
    if (submitted && done) showThanks(done.name, done.url);
    else setSending(false);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current !== TOTAL) {
      if (current === 3) nextFromName();
      return;
    }
    if (sending || submitted) return;

    const prefix = currentPrefix();
    if (!prefix) {
      showError(phoneError, prefixOther, 'Escribe un prefijo válido, por ejemplo +33.');
      formError(4, 'prefix');
      prefixOther.focus();
      return;
    }
    const phone = normalizePhone(prefix, phoneInput.value);
    if (!phone) {
      showError(phoneError, phoneInput, 'Escribe un número válido.');
      formError(4, 'phone');
      phoneInput.focus();
      return;
    }
    clearError(phoneError, phoneInput, prefixOther);

    completeStep(4);
    if (errorBox) errorBox.hidden = true;

    const fd = new FormData(form);
    const name = cleanName(String(fd.get('name') ?? ''));
    ensureEventId();
    save();
    const utm = getAttribution();
    const payload = buildAppsScriptPayload({
      age_range: String(fd.get('age_range') ?? ''),
      experience: String(fd.get('experience') ?? ''),
      name,
      phone,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      event_id: eventId,
      website: honeypot.value,
    });

    setSending(true);
    try {
      await sendLead(payload);
    } catch (err) {
      setSending(false);
      if (err instanceof ServerValidationError) {
        showServerFieldError(err.field);
        return;
      }
      addPending(payload);
      showFailure(payload);
      return;
    }

    removePending(eventId);
    if (!payload.website) reportLead(payload);
    const leadAt = Date.now();
    submitted = true;
    setSending(false);
    const url = whatsappLink(
      SITE.whatsappNumber,
      whatsappMessage({ name, age_range: payload.age_range, experience: payload.experience, fromFaq }),
    );
    done = { name, url };
    save();
    showThanks(name, url);
    scheduleAutoWhatsApp(url, leadAt);
  });

  /* Restaurar progreso (o el estado de gracias si ya se envió en esta pestaña) */
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || 'null');
    if (saved?.done && typeof saved.url === 'string' && saved.url.startsWith('https://wa.me/')) {
      submitted = true;
      done = { name: String(saved.name || ''), url: saved.url };
      showThanks(done.name, done.url);
    } else if (saved) {
      const setRadio = (name: string, value: string) => {
        const el = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(value || '')}"]`);
        if (el) el.checked = true;
      };
      setRadio('age_range', saved.age_range);
      setRadio('experience', saved.experience);
      nameInput.value = saved.name || '';
      if (saved.prefix) prefixSelect.value = saved.prefix;
      prefixOther.value = saved.prefix_other || '';
      phoneInput.value = saved.phone || '';
      startedAt = saved.startedAt || 0;
      eventId = isUuid(saved.event_id) ? saved.event_id : '';
      fromFaq = saved.from_faq === true;
      syncPrefix();
      let step = Number(saved.step) || 1;
      if (step > 1 && !saved.age_range) step = 1;
      else if (step > 2 && !saved.experience) step = 2;
      else if (step > 3 && !validName(saved.name || '')) step = 3;
      go(step, { focus: false });
    } else {
      // Preselección según el anuncio (tabla en src/data/ad-variants.ts; vacía de momento): marca sin avanzar
      const pre = pickPreselect(new URLSearchParams(location.search).get('utm_content') || getAttribution().utm_content);
      for (const [name, value] of [
        ['age_range', pre?.age_range],
        ['experience', pre?.experience],
      ] as const) {
        if (!value) continue;
        const el = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(value)}"]`);
        if (el) el.checked = true;
      }
      go(1, { focus: false });
    }
  } catch {
    go(1, { focus: false });
  }

  /* ViewContent: la primera vez que el formulario entra en pantalla */
  const section = document.querySelector('#formulario');
  if (section && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          track('ViewContent', { content_name: 'Formulario' });
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(section);
  }
}
