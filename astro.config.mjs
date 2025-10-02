// astro.config.mjs
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

export default defineConfig({
  // Autres intégrations (React, etc.)
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en', 'es'],
    routing: {
      prefixDefaultLocale: false, // Ne pas mettre /fr/ dans l'URL pour le français
    },
  },

  adapter: vercel(),
});