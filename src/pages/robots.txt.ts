import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('http://localhost:4321');
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', base).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
