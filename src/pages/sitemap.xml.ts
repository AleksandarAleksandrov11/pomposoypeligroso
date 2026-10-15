import type { APIRoute } from 'astro';

// Solo la home: el resto de páginas son legales o de gracias (noindex).
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('http://localhost:4321');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${new URL('/', base).href}</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
