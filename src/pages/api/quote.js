// src/pages/api/quote.js
export const prerender = false;

import { Client } from '@googlemaps/google-maps-services-js';
import { getPricing } from '@/lib/pricing';
import { siteConfig } from '@/config/site.config';

const mapsClient = new Client({});

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeAndCheck(address, label) {
    const { lat: baseLat, lng: baseLng } = siteConfig.location.baseCoords;
    const maxMeters = siteConfig.location.maxServiceRadiusKm * 1000;

    const res = await mapsClient.geocode({
        params: {
            address,
            key: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY,
            region: siteConfig.location.country,
        },
    });

    if (res.data.status !== 'OK' || !res.data.results.length) {
        throw new Error(`L'adresse de ${label} est introuvable.`);
    }

    const { lat, lng } = res.data.results[0].geometry.location;
    const dist = haversineDistance(baseLat, baseLng, lat, lng);

    if (dist > maxMeters) {
        throw new Error(
            `Le point de ${label} est hors de notre zone de service (max ${siteConfig.location.maxServiceRadiusKm} km de ${siteConfig.location.city}).`
        );
    }
    return { lat, lng };
}

function isNightTime(bookingTime, pricing) {
    if (!bookingTime) return false;
    const hour = new Date(bookingTime).getHours();
    const { nightStartHour, nightEndHour } = pricing;
    return hour >= nightStartHour || hour < nightEndHour;
}

export const POST = async ({ request }) => {
    try {
        const { pickup, dropoff, bookingTime } = await request.json();

        if (!pickup || !dropoff) {
            return new Response(
                JSON.stringify({ message: "Les adresses de départ et d'arrivée sont requises." }),
                { status: 400 }
            );
        }

        await geocodeAndCheck(pickup, 'départ');
        await geocodeAndCheck(dropoff, 'arrivée');

        const directionsRes = await mapsClient.directions({
            params: {
                origin: pickup,
                destination: dropoff,
                key: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY,
                departure_time: 'now',
                language: 'fr',
                region: siteConfig.location.country,
            },
        });

        if (directionsRes.data.status !== 'OK' || !directionsRes.data.routes.length) {
            return new Response(
                JSON.stringify({ message: "Impossible de calculer cet itinéraire." }),
                { status: 400 }
            );
        }

        const leg = directionsRes.data.routes[0].legs[0];
        const distanceMeters = leg.distance.value;
        const durationSeconds = leg.duration_in_traffic
            ? leg.duration_in_traffic.value
            : leg.duration.value;

        // Tarifs depuis Vercel Blob (admin-modifiables) ou config par défaut
        const pricing = await getPricing();

        const distanceKm = distanceMeters / 1000;
        const durationMinutes = durationSeconds / 60;
        let price =
            pricing.basePrice +
            distanceKm * pricing.pricePerKm +
            durationMinutes * pricing.pricePerMinute;

        // Majoration nuit si applicable
        if (isNightTime(bookingTime, pricing)) {
            price *= 1 + pricing.nightSurchargePercent / 100;
        }

        const finalPrice = Math.max(price, pricing.minimumPrice);

        return new Response(
            JSON.stringify({
                price: parseFloat(finalPrice.toFixed(2)),
                distanceText: leg.distance.text,
                durationText: leg.duration_in_traffic
                    ? leg.duration_in_traffic.text
                    : leg.duration.text,
                distanceValue: distanceMeters,
                durationValue: durationSeconds,
                nightSurcharge: isNightTime(bookingTime, pricing),
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('API Quote Error:', error.message);
        return new Response(
            JSON.stringify({ message: error.message || 'Erreur lors du calcul du devis.' }),
            { status: 400 }
        );
    }
};
