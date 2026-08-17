// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Swap PUBLIC_SITE_URL when the custom domain is live.
const site = process.env.PUBLIC_SITE_URL ?? 'https://leamingtoncity.web.app';

// Public pages are SEO-critical, so this build is fully static: every business,
// offer and job page is rendered at build time with its JSON-LD and hreflang
// pair. Nothing here runs per request.
export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // Business logos come from Firebase Storage.
    domains: [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      // Seeded listing photography, see scripts/data/*.csv.
      'images.unsplash.com',
    ],
  },
});
