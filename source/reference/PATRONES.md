# Patrones extraídos de las landings de referencia

Analizadas el 14/10/2026 con Playwright (390 px y 1440 px): vdnperformance.com, vsl.rehabilitywod.com, vsl.vytalgroupem.com.

1. Header sticky mínimo: logo a la izquierda y un único CTA en píldora a la derecha. Sin menú.
2. Hero: etiqueta pequeña encima, H1 de 2 o 3 líneas con punto final y acento (color o cursiva) en la última frase, subtítulo de 1 o 2 líneas, CTA principal ancho en móvil y CTA secundario de texto subrayado.
3. Microdatos en texto plano (sin iconos pesados) justo debajo del hero o en una cinta que se desplaza.
4. Cada sección: H2 de 2 a 4 palabras con punto final y una palabra de acento. Mucho aire vertical.
5. Numeración tipográfica 01 / 02 / 03 en lugar de iconos.
6. Comparativa en dos tarjetas apiladas en móvil: "lo de siempre" en gris con cruces finas, la marca en su color con checks.
7. CTA centrado al final de casi cada bloque, siempre el mismo texto.
8. Formulario en tarjeta: "Paso 1 de 4" + barra segmentada, pregunta grande, opciones tocables grandes, una pregunta por pantalla.
9. FAQ con separadores finos y un "+" en círculo. Respuestas de 1 o 2 líneas.
10. Footer oscuro y completo: logo + frase, columnas (web, legal, contacto), copyright, "Volver arriba" y la marca gigante al final.
11. Móvil: barra fija abajo con CTA en píldora + botón redondo de WhatsApp. Banner de cookies compacto con Aceptar / Rechazar / Configurar con el mismo peso visual.

Lección a evitar: en Rehability y Vytal hay bloques que se quedan en blanco cuando el JS de "aparecer al hacer scroll" no se dispara (se ve en las capturas de página completa). En Pomposo el contenido es visible por defecto y la animación solo se activa si hay JS y no hay `prefers-reduced-motion`.
