/**
 * Formulario de 4 pasos (una pregunta cada vez).
 * Envío a Google Apps Script como text/plain (sin preflight CORS), timeout 12 s,
 * 1 reintento, y si vuelve a fallar se guarda en localStorage para reintentarlo
 * en la siguiente visita.
 */
import { SITE, hasWhatsApp, whatsappUrl } from '../config/site';
import { track, hasMarketingConsent } from './pixel';
import { getAttribution } from './tracking';

const DEV = import.meta.env.DEV;
const ENDPOINT: string = SITE.formEndpoint;
const TIMEOUT_MS = 12000;
const PROGRESS_KEY = 'pyp_form_progress';
const STARTED_KEY = 'pyp_form_started';
const LEAD_SENT_KEY = 'pyp_lead_sent';
const NAME_KEY = 'pyp_lead_name';
const PENDING_KEY = 'pyp_pending_leads';
const TOTAL = 4;
const STEP_NAMES = ['', 'edad', 'experiencia', 'nombre', 'telefono'];

export const AGE_OPTIONS = ['Menos de 30', 'De 30 a 39', 'De 40 a 49', 'De 50 a 59', '60 o más'];
export const EXPERIENCE_OPTIONS = ['Nunca he entrenado', 'Menos de 1 año', 'Entre 1 y 2 años', 'Entre 2 y 3 años', 'Más de 3 años'];

type Payload = Record<string, string | number>;

/* ---------- Utilidades puras (también se prueban en Node) ---------- */

export function uuidv4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function normalizePrefix(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length > 4) return null;
  return `+${digits}`;
}

/** Devuelve el teléfono en E.164 (+34612345678) o null si no es válido. */
export function normalizePhone(prefix: string, raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '');
  const pre = prefix.replace('+', '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    if (digits.startsWith(pre)) digits = digits.slice(pre.length);
  } else if (digits.startsWith('00' + pre)) {
    digits = digits.slice(2 + pre.length);
  } else if (pre === '34' && digits.length === 11 && digits.startsWith('34')) {
    digits = digits.slice(2);
  }
  digits = digits.replace(/\D/g, '');
  if (pre === '34') {
    if (!/^[6789]\d{8}$/.test(digits)) return null;
  } else if (!/^\d{6,15}$/.test(digits)) {
    return null;
  }
  return `+${pre}${digits}`;
}

export function validName(raw: string): boolean {
  const v = raw.trim();
  return v.length >= 2 && v.length <= 60 && /\p{L}/u.test(v);
}

/* ---------- Envío ---------- */

async function postOnce(payload: Payload): Promise<{ ok: boolean; id?: string }> {
  if (!ENDPOINT) {
    if (DEV) {
      console.info('[form] Sin endpoint: envío simulado en desarrollo', payload);
      await new Promise((r) => setTimeout(r, 600));
      return { ok: true, id: 'DEV-SIMULADO' };
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
    const data = (await res.json().catch(() => ({}))) as { ok?: unknown; id?: unknown };
    if (data.ok !== true) throw new Error('Respuesta no válida');
    return { ok: true, id: typeof data.id === 'string' ? data.id : '' };
  } finally {
    clearTimeout(timer);
  }
}

async function sendLead(payload: Payload) {
  try {
    return await postOnce(payload);
  } catch {
    return await postOnce(payload); // un reintento
  }
}

function readPending(): Payload[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as Payload[];
  } catch {
    return [];
  }
}

function writePending(list: Payload[]) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-5)));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

function fireLead(payload: Payload) {
  try {
    if (sessionStorage.getItem(LEAD_SENT_KEY) === String(payload.event_id)) return;
    sessionStorage.setItem(LEAD_SENT_KEY, String(payload.event_id));
  } catch {
    /* si no hay sessionStorage, se envía igualmente una vez */
  }
  track(
    'Lead',
    { content_name: 'Formulario Pomposo', age_range: String(payload.age_range), experience: String(payload.experience) },
    { eventID: String(payload.event_id) },
  );
}

/** Reintenta en segundo plano los leads que no se pudieron enviar en una visita anterior. */
export async function retryPendingLeads() {
  const list = readPending();
  if (!list.length || !ENDPOINT) return;
  const left: Payload[] = [];
  for (const p of list) {
    try {
      await sendLead({ ...p, retried: 'si' });
      if (p.website === '' || p.website === undefined) fireLead(p);
    } catch {
      left.push(p);
    }
  }
  writePending(left);
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
  const prefixSelect = form.querySelector<HTMLSelectElement>('#lf-prefix')!;
  const prefixOther = form.querySelector<HTMLInputElement>('#lf-prefix-other')!;
  const prefixValue = form.querySelector<HTMLElement>('[data-prefix-value]');
  const phoneInput = form.querySelector<HTMLInputElement>('#lf-phone')!;
  const privacy = form.querySelector<HTMLInputElement>('#lf-privacy')!;
  const honeypot = form.querySelector<HTMLInputElement>('[name="website"]')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = 1;
  let sending = false;
  let startedAt = 0;
  let lastKey = '';

  /* Progreso guardado por si recarga */
  const save = () => {
    try {
      sessionStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({
          step: current,
          age_range: (form.elements.namedItem('age_range') as RadioNodeList).value,
          experience: (form.elements.namedItem('experience') as RadioNodeList).value,
          name: nameInput.value,
          prefix: prefixSelect.value,
          prefix_other: prefixOther.value,
          phone: phoneInput.value,
          startedAt,
        }),
      );
    } catch {
      /* sin sessionStorage */
    }
  };

  const markStarted = () => {
    if (!startedAt) startedAt = Date.now();
    try {
      if (sessionStorage.getItem(STARTED_KEY)) return;
      sessionStorage.setItem(STARTED_KEY, '1');
    } catch {
      /* continúa */
    }
    track('FormStart');
  };

  const setError = (id: string, show: boolean) => {
    const el = form.querySelector<HTMLElement>(`#${id}`);
    if (el) el.hidden = !show;
  };

  const scrollIntoViewIfNeeded = () => {
    const card = form.closest<HTMLElement>('.lead-card') ?? form;
    const rect = card.getBoundingClientRect();
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 60;
    if (rect.top < headerH || rect.top > window.innerHeight * 0.6) {
      window.scrollTo({ top: window.scrollY + rect.top - headerH - 12, behavior: reduced ? 'auto' : 'smooth' });
    }
  };

  const go = (n: number, opts: { focus?: boolean } = {}) => {
    current = Math.min(Math.max(n, 1), TOTAL);
    steps.forEach((s) => {
      const active = Number(s.dataset.step) === current;
      s.classList.toggle('is-active', active);
      s.toggleAttribute('inert', !active);
      s.setAttribute('aria-hidden', String(!active));
    });
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

  const completeStep = (n: number) => track('FormStep', { step: n, step_name: STEP_NAMES[n] });

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

  /* Paso 3: nombre */
  const nextFromName = () => {
    if (!validName(nameInput.value)) {
      setError('lf-name-error', true);
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    setError('lf-name-error', false);
    nameInput.removeAttribute('aria-invalid');
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
    if (validName(nameInput.value)) {
      setError('lf-name-error', false);
      nameInput.removeAttribute('aria-invalid');
    }
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
    phoneInput.removeAttribute('aria-invalid');
    setError('lf-phone-error', false);
    save();
  });
  prefixOther.addEventListener('input', save);
  privacy.addEventListener('change', () => privacy.checked && setError('lf-privacy-error', false));

  back?.addEventListener('click', () => go(current - 1));

  const currentPrefix = () => (prefixSelect.value === 'otro' ? normalizePrefix(prefixOther.value) : prefixSelect.value);

  const setSending = (on: boolean) => {
    sending = on;
    if (!submitBtn) return;
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.setAttribute('aria-busy', String(on));
    if (submitLabel) submitLabel.textContent = on ? 'Enviando...' : 'Quiero mi plaza';
  };

  const showFailure = (name: string) => {
    if (errorWa && hasWhatsApp) {
      errorWa.href = whatsappUrl(
        `Hola, soy ${name}. He intentado rellenar el formulario de la web de Pomposo y Peligroso y no se ha enviado. Quiero información.`,
      );
    }
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.focus();
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current !== TOTAL) {
      if (current === 3) nextFromName();
      return;
    }
    if (sending) return;

    const prefix = currentPrefix();
    const phone = prefix ? normalizePhone(prefix, phoneInput.value) : null;
    let valid = true;
    if (!phone) {
      valid = false;
      phoneInput.setAttribute('aria-invalid', 'true');
      setError('lf-phone-error', true);
    }
    if (!privacy.checked) {
      valid = false;
      setError('lf-privacy-error', true);
    }
    if (!valid) {
      (!phone ? (prefixSelect.value === 'otro' && !prefix ? prefixOther : phoneInput) : privacy).focus();
      return;
    }

    completeStep(4);
    if (errorBox) errorBox.hidden = true;

    const fd = new FormData(form);
    const name = String(fd.get('name') ?? '').trim().replace(/\s+/g, ' ');
    const eventId = uuidv4();
    const seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    const payload: Payload = {
      age_range: String(fd.get('age_range') ?? ''),
      experience: String(fd.get('experience') ?? ''),
      name,
      phone: phone!,
      ...getAttribution(),
      event_id: eventId,
      submitted_at: new Date().toISOString(),
      time_to_complete: seconds,
      consent_marketing: hasMarketingConsent() ? 'si' : 'no',
      website: honeypot.value,
    };

    setSending(true);
    try {
      await sendLead(payload);
      if (!honeypot.value) fireLead(payload);
      try {
        sessionStorage.setItem(NAME_KEY, name);
        sessionStorage.removeItem(PROGRESS_KEY);
      } catch {
        /* sin sessionStorage */
      }
      // Pequeña espera para que el evento Lead salga antes de cambiar de página
      setTimeout(() => location.assign('/gracias'), hasMarketingConsent() ? 350 : 0);
    } catch {
      writePending([...readPending(), payload]);
      setSending(false);
      showFailure(name);
    }
  });

  /* Restaurar progreso */
  try {
    const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || 'null');
    if (saved) {
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
      syncPrefix();
      let step = Number(saved.step) || 1;
      if (step > 1 && !saved.age_range) step = 1;
      else if (step > 2 && !saved.experience) step = 2;
      else if (step > 3 && !validName(saved.name || '')) step = 3;
      go(step, { focus: false });
    } else {
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
