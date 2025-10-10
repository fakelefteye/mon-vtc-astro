// src/pages/api/log-trip.js
import { google } from 'googleapis';
import { Client } from "@googlemaps/google-maps-services-js";

export const prerender = false;

// --- CONFIGURATION ---
const SPREADSHEET_ID = import.meta.env.GOOGLE_SHEET_ID;
const HOME_ADDRESS = "31 rue pré mègne, 38650 Sinard, France";
const SHEET_NAME = "Feuille 1"; // Le nom de l'onglet dans votre feuille. Changez si besoin.

// --- INITIALISATIONS ---
const mapsClient = new Client({});
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: import.meta.env.GOOGLE_CLIENT_EMAIL,
        private_key: import.meta.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Le scope pour Sheets
});
const sheets = google.sheets({ version: 'v4', auth });


export const POST = async ({ request }) => {
    try {
        const bookingData = await request.json();
        const { name, email, phone, pickup, dropoff, distanceValue, bookingTime } = bookingData;

        // 1. Calculer le kilométrage du retour à domicile
        let returnDistanceKm = 'Erreur calcul';
        try {
            const directionsResponse = await mapsClient.directions({
                params: {
                    origin: dropoff, // Le point de départ est la destination du client
                    destination: HOME_ADDRESS,
                    key: import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY,
                }
            });
            if (directionsResponse.data.routes.length > 0) {
                const returnDistanceMeters = directionsResponse.data.routes[0].legs[0].distance.value;
                returnDistanceKm = (returnDistanceMeters / 1000).toFixed(2);
            }
        } catch (e) {
            console.error("Erreur calcul retour KM:", e.message);
        }

        const outboundDistanceKm = (distanceValue / 1000).toFixed(2);
        const totalDistance = !isNaN(parseFloat(returnDistanceKm)) ? (parseFloat(outboundDistanceKm) + parseFloat(returnDistanceKm)).toFixed(2) : 'N/A';

        // 2. Préparer la nouvelle ligne pour la feuille
        const newRow = [
            new Date(bookingTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
            name,
            email,
            phone,
            pickup,
            dropoff,
            outboundDistanceKm,
            returnDistanceKm,
            totalDistance
        ];

        // 3. Ajouter la ligne à la feuille Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1`, // Ajoute à la fin de la feuille
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [newRow],
            },
        });
        
        console.log("✅ Indemnités kilométriques ajoutées à la feuille Google Sheets.");
        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        console.error("❌ Erreur API log-trip:", error);
        return new Response(JSON.stringify({ message: "Erreur lors de l'enregistrement dans Google Sheets." }), { status: 500 });
    }
};