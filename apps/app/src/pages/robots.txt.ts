import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/site';

export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString() ?? SITE_URL;
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${new URL('/sitemap.xml', origin).toString()}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
