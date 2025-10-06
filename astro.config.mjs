// astro.config.mjs
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://transfert-aeroport-grenoble.fr',
  // Autres intégrations (React, etc.)
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en', 'es'],
    routing: {
      prefixDefaultLocale: false, // Ne pas mettre /fr/ dans l'URL pour le français
    },
  },

  adapter: vercel(),
  integrations: [sitemap()],
});