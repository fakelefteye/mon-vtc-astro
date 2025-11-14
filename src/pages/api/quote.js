// src/pages/api/quote.js
export const prerender = false;

import { Client } from "@googlemaps/google-maps-services-js";

// --- Modèle de Tarification VTC (configurable) ---
const PRIX_BASE = 0.00; // Frais de prise en charge
const PRIX_PAR_KM = 1.50; // Tarif au kilomètre
const PRIX_PAR_MINUTE = 0.80; // Tarif horaire (48€/h)
const PRIX_MINIMUM = 25.00; // Montant minimum de la course

const GRENOBLE_COORDS = { lat: 45.188529, lng: 5.724524 };
// NOUVELLE LIMITE : 150 km à vol d'oiseau depuis Grenoble
const MAX_DISTANCE_METERS = 150 * 1000; 

// On initialise le client Google Maps une seule fois
const mapsClient = new Client({});

// Fonction pour calculer la distance à vol d'oiseau (formule de Haversine)
function getDistanceFromGrenoble(lat, lng) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = GRENOBLE_COORDS.lat * Math.PI / 180;
    const φ2 = lat * Math.PI / 180;
    const Δφ = (lat - GRENOBLE_COORDS.lat) * Math.PI / 180;
    const Δλ = (lng - GRENOBLE_COORDS.lng) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Fonction utilitaire pour géocoder et vérifier la distance
 * @param {string} address - L'adresse à vérifier
 * @param {string} type - 'depart' ou 'arrivee' pour le message d'erreur
 */
async function geocodeAndCheckDistance(address, type) {
    const geocodeResponse = await mapsClient.geocode({
        params: { address: address, key: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY, region: 'FR' }
    });

    if (geocodeResponse.data.status !== 'OK' || !geocodeResponse.data.results.length) {
        throw new Error(`L'adresse de ${type} est introuvable.`);
    }

    const location = geocodeResponse.data.results[0].geometry.location;
    const distance = getDistanceFromGrenoble(location.lat, location.lng);

    if (distance > MAX_DISTANCE_METERS) {
        throw new Error(`Le point de ${type} est hors de notre zone de service (max 150 km de Grenoble à vol d'oiseau).`);
    }
    return location;
}


export const POST = async ({ request }) => {
    try {
        const { pickup, dropoff } = await request.json();
        if (!pickup || !dropoff) {
            return new Response(JSON.stringify({ message: "Les adresses de départ et d'arrivée sont requises." }), { status: 400 });
        }

        // 1. Géocoder et vérifier l'adresse de départ
        await geocodeAndCheckDistance(pickup, 'départ');

        // 2. Géocoder et vérifier l'adresse d'arrivée (NOUVEAU)
        await geocodeAndCheckDistance(dropoff, 'arrivée');


        // 3. Obtenir l'itinéraire
        const directionsResponse = await mapsClient.directions({
            params: {
                origin: pickup,
                destination: dropoff,
                key: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY,
                departure_time: 'now', // Pour le trafic
                language: 'fr',
                region: 'FR'
            }
        });

        if (directionsResponse.data.status !== 'OK' || !directionsResponse.data.routes.length) {
             return new Response(JSON.stringify({ message: "Impossible de calculer cet itinéraire." }), { status: 400 });
        }

        const route = directionsResponse.data.routes[0].legs[0];
        const distanceMeters = route.distance.value;
        const durationSeconds = route.duration_in_traffic ? route.duration_in_traffic.value : route.duration.value;

        // --- Calcul du prix (tarifs ajustés) ---
        const distanceKm = distanceMeters / 1000;
        const durationMinutes = durationSeconds / 60;
        let calculatedPrice = PRIX_BASE + (distanceKm * PRIX_PAR_KM) + (durationMinutes * PRIX_PAR_MINUTE);
        const finalPrice = Math.max(calculatedPrice, PRIX_MINIMUM);

        // On renvoie un objet simple
        return new Response(JSON.stringify({
            price: parseFloat(finalPrice.toFixed(2)), // Arrondi à 2 décimales
            distanceText: route.distance.text,
            durationText: route.duration_in_traffic ? route.duration_in_traffic.text : route.duration.text,
            distanceValue: distanceMeters,
            durationValue: durationSeconds
        }), { status: 200 });

    } catch (error) {
        console.error("API Quote Error:", error.message);
        // Gestion des erreurs lancées par geocodeAndCheckDistance
        return new Response(JSON.stringify({ message: error.message || "Erreur lors du calcul du devis." }), { status: 400 });
    }
};