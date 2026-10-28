# Informe de QA

## Optimización de leads · 28/10/2026

Cambios: API de conversiones (`api/lead-capi.js`), un solo `Lead` por solicitud con `event_id` estable, `FormStep` sin repeticiones y `FormError`, cero fugas antes de enviar, estado de gracias con WhatsApp automático en móvil, casilla de privacidad sustituida por un aviso, hero según el anuncio y atribución que no se pierde al recargar. El Apps Script y la hoja no se han tocado.

Resultados (todo en local sobre el build de producción, con el Apps Script, `/api/lead-capi`, Meta y WhatsApp interceptados):

- `npm test`: 20 pruebas unitarias (formulario, contrato del payload, API de conversiones), 21 del Apps Script y 9 de fugas sobre `dist/`. Todas en verde.
- `npm run test:e2e` (Playwright, 390x844 con el user agent de Instagram en iPhone y 1440x900): 47 pruebas en verde. Cubren el payload idéntico a la referencia aceptando y rechazando cookies, los UTM tras recargar, 1 `Lead` con el mismo `event_id` que la API de conversiones, 0 eventos de navegador sin consentimiento pero sí API de conversiones, `FormStep` sin repetir, `FormError`, reintentos sin `Lead` doble, errores del servidor sin reintento, WhatsApp automático en móvil antes de 2 s y al menos 800 ms después del `Lead`, sin redirección en escritorio, el mensaje de las FAQ, el estado de gracias al volver, las tres versiones del hero con CLS 0 y el botón en la primera pantalla con el aviso de cookies, la barra móvil de un botón, las legales en pestaña nueva sin perder el formulario y el aviso de cookies.
- `vercel build` local: las páginas siguen siendo estáticas y `api/lead-capi` sale como función (Node 24). Sin `META_CAPI_TOKEN` responde 204 sin llamar a Meta.
- Lighthouse en la home, mismo servidor para la versión anterior y la nueva: móvil 99-100 / 100 / 100 / 100 (antes 99 / 100 / 100 / 92, CLS 0,003), escritorio 100 / 100 / 100 / 100 (antes 100 / 100 / 100 / 92, CLS 0,007). El SEO sube a 100 por el texto del enlace del aviso ("Política de cookies") y el CLS baja a 0 al fijar el alto del aviso.
- Revisión en producción: el CLS de escritorio era 0,008 a 0,014 por el cambio de fuente del titular (las fuentes llegan después del primer pintado con la red real). Corregido: el titular y el subtítulo del hero esperan a sus fuentes (máximo 1,2 s; el botón se ve siempre) y el de cierre va en dos líneas fijas. Con las fuentes retrasadas 400 a 900 ms el CLS queda en 0 en 390 y 1440 px.
- Accesibilidad (axe, `scripts/qa-links.mjs`): sin violaciones en las 5 páginas. Anchos (`scripts/qa-widths.mjs`): 24/24 sin scroll lateral ni textos cortados. iPhone emulado (`scripts/qa-iphone.mjs`): LCP 0,9 a 1 s, CTA visible y aviso sin tapar el CTA en los cuatro modelos.
- Capturas en `capturas/e2e-390-*.png` y `capturas/e2e-1440-*.png`: primer pantallazo (versión descubrir y cierre), aviso de cookies, cada paso, y estado de gracias.

Revisión en producción (https://www.pomposoypeligroso.com, 28/10/2026, tras el despliegue):

- Las 47 pruebas de Playwright pasan contra producción (`E2E_BASE_URL=https://www.pomposoypeligroso.com npm run test:e2e`), con todo lo externo interceptado.
- Lighthouse en producción: móvil 99 / 100 / 100 / 100 (LCP 1,6 s, CLS 0), escritorio 100 / 100 / 100 / 100 (LCP 0,4 s, CLS 0).
- Los 14 CTA en móvil (13 en escritorio, sin barra fija) llevan al formulario en las tres versiones del hero. Prefijo "Otro", errores de nombre y teléfono y recuperación del progreso al recargar, correctos.
- Dominio: el canonical, `og:url`, `sitemap.xml` y `robots.txt` apuntan a https://www.pomposoypeligroso.com; `pomposoypeligroso.com` y `http://` redirigen (308) al de `www`. `/api/lead-capi` responde 405 a GET, 403 desde otro origen y 400 a datos no válidos.
- Un único envío real (nombre `PRUEBA`, +34 600 000 000, iPhone con Instagram emulado, aceptando cookies) el 28/10/2026 a las 14:29 (Madrid): Apps Script `ok: true`; píxel con `FormStart`, `FormStep` 1 a 4 una vez cada uno (aunque se fue atrás), `FormError` de nombre y teléfono, un `Lead` con coincidencia avanzada (`ph`, `fn`, `country`) y el mismo `event_id` que la llamada a `/api/lead-capi` (204), y `Contact` `gracias-auto`; WhatsApp se abrió solo con el resumen y, al volver atrás, se vio el estado de gracias sin reenviar nada. Sin errores de consola.

Los scripts `qa-pixel-form.mjs` y `qa-env.mjs` se han retirado: comprobaban el flujo anterior (casilla, `/gracias`, botones de WhatsApp) y ahora lo cubren las pruebas de `tests/e2e/`.

## Informe anterior · 22/10/2026 (material real)

Todo se ha probado sobre el build de producción (`npm run build` + servidor estático con URLs limpias). Para ver los botones de WhatsApp y el teléfono se ha usado además un build de QA con valores de prueba (píxel `123456789012345`, WhatsApp `34600000000`, endpoint simulado). Las capturas de `capturas/` son del build de producción real (sin WhatsApp configurado) y llevan el ancho en el nombre.

## Lighthouse (12.8, Chromium headless, 4G simulado en móvil)

| Página | Dispositivo | Rendimiento | Accesibilidad | Buenas prácticas | SEO | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Móvil | 97 a 99 | 100 | 100 | 100 | 1,1 a 1,2 s | 1,9 s | 0 | 0 a 170 ms |
| `/` | Escritorio | 100 | 100 | 100 | 100 | 0,3 s | 0,6 s | 0,001 | 0 ms |
| `/gracias` | Móvil | 100 | 100 | 100 | 66 * | | 1,4 s | 0 | 0 ms |
| `/gracias` | Escritorio | 100 | 100 | 100 | 66 * | | 0,3 s | 0 | 0 ms |
| `/privacidad` | Móvil | 100 | 100 | 100 | 66 * | | 1,4 s | 0 | 0 ms |
| `/privacidad` | Escritorio | 100 | 100 | 100 | 66 * | | 0,3 s | 0 | 0 ms |

\* SEO 66 solo por el `noindex`, que el brief pide para gracias y legales. Es intencionado.

Optimización de carga:

- iPhone emulado (SE, 13 mini, 15 y 15 Pro Max; Safari y navegador de Instagram; 4G lento de 1,6 Mbps y 150 ms): foto del hero en 0,84 a 0,9 s, página cargada en 1,8 a 2 s, CTA visible sin scroll en todos, sin scroll lateral y sin errores. La página mide de 14 a 19 pantallas y el formulario empieza en la pantalla 3,6 a 4,8 (antes, en la 12).

- Prueba en iPhone emulado (navegador de Instagram, 4G lento de 1,6 Mbps y 150 ms): primer contenido a 0,45 s, foto del hero a 1,2 s, página cargada a 2 s con 305 KB y 16 peticiones.

- Ya no hay ninguna foto de stock: todas son de alumnas y del equipo. La foto del hero en móvil es un fotograma de vídeo 4K; se le ha quitado ruido para que pese 37 a 62 KB (LCP de 2,5 s a 2,2 s).
- Vídeos ("Así entrenan ellas"): 6 clips de 6 s sin audio, MP4 H.264 (250 a 330 KB) y WebM VP9 de alternativa. Cero descargas al cargar la página: se piden cuando la sección está a 600 px y solo se reproducen mientras se ven (comprobado: 0 peticiones al cargar, 6 al llegar, los 6 reproduciéndose). Con "reducir movimiento" no se reproducen solos, llevan controles y no se descargan hasta darle al play.

- Fotos solo en WebP (lo leen todos los navegadores actuales y se decodifica más rápido que AVIF), con varios tamaños por foto y calidad ajustada a cada uso: 60 en el hero y 45 a 52 en los fondos (van bajo un velo oscuro), 66 en el resto. El fondo de "Así funciona" se ha desenfocado un poco: pasa de 153 KB a 53 KB.
- La foto del hero y las cuatro fuentes se precargan. HTML y CSS van en una sola petición (25 KB comprimido). JS propio 7,4 KB comprimido.
- El resto de fotos tienen carga diferida y, en cuanto la página termina de cargar y el navegador está libre, se descargan en segundo plano: a los 5 segundos están todas (comprobado), así que al hacer scroll aparecen al instante. Con "ahorro de datos" o 2G no se hace y solo se carga lo que se ve.
- En móvil la pintura real del hero ocurre a los 94 ms; los 2,0 s de LCP son la estimación de Lighthouse con 4G lento simulado (suma de los bytes de fuentes y foto del hero). Bajar más la calidad del hero no movía esa cifra, así que se ha dejado la calidad que se ve bien.
- Peso en la primera carga (antes de la descarga en segundo plano): unos 140 KB en móvil. Con todas las fotos ya descargadas: 674 KB en móvil y 469 KB en escritorio.

## Anchos revisados (captura por captura)

320×568 · 360×740 · 375×812 · 375×667 · 390×844 · 393×852 · 412×915 · 414×896 · 430×932 · 480×854 · 600×960 · 768×1024 · 820×1180 · 834×1194 · 1024×768 · 1180×820 · 1280×800 · 1366×768 · 1440×900 · 1536×864 · 1920×1080 · 2560×1440 · horizontal 667×375 y 844×390.

En cada uno se comprueba de forma automática y luego a ojo:

- Sin scroll horizontal.
- Ningún texto cortado ni fuera de pantalla.
- El aviso de cookies no tapa nada (23/10/2026): va arriba, bajo el header, con su hueco reservado. Comprobado en 14 tamaños (320x568 a 1920x1080 y móvil en horizontal): titular, CTA, miniaturas de resultados, barra fija, botón de WhatsApp, formulario tras pulsar un CTA e inicio de las páginas legales quedan libres; al rechazar a mitad de página no hay salto. En móvil en horizontal el CTA queda por debajo de la primera pantalla también sin aviso (el hero no cabe en 375 px de alto).
- El CTA del hero se ve en la primera pantalla en todos los móviles verticales, incluido 375×667 y 320×568.
- Barra fija móvil: aparece al pasar el hero, desaparece sobre el formulario y con el teclado abierto, no tapa el final del footer.
- El ancla al formulario deja el título justo bajo el header.
- Todas las imágenes cargan.

Resultado: 24/24 sin problemas. Correcciones hechas durante el QA del rediseño: el banner de cookies tapaba el CTA del hero en tablet y portátiles de 768 px de alto (ahora va arriba en tablet y el hero le reserva el hueco en escritorio, y el titular se reduce en pantallas bajas), las tildes de Anton chocaban con la línea de arriba en titulares de dos líneas (interlineado 1,12), el fondo de "Así funciona" casi no se veía (foto cambiada por una del centro, más luminosa, con su velo), el botón "Configurar" del banner rozaba el borde a 320 px y la línea manuscrita no se centraba en gracias y 404.

## Pruebas funcionales (todas PASS)

Formulario y píxel (`scripts/qa-pixel-form.mjs`, 61 comprobaciones; la tarjeta del formulario cambia de alto con cada pregunta, de 303 px en el nombre a 535 px en experiencia, a 390 px de ancho):

- Sin aceptar cookies: cero peticiones a Meta, el lead se envía con `consent_marketing = no` y los UTMs de la sesión.
- Aceptando: carga de `fbevents.js` solo tras aceptar; secuencia `consent grant → init → PageView → ViewContent → FormStart → FormStep ×4 → Lead` y `Contact` al pulsar WhatsApp.
- `Lead` exactamente una vez y con `eventID` igual al `event_id` del payload.
- Payload con los 35 campos de la sección 9.3, `device = móvil` con user agent de iPhone; UTMs (`?utm_source=fb&utm_campaign=test&utm_content=anuncio1&fbclid=abc`) conservados tras ir a `/privacidad` y volver; `fbc` construido desde `fbclid`; teléfono en E.164.
- Respuesta `ok:false`: 1 reintento, lead guardado en `localStorage`, caja de error con WhatsApp prerrellenado con el nombre, sin `Lead`. En la siguiente visita se reenvía solo.
- Servidor que tarda 15 s: aborta a los 12 s, reintenta y muestra la alternativa (~24 s en total).
- Recarga a mitad: recupera paso, nombre y edad.
- Validación de teléfono: 612345678, 712 345 678, +34 612 345 678 y 0034612345678 válidos; 512345678 y 61234567 inválidos; +351 con 9 dígitos válido.
- Píxel real de Meta (ID falso) con la CSP activa: sin violaciones de CSP; revocar el consentimiento borra `_fbp`.

Entornos (`scripts/qa-env.mjs`, 34 comprobaciones):

- Navegador interno de Instagram (iOS) y de Facebook (Android) por user agent: `<dialog>` abre y cierra, barra fija pegada abajo, enlace `wa.me` correcto en pestaña nueva, el campo de teléfono queda visible con el teclado, se detecta `in_app_browser` y `device = móvil`, envío y redirección a `/gracias`, sin errores de consola.
- Modo oscuro del sistema: la web se mantiene en claro (`color-scheme: light`).
- Zoom 200 % (720 px CSS): sin scroll horizontal y navegación correcta.
- Sin JavaScript: todo el contenido visible, el formulario se sustituye por el mensaje con email y WhatsApp, no aparece el banner.
- Teclado: el primer Tab es "Saltar al formulario", foco visible en todos los elementos, en el formulario las flechas solo seleccionan y Intro confirma, el foco pasa al título de cada paso.

Enlaces, HTML y accesibilidad (`scripts/qa-links.mjs`):

- Todos los enlaces internos dan 200 y todas las anclas existen; formatos de `mailto:`, `tel:` y `wa.me` correctos.
- Enlaces externos: AEPD y ayudas de Chrome, Safari, Firefox y Edge dan 200. Instagram devuelve 429 desde el servidor de pruebas (bloqueo por IP); el enlace es correcto.
- axe-core (WCAG 2.2 AA + buenas prácticas) sin violaciones en todas las páginas, en el modal de cookies y en el paso 4 con errores.
- Texto visible sin "—", "–", "Lorem", "TODO", "undefined", "null", "NaN" ni "PENDIENTE" (se comprueba el texto tal como está escrito: los titulares van en mayúsculas por CSS y "Lo has probado todo" daba un falso "TODO").
- Probado también con la build real sin WhatsApp configurado: mismos resultados y los botones verdes llevan al formulario.
- `npm run validate:html` (html-validate) sin errores. Reglas desactivadas a propósito: `no-redundant-role` y `prefer-native-element` para `role="list"` (se mantiene porque Safari/VoiceOver quita la semántica de lista con `list-style: none`) y `valid-autocomplete` (el brief pide `autocomplete="tel-national"` en un `type="tel"`; los navegadores lo admiten aunque una lectura estricta de la especificación solo permite `tel` en ese tipo de campo).
- Consola: cero errores y cero avisos en todas las páginas.

`npx astro check`: 0 errores, 0 avisos.

Movimiento: con "reducir movimiento" activado las filas de fotos y testimonios se quedan quietas y se deslizan con el dedo, y los mensajes del chat y los checks de la comparativa aparecen sin animación. A petición de la marca no hay botón de pausa: las filas se paran al pasar el ratón o el foco y con "reducir movimiento" (WCAG 2.2.2 pide además un control de pausa visible; si se quiere cumplir al pie de la letra, habría que recuperarlo). Sin JavaScript todo el contenido se ve (las animaciones solo se activan si la sección entra en pantalla con JS).

Material real: comprobado que las alumnas marcadas "no mostrar cara" solo salen de espaldas, que los antes/después tienen el orden correcto (fechas de la app y gráficas de peso) y que no queda ninguna imagen de Pexels ni de internet en `src/assets/img`.

Apps Script (`npm run test:apps-script`): 21/21 pruebas en Node con los servicios de Google simulados (validación, saneado, duplicados, honeypot, email, hoja de 11 columnas con Estado, fórmulas del Contador y `setup()` con hoja nueva, con la versión anterior y con la original).

## Lo que no se ha podido probar aquí

- **Safari (WebKit) y Firefox reales:** el entorno solo tiene Chromium y no permite instalar otros motores. El código no usa nada exclusivo de Chromium (CSS y JS estándar, `<dialog>`, `:has()` y unidades de contenedor `cqi` con soporte en Safari 16+ y Firefox 121+), pero conviene abrirla una vez en un iPhone real y en Firefox antes de lanzar anuncios.
- **Navegador interno real de Instagram/Facebook:** emulado por user agent y tamaño; probar con un enlace real desde una historia o un anuncio en borrador.
- **`vercel build`:** necesita una cuenta de Vercel enlazada. Se ha comprobado el build estático con un servidor de URLs limpias; las cabeceras y redirecciones de `vercel.json` se verán al desplegar.
- **Google Sheets real:** el Apps Script está probado con simulaciones; la primera ejecución de `setup()` en la hoja real es la prueba definitiva.
