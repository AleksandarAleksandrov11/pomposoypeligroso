# Pendientes

Todo lo que falta por confirmar o facilitar. La web funciona igual mientras tanto (ver README).

## Configuración (`src/config/site.ts`)

- [ ] **ID del Meta Pixel** → `metaPixelId`.
- [ ] **Teléfono / WhatsApp de contacto** → `whatsappNumber`, `phoneDisplay`, `phoneHref`. En la web de The Monkeys aparece el WhatsApp **+34 644 117 740**: confirmar si es el mismo para Pomposo y Peligroso. Hasta entonces los botones de WhatsApp están ocultos.
- [ ] **Dominio definitivo** → `url` (y añadirlo en Vercel). Mientras tanto se usa la URL `*.vercel.app`.
- [ ] **URL del Web App de Apps Script** → `formEndpoint` (la pegas tú tras implementarlo, ver README).
- [ ] **Email para avisos de leads** → `NOTIFY_EMAIL` en `apps-script/Code.gs`.
- [ ] **Datos registrales de la S.L.** (Registro Mercantil de Barcelona, tomo, folio, hoja) → `legal.registry`. Ahora pone "Sociedad inscrita en el Registro Mercantil de Barcelona.".

## Autorizaciones y contenido real

- [ ] **Autorización escrita** para usar fotos y testimonios de Noelia, Ana Pino, Alexandra, Judith y Andrea. Con ellas: fotos en `src/assets/img/transformaciones/`, datos en `src/data/transformations.ts` y `showTransformations: true`.
- [ ] Confirmar si se puede decir que **Noelia es influencer** y mencionar su cuenta. Ahora no se menciona.
- [ ] **Testimonios reales**: no se han podido sacar del Instagram (bloqueado). La sección de testimonios no se muestra hasta que haya al menos 2 en `src/data/testimonials.ts`. Hacen falta: texto literal, nombre (como lo autorice cada alumna), una línea de contexto y de dónde sale.
- [ ] **Nombre y foto de la entrenadora o entrenadoras**. Ahora "Quién está detrás" habla del equipo de The Monkeys con una foto del centro.
- [ ] Confirmar que se pueden usar en la landing las **fotos del centro** sacadas de themonkeyscommunity.com (aparecen personas reales): ver `source/brand/README.md`.

## Marca

- [ ] **Logo oficial vectorial** y **lila exacto** del avatar. No se pudo descargar el avatar de Instagram: el mono se ha vectorizado a partir del logo de The Monkeys (`tmc-logo-4.png`) y se ha puesto en un círculo `#B9A4F2` (valor de partida del brief). Si el original es distinto, sustituir `public/logo-mark.svg`, el símbolo de `src/components/MonoSprite.astro`, los favicons y el color `--lilac` de `src/styles/tokens.css`.
- [ ] Fotos y vídeos propios de alumnas entrenando glúteo (si los hay) para sustituir las de banco de imágenes del hero, acompañamiento, pasos, formulario y cierre.

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
- Las fotos de entrenamiento del centro se muestran en "Resultados" (con el interruptor de transformaciones apagado), como pide el brief, sin decir que sean alumnas del programa.
- Sin precio visible y sin promesas de kilos en un plazo concreto (cuidado con la revisión de Meta).
- El honeypot relleno se descarta en el servidor sin escribir la fila (`DISCARD_HONEYPOT = true` en el Apps Script); los envíos de menos de 3 s se escriben marcados como sospechosos.

## Pruebas que conviene hacer antes de lanzar anuncios

- [ ] Abrir la web en un iPhone real (Safari y navegador interno de Instagram) y en Firefox: en este entorno solo había Chromium.
- [ ] Ejecutar `setup()` en el Sheet real, implementar y enviar un lead de prueba desde la web publicada.
- [ ] Con el ID del píxel puesto, comprobar los eventos en **Administrador de eventos → Probar eventos** de Meta.
