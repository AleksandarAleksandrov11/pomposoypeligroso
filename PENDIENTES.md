# Pendientes

Todo lo que falta por confirmar o facilitar. La web funciona igual mientras tanto (ver README).

## Lo hace Aleks fuera del código

- [ ] **Token de la API de conversiones**: poner `META_CAPI_TOKEN` en Vercel (Settings, Environment Variables, Production) y volver a desplegar. Se genera en el Administrador de eventos de Meta: píxel 1162548892864094, Configuración, API de conversiones, Generar token de acceso. Opcional mientras se prueba: `META_TEST_EVENT_CODE` (y quitarlo después). Sin token la web funciona igual, solo que sin API de conversiones. Nunca en el repo ni en el chat.
- [ ] **Texto legal**: revisar la frase de la base legal del envío a Meta por la API de conversiones en `src/pages/privacidad.astro` (marcada con `TODO (legal)`).
- [ ] **Borrar la fila `PRUEBA`** de la hoja (envío de la revisión final en producción).
- [ ] Si la campaña de cierre no lleva en su nombre "CIERRE", "RETARGETING", "REMARKETING", "MOFU" o "BOFU", añadir la palabra en `src/data/ad-variants.ts` para que vea el hero de cierre.

## Configuración (`src/config/site.ts`)

- [x] **ID del Meta Pixel**: 1162548892864094 (`metaPixelId`). Se carga solo tras aceptar cookies de marketing.
- [x] **WhatsApp y teléfono**: +34 644 11 77 40 (`site.ts`), confirmado. WhatsApp se abre al enviar el formulario con un mensaje que resume la solicitud; antes de enviar no hay enlaces de WhatsApp.
- [x] **Dominio definitivo**: https://www.pomposoypeligroso.com (`url` en `site.ts`; el dominio sin www redirige al www).
- [x] **URL del Web App de Apps Script**: conectada en `formEndpoint` (`site.ts`). Si vuelves a implementar con una URL nueva, cámbiala ahí.
- [x] **Email para avisos de leads**: aaswebmarketing@gmail.com (`NOTIFY_EMAIL` en `apps-script/Code.gs`).
- [ ] **Datos registrales de la S.L.** (Registro Mercantil de Barcelona, tomo, folio, hoja e inscripción) → `legal.registry`. Los exige el art. 10 de la LSSI; están en la escritura o en una nota simple del Registro. Ahora pone "Sociedad inscrita en el Registro Mercantil de Barcelona.".

## Autorizaciones y contenido real

Las fotos, vídeos y testimonios de alumnas y del equipo ya son reales (material del Drive de la marca). Queda:

- [ ] **Confirmar que todas las alumnas que aparecen han dado su permiso** (el aviso legal ya dice que se publican con su autorización, así que tiene que ser cierto) para salir en una web pública con anuncios: Noelia, Ariadna, Cris S., Claudia, Anna P., Anna S., Ainhoa, Gloria, Marina, Lucía, Cris G., Alba, Judith, Montse (fotos), Liliam, Andrea, Alexandra (vídeos) y Coralie, Carlota, Lorena, Alice (solo testimonio). Si alguna no quiere salir, se quita su entrada de `src/data/transformations.ts` o `src/data/testimonials.ts`.
- [ ] Revisar que los **nombres** son como cada alumna quiere aparecer (ahora: nombre de pila, con inicial cuando se repite).
- [ ] **Descripción de Fede**: no venía en el Drive. Ahora su ficha dice "Coach del equipo de Pomposo y Peligroso" (`src/components/Coach.astro`).
- [ ] Fotos de Fede `IMG_1159`, `IMG_1679`, vídeo `IMG_0793` y una captura de Cris Serrasolsas no se pudieron descargar (límite de Google Drive). No son necesarias, pero si las queréis en la web, pasádmelas por otro medio.
- [ ] Confirmar si se puede decir que **Noelia es influencer** y mencionar su cuenta. Ahora no se menciona.
- [ ] El chat de "No te falta motivación" es una ilustración de cómo es el seguimiento, no una conversación real.

## Marca

- [ ] **Logo oficial vectorial** y **lila exacto** del avatar. No se pudo descargar el avatar de Instagram: el mono se ha vectorizado a partir del logo de The Monkeys (`tmc-logo-4.png`) y se ha puesto en un círculo `#B9A4F2` (valor de partida del brief). Si el original es distinto, sustituir `public/logo-mark.svg`, el símbolo de `src/components/MonoSprite.astro`, los favicons y el color `--lilac` de `src/styles/tokens.css`.

## Textos por confirmar

- [ ] **Precio**: ¿se muestra en la web o solo en la videollamada? Ahora: "Depende de tu caso. Te lo explicamos en la videollamada, sin compromiso." (`src/data/faq.ts`).
- [x] **Plazo de respuesta** tras el formulario: "en menos de 24 horas laborables", confirmado por Aleks (`src/data/faq.ts`, estado de gracias y `/gracias`).
- [ ] **Qué pasa al acabar las 12 semanas** (renovación, mantenimiento). Ahora: "Puedes seguir con nosotras o continuar por tu cuenta con todo lo que has aprendido."
- [x] **Plazas limitadas**: confirmado por Aleks (cierre, formulario y hero de la campaña de cierre).
- [ ] **Plazo de conservación de datos**: ahora "hasta que retires el consentimiento y, como máximo, 12 meses desde tu solicitud si no te unes al programa" (`src/pages/privacidad.astro`).
- [ ] Revisión de los textos legales por un profesional.

## Supuestos que he hecho

- "+30 alumnas" se usa como dato real porque el brief dice "aproximadamente 30 alumnas".
- El centro se ubica en Gavà (domicilio fiscal, Miquel Servet 14). La web de The Monkeys habla de "la zona de Castelldefels"; el mismo local aparece en directorios como Gavà o Castelldefels.
- Las alumnas marcadas "no mostrar cara" solo aparecen de espaldas (en vez de difuminar la cara), o solo con su testimonio.
- Cuando no se indicaba cuál era el antes, se ha deducido por las fechas de la app de seguimiento y la gráfica de peso.
- Los datos de peso y medidas salen de sus gráficas y fichas de seguimiento del Drive.
- Se ha quitado la sección "Es para ti si..." y los enlaces del header, como se pidió en el rediseño.
- Sin precio visible y sin promesas de kilos en un plazo concreto (cuidado con la revisión de Meta).
- El honeypot relleno se descarta en el servidor sin escribir la fila ni avisar por email.
- El nombre se valida en el navegador con el mismo criterio que el Apps Script (al menos una letra latina, de A a Z con tildes y diéresis). Convendría ampliar ese criterio en el servidor más adelante para admitir nombres en otros alfabetos; hasta entonces el formulario pide escribirlo sin caracteres especiales.

## Pruebas que conviene hacer antes de lanzar anuncios

- [ ] Abrir la web en un iPhone real dentro de Instagram y comprobar que, al enviar, WhatsApp se abre solo (en este entorno solo hay Chromium con el user agent de Instagram).
- [ ] Con `META_CAPI_TOKEN` y `META_TEST_EVENT_CODE` puestos, comprobar en **Administrador de eventos → Probar eventos** que el `Lead` llega del navegador y del servidor con el mismo `event_id` y aparece deduplicado, y revisar la calidad de coincidencia.
