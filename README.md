# Pomposo y Peligroso · Landing para Meta Ads

Landing de captación para el programa online de 12 semanas de **Pomposo y Peligroso** (The Monkeys Centro de Entrenamiento S.L.). Objetivo único: que la usuaria rellene un formulario de 4 pasos para que el equipo la contacte por WhatsApp. La conversión (evento `Lead`) es el envío del formulario.

- **Stack:** Astro 7 (salida 100 % estática), CSS propio con variables, JavaScript vanilla (7,4 KB comprimido), fuentes autoalojadas y precargadas (Anton para titulares, Allura para la línea manuscrita, Inter para el texto), fotos en WebP con varios tamaños por foto generadas por `astro:assets`.
- **Despliegue:** Vercel (`vercel.json` incluido).
- **Datos:** Google Sheets vía Google Apps Script (`apps-script/Code.gs`).

## Ejecutar en local

Requisitos: Node 22.12 o superior.

```bash
npm install
npm run dev          # http://localhost:4321 (el formulario simula el envío y lo muestra en consola)
npm run build        # genera dist/
npm run preview      # sirve dist/ en local
npm run validate:html          # valida el HTML generado
npm run test:apps-script       # pruebas del Apps Script en Node
```

En `npm run dev` cada evento del píxel aparece en la consola del navegador como `[pixel] ...` y el envío del formulario como `[form] ...`, aunque no haya ID de píxel ni endpoint.

## Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project → Import** el repositorio. Vercel detecta Astro solo; no hace falta ninguna variable de entorno.
3. Despliega. Mientras el dominio esté como PENDIENTE en `site.ts`, el canonical, el Open Graph y el sitemap usan automáticamente la URL de producción de Vercel (`*.vercel.app`).
4. Cuando tengas dominio: añádelo en Vercel (Settings → Domains) y ponlo en `SITE.url`.

## Dónde se edita cada cosa

| Qué | Dónde |
|---|---|
| ID del píxel, endpoint del formulario, WhatsApp, teléfono, email, dominio, datos legales, interruptor de transformaciones | `src/config/site.ts` |
| Preguntas frecuentes | `src/data/faq.ts` |
| Testimonios reales (con `source`) | `src/data/testimonials.ts` |
| Antes y después (caso de Noelia y carrusel) | `src/data/transformations.ts` + `src/assets/img/antes-despues/` + `SITE.showTransformations` |
| Clips de vídeo de alumnas | `src/components/TrainingVideos.astro` + `public/video/` (MP4 y WebM) |
| Fichas del equipo (Dani, Adri, Flor, Fede) | `src/components/Coach.astro` |
| Textos de cada sección | `src/components/*.astro` (un archivo por sección) |
| Colores, tipografías y espaciados | `src/styles/tokens.css` |
| Textos legales | `src/pages/aviso-legal.astro`, `privacidad.astro`, `cookies.astro` |
| Fotos | `src/assets/img/` (se optimizan solas al hacer build) |

Comportamiento con valores PENDIENTE: si el WhatsApp es el de ejemplo, se ocultan los enlaces de WhatsApp del footer, las preguntas frecuentes y el formulario, y el botón morado de WhatsApp de la barra fija del móvil y el flotante de escritorio llevan al formulario (en cuanto pongas el número, abren WhatsApp); si no hay ID de píxel, no se carga nada de Meta; si no hay endpoint, en desarrollo se simula el envío y en producción se muestra la alternativa de contacto (y el lead queda guardado en el navegador para reintentarlo).

### Diseño

- **Titulares:** mayúsculas en Anton y, debajo, una línea corta en manuscrita (Allura, rosa, un poco girada). En el código: `<h2>Texto en mayúsculas <span class="script">línea manuscrita.</span></h2>`. La línea manuscrita va siempre sola y con 2 a 4 palabras.
- **Fondos con foto:** hero, "Así funciona" (grupo de The Monkeys entrenando junto al mar) y cierre. Llevan un velo oscuro para que el texto se lea; si cambias la foto, revisa que el texto siga leyéndose bien.
- **Orden pensado para Meta:** hero (con tres antes/después y "Videollamada sin compromiso"), ¿te suena?, resultados, formulario ("Mira si encajas", plazas limitadas), comparativa con lo que incluye, vídeos, acompañamiento, equipo, cómo funciona, preguntas y cierre. El formulario está en la cuarta pantalla del móvil.
- **Formulario:** la tarjeta toma el alto de cada pregunta y el cambio de alto se anima.
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
| `FormStep` | Personalizado | Al completar cada paso | `step` (1 a 4), `step_name` (`edad`, `experiencia`, `nombre`, `telefono`) |
| `Lead` | Estándar | **Solo cuando el Apps Script responde `ok: true`**, una vez por envío | `content_name: 'Formulario Pomposo'`, `age_range`, `experience` + `eventID` (= `event_id` del Sheet) |
| `Contact` | Estándar | Clic en WhatsApp o teléfono | `method` (`whatsapp`/`phone`), `location` (`fab`, `barra-movil`, `footer`, `faq`, `form-help`, `form-error`, `gracias`...) |

`/gracias` no dispara ninguna conversión (así no se duplica si recargan).

**`<noscript>` del píxel:** está en `src/components/Pixel.astro` pero desactivado (`NOSCRIPT_PIXEL = false`). Sin JavaScript no se puede pedir consentimiento, así que esa imagen dispararía el píxel sin permiso, contrario a la guía de la AEPD.

**Otros píxeles (TikTok, Google):** hay un hueco comentado en `src/layouts/Base.astro`. Se cargan dentro de `applyConsent()` en `src/scripts/consent.ts`, con la misma condición que el de Meta, y hay que añadir su dominio a la CSP de `astro.config.mjs`.

### Parámetros de URL para los anuncios

Pega esto en **Parámetros de URL** de cada anuncio en Meta Ads:

```
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&utm_id={{campaign.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
```

Con eso el Sheet sabe de qué campaña, conjunto y anuncio viene cada lead. El formulario solo envía `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` y `utm_term`; el resto de parámetros de la plantilla se ignoran.

### API de Conversiones (para más adelante)

No está implementada. La hoja ya no guarda `fbp`, `fbc`, `event_id` ni el user agent, que la API de Conversiones necesita para casar el evento con el clic del anuncio. Si se activa más adelante hay que volver a enviarlos desde el formulario (solo con consentimiento de marketing) y mandar el evento `Lead` desde el Apps Script con `UrlFetchApp.fetch`, usando el mismo `event_id` que el `Lead` del navegador para deduplicar.

## Google Sheets + Apps Script

El código completo está en `apps-script/Code.gs` (sin comentarios, listo para pegar; esta sección lo explica).

### Instalación

1. Crea un Google Sheet nuevo (con la cuenta que vaya a recibir los leads). Ve a **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs`, pega todo `apps-script/Code.gs` y guarda.
3. En el desplegable de funciones elige **`setup`** y pulsa **Ejecutar**. Autoriza los permisos (Google avisará de que la app no está verificada: **Configuración avanzada → Ir a ... (no seguro)**, es tu propio script). Se crea la hoja **Leads**. Si ya tenías la versión anterior del script, `setup` borra el contenido de esa hoja (era solo de pruebas) y quita la hoja **Resumen**.
4. **Implementar → Nueva implementación**. Tipo: **Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**. Pulsa **Implementar** y copia la URL que termina en `/exec`.
5. Pega esa URL en `SITE.formEndpoint` (`src/config/site.ts`), haz commit y despliega.
6. Prueba: abre la URL `/exec` en el navegador; debe responder `{"ok":true,"status":"alive"}`. Después envía el formulario desde la web y comprueba que aparece la fila en **Leads**.
7. Si cambias el código más adelante: **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar**. Así la URL no cambia.

Cada lead nuevo manda un aviso por email a la dirección de `NOTIFY_EMAIL` (al principio del script, ahora aaswebmarketing@gmail.com) con nombre, teléfono, edad, experiencia, anuncio, campaña y enlace directo a WhatsApp. Para cambiarla, edítala y vuelve a implementar como en el paso 7; vacía, no se envía nada.

### Qué hace

- **Leads:** una fila por lead (la más reciente abajo) con 10 columnas: fecha y hora juntas (Europe/Madrid), nombre, teléfono en texto (E.164), edad, experiencia y los cinco `utm` (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content` con el anuncio y `utm_term` con el conjunto). Nada más: ni IDs, ni referrer, ni dispositivo, ni tiempos.
- Valida los datos, neutraliza fórmulas inyectadas, usa `LockService`, no duplica el mismo teléfono en 10 minutos y descarta en silencio el campo trampa (honeypot) de los bots.
- Manda un email por cada lead nuevo (no por duplicados ni bots).

## Calidad

- Lighthouse en la home: móvil **99 / 100 / 100 / 100** (FCP 1,1 s, LCP 2,0 s, CLS 0), escritorio **100 / 100 / 100 / 100** (LCP 0,4 s). Detalle completo, anchos probados y limitaciones en `source/qa/INFORME-QA.md`; capturas en `source/qa/capturas/`.
- Scripts de QA reutilizables en `source/qa/scripts/` (necesitan `npm i -D playwright @axe-core/playwright` y un build servido en local).

## Material de partida

- `source/reference/`: análisis de las tres landings de referencia.
- `source/instagram/README.md`: por qué no se pudo usar el Instagram (bloqueo de acceso) y qué se usó en su lugar.
- `source/brand/`: logo original de The Monkeys y origen de las fotos propias del centro.
- `source/stock/CREDITS.md`: ya no se usa stock (nota histórica).

## Aviso sobre los textos legales

Este texto es un modelo orientativo y debe revisarlo un profesional. Los textos de aviso legal, privacidad y cookies se han redactado con los datos facilitados y la normativa vigente (LSSI‑CE, RGPD, LOPDGDD y guía de cookies de la AEPD), pero no sustituyen el asesoramiento jurídico.

## Pendientes

Ver [`PENDIENTES.md`](./PENDIENTES.md).
