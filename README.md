# Pomposo y Peligroso · Landing para Meta Ads

Landing de captación para el programa online de 12 semanas de **Pomposo y Peligroso** (The Monkeys Centro de Entrenamiento S.L.). Objetivo único: que la usuaria rellene un formulario de 4 pasos para que el equipo la contacte por WhatsApp. La conversión (evento `Lead`) es el envío del formulario: se cuenta en el píxel (con consentimiento) y en la API de conversiones de Meta (siempre), con el mismo `event_id`. Antes de enviar no hay ningún enlace que saque de la web; después, la tarjeta del formulario muestra el estado de gracias y en móvil se abre WhatsApp sola.

- **Stack:** Astro 7 (salida 100 % estática), CSS propio con variables, JavaScript vanilla (7,4 KB comprimido), fuentes autoalojadas y precargadas (Anton para titulares, Allura para la línea manuscrita, Inter para el texto), fotos en WebP con varios tamaños por foto generadas por `astro:assets`.
- **Despliegue:** Vercel (`vercel.json` incluido). Las páginas son estáticas (`dist/`) y la API de conversiones es una función de Vercel en `api/lead-capi.js`.
- **Datos:** Google Sheets vía Google Apps Script (`apps-script/Code.gs`).

## Ejecutar en local

Requisitos: Node 22.12 o superior.

```bash
npm install
npm run dev          # http://localhost:4321 (el formulario simula el envío y lo muestra en consola)
npm run build        # genera dist/
npm run preview      # sirve dist/ en local
npm run validate:html          # valida el HTML generado
npm run check                  # tipos (astro check)
npm test                       # unitarias, contrato del payload, Apps Script, build y prueba de fugas
npm run test:e2e               # Playwright en 390x844 (Instagram en iPhone) y 1440x900, sobre dist/
```

`npm test` incluye:

- `tests/unit/lead.test.mjs`: funciones puras del formulario (`src/lib/lead.ts`): teléfono, nombre (mismo criterio que el Apps Script), país por prefijo, texto de WhatsApp y versión del hero por anuncio.
- `tests/unit/payload.test.mjs`: contrato con el Apps Script. Lo que se le envía tiene que ser idéntico a `tests/fixtures/apps-script-payload.json` (capturado antes de los cambios de octubre de 2026 con el endpoint interceptado).
- `tests/unit/capi.test.mjs`: la función `/api/lead-capi` con `fetch` simulado (hashes, sin token, errores de Meta, origen).
- `apps-script/test/code.test.mjs`: el Apps Script con los servicios de Google simulados.
- `tests/static/leaks.test.mjs`: sobre `dist/`, falla si aparece un enlace de fuga (WhatsApp, teléfono, email, Instagram u otro dominio externo) o si un enlace a las legales no se abre en pestaña nueva.

Las pruebas de Playwright (`tests/e2e/`) interceptan siempre el Apps Script, `/api/lead-capi`, Meta (con un `fbq` espía) y WhatsApp: nunca tocan la hoja real ni mandan nada a Meta. Dejan capturas en `source/qa/capturas/e2e-*.png`.

En `npm run dev` cada evento del píxel aparece en la consola del navegador como `[pixel] ...` y el envío del formulario como `[form] ...`, aunque no haya ID de píxel ni endpoint.

## Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project → Import** el repositorio. Vercel detecta Astro solo y publica `api/lead-capi.js` como función.
3. Variables de entorno (Settings → Environment Variables, Production): `META_CAPI_TOKEN` para la API de conversiones (ver más abajo). Sin ella la web funciona igual, solo que sin API de conversiones.
4. El dominio está en Vercel (Settings → Domains) y en `SITE.url`: https://www.pomposoypeligroso.com. El dominio sin `www` redirige al de `www`. Si cambias de dominio, actualiza las dos cosas.

## Dónde se edita cada cosa

| Qué | Dónde |
|---|---|
| ID del píxel, endpoint del formulario, WhatsApp, teléfono, email, dominio, datos legales, interruptor de transformaciones | `src/config/site.ts` |
| Preguntas frecuentes | `src/data/faq.ts` |
| Versión del hero según el anuncio y preselección del formulario | `src/data/ad-variants.ts` |
| Testimonios reales (con `source`) | `src/data/testimonials.ts` |
| Antes y después (caso de Noelia y carrusel) | `src/data/transformations.ts` + `src/assets/img/antes-despues/` + `SITE.showTransformations` |
| Clips de vídeo de alumnas | `src/components/TrainingVideos.astro` + `public/video/` (MP4 y WebM) |
| Fichas del equipo (Dani, Adri, Flor, Fede) | `src/components/Coach.astro` |
| Textos de cada sección | `src/components/*.astro` (un archivo por sección) |
| Colores, tipografías y espaciados | `src/styles/tokens.css` |
| Textos legales | `src/pages/aviso-legal.astro`, `privacidad.astro`, `cookies.astro` |
| Fotos | `src/assets/img/` (se optimizan solas al hacer build) |

Si no hay ID de píxel, no se carga nada de Meta; si no hay endpoint, en desarrollo se simula el envío y en producción se muestra el aviso de error con el botón de WhatsApp (y la solicitud queda guardada en el navegador para reintentarla).

### Diseño

- **Titulares:** mayúsculas en Anton y, debajo, una línea corta en manuscrita (Allura, rosa, un poco girada). En el código: `<h2>Texto en mayúsculas <span class="script">línea manuscrita.</span></h2>`. La línea manuscrita va siempre sola y con 2 a 4 palabras.
- **Fondos con foto:** hero, "Así funciona" (grupo de The Monkeys entrenando junto al mar) y cierre. Llevan un velo oscuro para que el texto se lea; si cambias la foto, revisa que el texto siga leyéndose bien.
- **Orden pensado para Meta:** hero (con tres antes/después y "Videollamada sin compromiso"), ¿te suena?, resultados, formulario ("Mira si encajas", plazas limitadas), comparativa con lo que incluye, vídeos, acompañamiento, equipo, cómo funciona, preguntas y cierre. El formulario está en la cuarta pantalla del móvil.
- **Formulario:** la tarjeta toma el alto de cada pregunta y el cambio de alto se anima. No hay casilla de privacidad: bajo el botón "Enviar y abrir WhatsApp" se avisa de que al enviar se acepta la política de privacidad, con la primera capa de protección de datos debajo.
- **Carga:** todo el HTML y el CSS llegan en una sola petición; las fuentes y la foto del hero se precargan; el resto de fotos se piden en cuanto la página ha cargado y el navegador está libre, para que al hacer scroll ya estén (no se hace con "ahorro de datos" ni en 2G).
- **Fotos:** todas reales (alumnas y equipo), ninguna de banco de imágenes. Origen en `source/brand/README.md`.
- **Vídeos:** 6 clips de 6 s sin audio (unos 300 KB cada uno). No se descargan hasta que la sección se acerca a la pantalla y solo se reproducen mientras se ven.
- **Movimiento:** el carrusel de antes y después va hacia la izquierda y el de testimonios hacia la derecha, en bucle. Se paran al pasar el ratón y del todo si el sistema tiene activado "reducir movimiento" (entonces se deslizan con el dedo).

## Meta Pixel

Pega el ID (solo números) en `SITE.metaPixelId`. El píxel **solo se carga si hay ID y la usuaria acepta las cookies de marketing**; hasta entonces no hay ni una petición a Meta. Si retira el consentimiento se llama a `fbq('consent', 'revoke')` y se borran `_fbp` y `_fbc`.

| Evento | Tipo | Cuándo | Parámetros |
|---|---|---|---|
| `PageView` | Estándar | Al cargar, tras el consentimiento (o en el momento de aceptar) | |
| `ViewContent` | Estándar | La primera vez que el formulario entra en pantalla | `content_name: 'Formulario'` |
| `FormStart` | Personalizado | Primera interacción con el paso 1 (una vez por sesión) | |
| `FormStep` | Personalizado | Al completar cada paso, **una vez por paso y sesión** (ir atrás y adelante no lo repite) | `step` (1 a 4), `step_name` (`edad`, `experiencia`, `nombre`, `telefono`) |
| `FormError` | Personalizado | Error de validación, una vez por campo y paso | `step`, `field` (`name`, `phone`, `prefix`) |
| `Lead` | Estándar | **Solo cuando el Apps Script responde `ok: true`**, una sola vez por solicitud (también si se reintenta) | `content_name: 'Formulario Pomposo'`, `age_range`, `experience` + `eventID`. Antes, coincidencia avanzada con `fbq('init', id, { ph, fn, country })` |
| `Contact` | Estándar | WhatsApp tras enviar, o botones de `/gracias` y del aviso de error | `content_category`: `gracias-auto` (se abre solo en móvil), `gracias-boton`, `gracias` (página de respaldo) o `form-error` |

El `event_id` se genera una vez por solicitud al empezar el formulario, se guarda con el progreso y se reutiliza en los reintentos; es el mismo en el píxel y en la API de conversiones, así que Meta los deduplica. Las solicitudes que fallan se guardan en `pyp_pending_leads` sin duplicados (una por `event_id`) y se reintentan en la siguiente visita; si el Apps Script rechaza un dato (`invalid_*`), no se reintenta: se marca el campo.

`/gracias` es solo una página de respaldo (el formulario ya no lleva allí) y no dispara ninguna conversión.

**`<noscript>` del píxel:** está en `src/components/Pixel.astro` pero desactivado (`NOSCRIPT_PIXEL = false`). Sin JavaScript no se puede pedir consentimiento, así que esa imagen dispararía el píxel sin permiso, contrario a la guía de la AEPD.

**Otros píxeles (TikTok, Google):** hay un hueco comentado en `src/layouts/Base.astro`. Se cargan dentro de `applyConsent()` en `src/scripts/consent.ts`, con la misma condición que el de Meta, y hay que añadir su dominio a la CSP de `astro.config.mjs`.

### Parámetros de URL para los anuncios

Pega esto en **Parámetros de URL** de cada anuncio en Meta Ads:

```
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&utm_id={{campaign.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
```

Con eso el Sheet sabe de qué campaña, conjunto y anuncio viene cada lead. El formulario solo envía `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` y `utm_term`; el resto de parámetros de la plantilla se ignoran.

### API de conversiones

Función de Vercel en `api/lead-capi.js` (lógica pura en `api/_lib/capi.js`, sin dependencias). El navegador la llama con `fetch(..., { keepalive: true })` **solo después de que el Apps Script haya respondido `ok: true`**, con o sin consentimiento de cookies, y nunca afecta a la usuaria (si falla, falla en silencio).

- Recibe: `event_id`, nombre, teléfono, edad, experiencia, `fbclid`, `fbc`, `fbp` y `event_source_url`. El `fbclid` (y el `fbc` construido con él, `fb.1.<ts>.<fbclid>`) viaja aunque se rechacen las cookies porque llega en la URL del anuncio; `_fbp` y `_fbc` solo existen con consentimiento porque los pone el píxel. Nada de esto va al Apps Script.
- Envía a `https://graph.facebook.com/v26.0/<PIXEL_ID>/events` un `Lead` con `event_id` (el mismo que el píxel), `event_time`, `action_source: 'website'`, `event_source_url`, `user_data` (`ph`, `fn` y `country` en SHA-256; `fbc`, `fbp`, IP y user agent sin hash) y `custom_data` (`content_name`, `age_range`, `experience`). La versión de la Graph API está en `GRAPH_API_VERSION`.
- Solo acepta POST del propio dominio con un `event_id` UUID; valida y limita las longitudes. Siempre responde 204 (con token o sin él, acepte Meta el evento o no) y deja el resultado en el log de Vercel (`[lead-capi] Meta 200 ...`).

Variables de entorno en Vercel (Settings → Environment Variables, Production):

| Variable | Para qué |
|---|---|
| `META_CAPI_TOKEN` | Token de acceso. Se genera en el Administrador de eventos de Meta: píxel 1162548892864094, Configuración, API de conversiones, Generar token de acceso. **Sin él no se envía nada** y la web funciona igual. Nunca en el repo ni en el chat. |
| `META_PIXEL_ID` | Opcional. Por defecto `1162548892864094`. |
| `META_TEST_EVENT_CODE` | Opcional, solo mientras se prueba en "Probar eventos". Quítala después. |

Tras cambiar una variable hay que volver a desplegar (Deployments → Redeploy) para que la función la lea.

## WhatsApp, gracias y hero según el anuncio

- **Antes de enviar no hay salidas:** ni WhatsApp, ni teléfono, ni email, ni Instagram en la home, la barra fija móvil (un solo botón, al formulario), el footer (marca, enlaces internos, legales, "Configurar cookies" y un CTA al formulario) ni las preguntas frecuentes ("¿Otra duda? Déjanos tu WhatsApp y te la resolvemos" lleva al formulario). Las legales se abren en pestaña nueva y en ellas el contacto va como texto.
- **Después de enviar:** la tarjeta muestra "Gracias, {nombre}. Te abrimos WhatsApp para que nos escribas ya." con el botón "Abrir WhatsApp". En móvil se abre sola a los 1,5 s (nunca antes de 800 ms desde el `Lead`) con `window.location.href`; en escritorio, solo con el botón (en pestaña nueva). El mensaje resume la solicitud (nombre, edad y experiencia) y añade "Tengo una duda: " si se llegó desde la pregunta de las FAQ. Al volver atrás o recargar se sigue viendo el estado de gracias.
- **Aviso de error:** si el envío falla por red, el botón de WhatsApp del aviso lleva todos los datos del formulario (lo genera `form.ts`; el HTML no lleva ningún `wa.me`).
- **Hero según el anuncio:** un script en el `<head>` (`src/layouts/Base.astro`) lee `utm_content` y, si no encaja, `utm_campaign`, y pone `data-ad` en `<html>` antes del primer pintado (se recuerda en la sesión con `pyp_ad_variant`). `Hero.astro` pinta las dos versiones y el CSS muestra la activa, sin saltos. Versiones: `descubrir` (por defecto y campañas con "DESCUBRIR" o "TOFU": el hero de siempre) y `cierre` (campañas con "CIERRE", "RETARGETING", "REMARKETING", "MOFU" o "BOFU": "Tu glúteo no se va a poner pomposo solo.", "Pide tu videollamada sin compromiso..." y "Pedir mi videollamada"). Si la campaña de cierre se llama de otra forma, añade la palabra en `src/data/ad-variants.ts`. En ese archivo está también la tabla de preselección de edad o experiencia por anuncio, vacía hasta conocer los nombres.

## Google Sheets + Apps Script

El código completo está en `apps-script/Code.gs` (sin comentarios, listo para pegar; esta sección lo explica).

**Los cambios de octubre de 2026 (API de conversiones, WhatsApp tras enviar, hero por anuncio, cero fugas) no tocaron el Apps Script ni la hoja:** el formulario le envía exactamente los mismos campos que antes, con los mismos nombres y valores (lo comprueba `tests/unit/payload.test.mjs` y `tests/e2e/payload.spec.mjs`). `event_id` ya viajaba antes; el Apps Script lo ignora y no se guarda en la hoja.

### Instalación

1. Crea un Google Sheet nuevo (con la cuenta que vaya a recibir los leads). Ve a **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs`, pega todo `apps-script/Code.gs` y guarda.
3. En el desplegable de funciones elige **`setup`** y pulsa **Ejecutar**. Autoriza los permisos (Google avisará de que la app no está verificada: **Configuración avanzada → Ir a ... (no seguro)**, es tu propio script). Se crean las hojas **Leads** y **Contador**. Si ya tenías la versión de 10 columnas, `setup` le añade la columna Estado sin tocar los leads; si tenías la primera versión de 35 columnas, borra el contenido de esa hoja (era solo de pruebas) y quita la hoja **Resumen**.
4. **Implementar → Nueva implementación**. Tipo: **Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**. Pulsa **Implementar** y copia la URL que termina en `/exec`.
5. Pega esa URL en `SITE.formEndpoint` (`src/config/site.ts`), haz commit y despliega.
6. Prueba: abre la URL `/exec` en el navegador; debe responder `{"ok":true,"status":"alive"}`. Después envía el formulario desde la web y comprueba que aparece la fila en **Leads**.
7. Si cambias el código más adelante: **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar**. Así la URL no cambia.

Cada lead nuevo manda un aviso por email a la dirección de `NOTIFY_EMAIL` (al principio del script, ahora aaswebmarketing@gmail.com) con nombre, teléfono, edad, experiencia, anuncio, campaña y enlace directo a WhatsApp. Para cambiarla, edítala y vuelve a implementar como en el paso 7; vacía, no se envía nada.

### Qué hace

- **Leads:** una fila por lead (la más reciente abajo) con 11 columnas: fecha y hora juntas (Europe/Madrid), nombre, teléfono en texto (E.164), edad, experiencia, **Estado** y los cinco `utm` (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content` con el anuncio y `utm_term` con el conjunto). Nada más: ni IDs, ni referrer, ni dispositivo, ni tiempos.
- **Estado:** desplegable con colores (Nuevo, Contactado, No contesta, Videollamada agendada, Videollamada hecha, Alumna, Descartada). Cada lead entra como Nuevo.
- **Contador:** hoja aparte que se actualiza sola con fórmulas: total de leads, hoy, ayer, últimos 7 días, últimos 30 días y cuántos hay en cada estado. No hay que tocarla.
- Valida los datos, neutraliza fórmulas inyectadas, usa `LockService`, no duplica el mismo teléfono en 10 minutos y descarta en silencio el campo trampa (honeypot) de los bots.
- Manda un email por cada lead nuevo (no por duplicados ni bots).

## Calidad

- Lighthouse en la home (28/10/2026, mismo servidor local que la versión anterior): móvil **99-100 / 100 / 100 / 100** (LCP 1,9 s, TBT 0 ms, CLS 0), escritorio **100 / 100 / 100 / 100** (LCP 0,6 s, CLS 0). La versión anterior daba 99 / 100 / 100 / 92 en móvil (CLS 0,003) y 100 / 100 / 100 / 92 en escritorio (CLS 0,007).
- Pruebas: ver "Ejecutar en local". Informe y limitaciones en `source/qa/INFORME-QA.md`; capturas en `source/qa/capturas/`.
- Scripts de QA anteriores en `source/qa/scripts/` (accesibilidad con axe, anchos e iPhone emulado; necesitan `@axe-core/playwright` y un build servido en local).

## Material de partida

- `source/reference/`: análisis de las tres landings de referencia.
- `source/instagram/README.md`: por qué no se pudo usar el Instagram (bloqueo de acceso) y qué se usó en su lugar.
- `source/brand/`: logo original de The Monkeys y origen de las fotos propias del centro.
- `source/stock/CREDITS.md`: ya no se usa stock (nota histórica).

## Aviso sobre los textos legales

Este texto es un modelo orientativo y debe revisarlo un profesional. Los textos de aviso legal, privacidad y cookies se han redactado con los datos facilitados y la normativa vigente (LSSI‑CE, RGPD, LOPDGDD y guía de cookies de la AEPD), pero no sustituyen el asesoramiento jurídico.

## Pendientes

Ver [`PENDIENTES.md`](./PENDIENTES.md).
