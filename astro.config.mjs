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
});
