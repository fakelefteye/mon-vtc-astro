// astro.config.mjs
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';

import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';


export default defineConfig({
  site: 'https://transfert-aeroport-grenoble.fr',
  // Autres intégrations (React, etc.)
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en', 'es'],
    routing: {
      prefixDefaultLocale: false, // Ne pas mettre /fr/ dans l'URL pour le français
    },
    fallback: {
      // Si une page est demandée en 'en' mais n'existe pas, utiliser la version 'fr'
      en: 'fr', 
      // Si une page est demandée en 'es' mais n'existe pas, utiliser la version 'fr'
      es: 'fr', 
    },
  },

  adapter: vercel(),
  integrations: [
    sitemap(),
    react(), // <-- Ajouté par la commande
    // ... vos autres intégrations Vercel ...
  ],
})