// src/pages/api/update-driver-location.ts
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

// Chemin où stocker la position du chauffeur
const DRIVER_LOCATION_FILE = path.resolve(process.cwd(), './driver-location.json');

// Assurez-vous que le fichier existe au démarrage du serveur
// (Ceci est une solution simple, pour une vraie app, utilisez une DB)
async function ensureDriverLocationFile() {
    try {
        await fs.access(DRIVER_LOCATION_FILE);
    } catch (error) {
        await fs.writeFile(DRIVER_LOCATION_FILE, JSON.stringify({ lat: null, lng: null, timestamp: null }), 'utf-8');
    }
}
ensureDriverLocationFile(); // Exécutez au démarrage du serveur

export const GET: APIRoute = async ({ request }) => {
    try {
        const fileContent = await fs.readFile(DRIVER_LOCATION_FILE, 'utf-8');
        const driverLocation = JSON.parse(fileContent);
        return new Response(JSON.stringify(driverLocation), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Failed to read driver location:", error);
        return new Response(JSON.stringify({ error: "Failed to retrieve driver location" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const POST: APIRoute = async ({ request }) => {
    const driverApiSecret = import.meta.env.DRIVER_API_SECRET;
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || authHeader !== `Bearer ${driverApiSecret}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const { lat, lng } = await request.json();
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400 });
        }

        const newLocation = { lat, lng, timestamp: Date.now() };
        await fs.writeFile(DRIVER_LOCATION_FILE, JSON.stringify(newLocation), 'utf-8');

        return new Response(JSON.stringify({ message: "Driver location updated", location: newLocation }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Failed to update driver location:", error);
        return new Response(JSON.stringify({ error: "Failed to parse request body or write file" }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};