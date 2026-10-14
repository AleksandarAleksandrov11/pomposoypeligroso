// @ts-check
import { defineConfig } from 'astro/config';
import { SITE } from './src/config/site.ts';

/**
 * URL pública para canonical, Open Graph y sitemap.
 * Mientras SITE.url sea PENDIENTE, en Vercel se usa automáticamente la URL de producción
 * del proyecto (*.vercel.app) y en local http://localhost:4321.
 */
function resolveSiteUrl() {
  if (!SITE.url.includes('PENDIENTE')) return SITE.url;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : 'http://localhost:4321';
}

export default defineConfig({
  site: resolveSiteUrl(),
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  compressHTML: true,
  devToolbar: { enabled: false },
  image: {
    responsiveStyles: false,
  },
  /**
   * Content-Security-Policy en una <meta> con hashes de los scripts y estilos inline.
   * Permite: el píxel de Meta (connect.facebook.net / www.facebook.com) y el envío del
   * formulario al Apps Script (script.google.com, que redirige a script.googleusercontent.com).
   * Si añades otro proveedor (TikTok, Google Ads...), añade aquí su dominio.
   */
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://www.facebook.com",
        "font-src 'self'",
        "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://www.facebook.com https://connect.facebook.net",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://connect.facebook.net'],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },
});
