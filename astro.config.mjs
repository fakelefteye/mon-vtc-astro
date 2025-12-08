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
    locales: ['fr', 'en-gb', 'es'],
    routing: {
      prefixDefaultLocale: false, // Ne pas mettre /fr/ dans l'URL pour le français
    },
    fallback: {
      // CORRECTION : Supprimer l'ancienne référence 'en'
      'en-gb': 'fr', // Si une page en 'en-gb' est demandée mais n'existe pas, utiliser 'fr'
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