# Pendientes

Todo lo que falta por confirmar o facilitar. La web funciona igual mientras tanto (ver README).

## Configuración (`src/config/site.ts`)

- [x] **ID del Meta Pixel**: 1162548892864094 (`metaPixelId`). Se carga solo tras aceptar cookies de marketing.
- [x] **WhatsApp y teléfono**: +34 644 11 77 40 (`site.ts`). Los botones de WhatsApp ya abren el chat con un mensaje preparado.
- [ ] **Dominio definitivo** → `url` (y añadirlo en Vercel). Mientras tanto se usa la URL `*.vercel.app`.
- [ ] **URL del Web App de Apps Script** → `formEndpoint` (la pegas tú tras implementarlo, ver README).
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
- [ ] **Plazo de respuesta** tras el formulario. Ahora: "en menos de 24 horas laborables" (`src/data/faq.ts`).
- [ ] **Qué pasa al acabar las 12 semanas** (renovación, mantenimiento). Ahora: "Puedes seguir con nosotras o continuar por tu cuenta con todo lo que has aprendido."
- [ ] **Plazas limitadas**: confirmar. Ahora en el cierre: "Plazas limitadas para poder acompañar bien a cada alumna." (`src/components/Closing.astro`).
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
- El honeypot relleno se descarta en el servidor sin escribir la fila (`DISCARD_HONEYPOT = true` en el Apps Script); los envíos de menos de 3 s se escriben marcados como sospechosos.

## Pruebas que conviene hacer antes de lanzar anuncios

- [ ] Abrir la web en un iPhone real (Safari y navegador interno de Instagram) y en Firefox: en este entorno solo había Chromium.
- [ ] Ejecutar `setup()` en el Sheet real, implementar y enviar un lead de prueba desde la web publicada.
- [ ] Con el ID del píxel puesto, comprobar los eventos en **Administrador de eventos → Probar eventos** de Meta.
