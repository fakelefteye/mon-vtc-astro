import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
// import sitemap from '@astrojs/sitemap'; // Commentez cette ligne
import vercel from '@astrojs/vercel'; // Si vous l'avez

export default defineConfig({
  site: 'https://transfert-aeroport-grenoble.fr', // Conservez votre site URL
  adapter: vercel(), // Conservez votre adaptateur
  integrations: [
    react(),
    // sitemap(), // Commentez cette ligne
  ],
});
