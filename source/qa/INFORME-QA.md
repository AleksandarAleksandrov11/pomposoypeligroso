# Informe de QA · 15/10/2026 (rediseño)

Todo se ha probado sobre el build de producción (`npm run build` + servidor estático con URLs limpias). Para ver los botones de WhatsApp y el teléfono se ha usado además un build de QA con valores de prueba (píxel `123456789012345`, WhatsApp `34600000000`, endpoint simulado). Las capturas están en `capturas/` con el ancho en el nombre.

## Lighthouse (12.8, Chromium headless, 4G simulado en móvil)

| Página | Dispositivo | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | TBT | Peso |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Móvil | 99 | 100 | 100 | 100 | 2,0 s | 0,003 | 10 a 40 ms | 133 KB |
| `/` | Escritorio | 100 | 100 | 100 | 100 | 0,4 s | 0,001 | 0 ms | 128 KB |
| `/gracias` | Móvil | 100 | 100 | 100 | 66 * | 1,4 s | 0 | 0 ms | 77 KB |
| `/gracias` | Escritorio | 100 | 100 | 100 | 66 * | 0,3 s | 0 | 0 ms | 77 KB |
| `/privacidad` | Móvil | 100 | 100 | 100 | 66 * | 1,4 s | 0 | 0 ms | 79 KB |
| `/privacidad` | Escritorio | 100 | 100 | 100 | 66 * | 0,3 s | 0 | 0 ms | 79 KB |

\* SEO 66 solo por el `noindex`, que el brief pide para gracias y legales. Es intencionado.

El hero ahora es una foto a pantalla completa (antes era una foto pequeña al lado del texto), por eso el LCP en móvil pasa de 1,6 s a 2,0 s. Con el servidor de desarrollo encendido en la misma máquina una pasada dio 84 por ruido de CPU; con la máquina libre, tres pasadas seguidas dieron 99.

Presupuestos: JS propio 7,2 KB comprimido (máx. 25 KB). CSS 9,8 KB comprimido, inline (máx. 30 KB). Home en primera carga 128 a 133 KB (máx. 500 KB). Hero móvil AVIF 13 a 41 KB (máx. 90 KB), hero escritorio 12 a 36 KB (máx. 160 KB), resto de imágenes por debajo de 80 KB y con carga diferida.

## Anchos revisados (captura por captura)

320×568 · 360×740 · 375×812 · 375×667 · 390×844 · 393×852 · 412×915 · 414×896 · 430×932 · 480×854 · 600×960 · 768×1024 · 820×1180 · 834×1194 · 1024×768 · 1180×820 · 1280×800 · 1366×768 · 1440×900 · 1536×864 · 1920×1080 · 2560×1440 · horizontal 667×375 y 844×390.

En cada uno se comprueba de forma automática y luego a ojo:

- Sin scroll horizontal.
- Ningún texto cortado ni fuera de pantalla.
- El banner de cookies no tapa el CTA del hero (en móvil y tablet va arriba, bajo el header; en escritorio abajo, con el hueco reservado en el hero).
- El CTA del hero se ve en la primera pantalla en todos los móviles verticales, incluido 375×667 y 320×568.
- Barra fija móvil: aparece al pasar el hero, desaparece sobre el formulario y con el teclado abierto, no tapa el final del footer.
- El ancla al formulario deja el título justo bajo el header.
- Todas las imágenes cargan.

Resultado: 24/24 sin problemas. Correcciones hechas durante el QA del rediseño: el banner de cookies tapaba el CTA del hero en tablet y portátiles de 768 px de alto (ahora va arriba en tablet y el hero le reserva el hueco en escritorio, y el titular se reduce en pantallas bajas), las tildes de Anton chocaban con la línea de arriba en titulares de dos líneas (interlineado 1,12), el fondo de "Así funciona" casi no se veía (velo más ligero), el botón "Configurar" del banner rozaba el borde a 320 px y la línea manuscrita no se centraba en gracias y 404.

## Pruebas funcionales (todas PASS)

Formulario y píxel (`scripts/qa-pixel-form.mjs`, 60 comprobaciones):

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

Movimiento: con "reducir movimiento" activado las filas de fotos y testimonios se quedan quietas y se deslizan con el dedo, los mensajes del chat y los checks de la comparativa aparecen sin animación y el botón de pausa desaparece. Sin JavaScript todo el contenido se ve (las animaciones solo se activan si la sección entra en pantalla con JS).

Apps Script (`npm run test:apps-script`): 17/17 pruebas en Node con los servicios de Google simulados (validación, saneado, duplicados, honeypot, sospechosos, email, fórmulas del Resumen y `setup()` idempotente).

## Lo que no se ha podido probar aquí

- **Safari (WebKit) y Firefox reales:** el entorno solo tiene Chromium y no permite instalar otros motores. El código no usa nada exclusivo de Chromium (CSS y JS estándar, `<dialog>`, `:has()` y unidades de contenedor `cqi` con soporte en Safari 16+ y Firefox 121+), pero conviene abrirla una vez en un iPhone real y en Firefox antes de lanzar anuncios.
- **Navegador interno real de Instagram/Facebook:** emulado por user agent y tamaño; probar con un enlace real desde una historia o un anuncio en borrador.
- **`vercel build`:** necesita una cuenta de Vercel enlazada. Se ha comprobado el build estático con un servidor de URLs limpias; las cabeceras y redirecciones de `vercel.json` se verán al desplegar.
- **Google Sheets real:** el Apps Script está probado con simulaciones; la primera ejecución de `setup()` en la hoja real es la prueba definitiva.
