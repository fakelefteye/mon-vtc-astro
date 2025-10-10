// src/pages/api/update-driver-location.ts
import type { APIRoute } from 'astro';
import { put, list } from '@vercel/blob';

const LOCATION_FILENAME = 'driver-location.json';

// L'endpoint est un objet qui contient des fonctions pour chaque méthode HTTP
export const endpoint: APIRoute = {
  // Fonction pour la méthode GET
  get: async () => {
    try {
        const { blobs } = await list({ prefix: LOCATION_FILENAME, limit: 1 });
        if (blobs.length === 0) {
            return new Response(JSON.stringify({ lat: null, lng: null, timestamp: null }), { status: 200 });
        }
        
        const blob = blobs[0];
        const response = await fetch(blob.url);
        const driverLocation = await response.json();

        return new Response(JSON.stringify(driverLocation), { status: 200 });
    } catch (error) {
        console.error("Erreur lors de la lecture depuis Vercel Blob:", error);
        return new Response(JSON.stringify({ error: "Impossible de récupérer la position" }), { status: 500 });
    }
  },

  // Fonction pour la méthode POST
  post: async ({ request }) => {
    const driverApiSecret = import.meta.env.DRIVER_API_SECRET;
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || authHeader !== `Bearer ${driverApiSecret}`) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
    }

    try {
        const { lat, lng } = await request.json();
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return new Response(JSON.stringify({ error: "Coordonnées invalides" }), { status: 400 });
        }

        const newLocation = { lat, lng, timestamp: Date.now() };

        const blob = await put(LOCATION_FILENAME, JSON.stringify(newLocation), {
            access: 'public',
            contentType: 'application/json',
        });

        return new Response(JSON.stringify({ message: "Position mise à jour", url: blob.url }), { status: 200 });
    } catch (error) {
        console.error("Erreur lors de l'écriture sur Vercel Blob:", error);
        return new Response(JSON.stringify({ error: "Impossible de mettre à jour la position" }), { status: 500 });
    }
  }
};