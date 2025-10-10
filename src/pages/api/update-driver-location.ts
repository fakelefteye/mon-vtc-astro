// src/pages/api/update-driver-location.ts
import type { APIRoute } from 'astro';
import { put, list } from '@vercel/blob';

// Le nom du fichier qui stockera la position sur le Blob Store
const LOCATION_FILENAME = 'driver-location.json';

// Lit la dernière position connue
export const GET: APIRoute = async () => {
    try {
        // On cherche le fichier 'driver-location.json' dans le Blob Store
        const { blobs } = await list({ prefix: LOCATION_FILENAME, limit: 1 });

        if (blobs.length === 0) {
            // Si le fichier n'existe pas encore, on renvoie une position nulle
            return new Response(JSON.stringify({ lat: null, lng: null, timestamp: null }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Si le fichier existe, on récupère son contenu via son URL publique
        const blob = blobs[0];
        const response = await fetch(blob.url);
        const driverLocation = await response.json();

        return new Response(JSON.stringify(driverLocation), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Erreur lors de la lecture depuis Vercel Blob:", error);
        return new Response(JSON.stringify({ error: "Impossible de récupérer la position du chauffeur" }), { status: 500 });
    }
};

// Met à jour la position
export const POST: APIRoute = async ({ request }) => {
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

        // On envoie le nouveau fichier JSON vers Vercel Blob
        const blob = await put(LOCATION_FILENAME, JSON.stringify(newLocation), {
            access: 'public', // Le fichier doit être public pour que la fonction GET puisse le lire
            contentType: 'application/json',
        });

        return new Response(JSON.stringify({ message: "Position du chauffeur mise à jour", url: blob.url }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Erreur lors de l'écriture sur Vercel Blob:", error);
        return new Response(JSON.stringify({ error: "Impossible de mettre à jour la position" }), { status: 500 });
    }
};