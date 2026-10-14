# Instagram @pomposoypeligrosotmc

Intentos de acceso (14/10/2026) desde el entorno de trabajo:

- `https://www.instagram.com/pomposoypeligrosotmc/` redirige a `/accounts/login/` (pide sesión) y no hay ninguna sesión de navegador disponible.
- API pública `web_profile_info` y `?__a=1`: 401 "Please wait a few minutes before you try again" (bloqueo por IP de centro de datos). Reintentado varias veces.
- Visores de terceros (dumpor, imginn, picuki, pixwox, imgsed, picnob): verificación anti‑bot de Cloudflare o 403.
- Bing Imágenes: sin resultados para el usuario.

Resultado: **no se ha podido extraer nada del Instagram** (ni avatar, ni fotos, ni destacados, ni testimonios, ni nombre de la entrenadora). Todo eso queda en `PENDIENTES.md`.

## Qué se ha usado en su lugar

- **Logo:** el mono oficial de The Monkeys Community (`https://themonkeyscommunity.com/cdn/shop/files/tmc-logo-4.png`), que es la empresa que hay detrás (TMC). Se ha recortado la cara del mono, vectorizado con potrace y colocado dentro de un círculo lila, que es como describe el brief el avatar de Pomposo. Archivo original en `source/brand/tmc-logo-4.png`.
- **Lila:** no se ha podido muestrear del avatar. Se usa el valor de partida del brief (`#B9A4F2`). Confirmar con el archivo original del logo.
- **Fotos reales:** fotos del propio centro publicadas en `themonkeyscommunity.com` (ver `source/brand/README.md`).
