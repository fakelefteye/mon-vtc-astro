import Stripe from 'stripe';
import { google } from 'googleapis'; // Garde Google API pour le calendrier, si vous le réactivez plus tard.
import nodemailer from 'nodemailer';

export const prerender = false;

// --- INITIALISATIONS ---
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET; 

const transporter = nodemailer.createTransport({
    host: import.meta.env.EMAIL_HOST,
    port: 465, // Port SMTP standard pour SSL
    secure: true, // Utiliser SSL
    auth: {
        user: import.meta.env.EMAIL_USER,
        pass: import.meta.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false // Moins sécurisé mais utile pour certains serveurs. Mettre à true si possible.
    }
});

// Le code Google Calendar est laissé ici mais le scope est minime pour le moment.
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: import.meta.env.GOOGLE_CLIENT_EMAIL,
        private_key: import.meta.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar.events'], // Scope pour le calendrier
});
const calendar = google.calendar({ version: 'v3', auth });


// --- GESTIONNAIRE DU WEBHOOK ---
export async function POST({ request }) {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    let event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error(`❌ Échec de la vérification de la signature du webhook Stripe: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const data = session.metadata; // data contient toutes les infos que vous avez mises dans metadata lors de la création de la session Stripe

        console.log("[Stripe Webhook] ✅ Paiement Stripe réussi, session ID :", session.id);
        console.log("[Stripe Webhook] Données de la réservation (metadata) :", data); // <-- LOG CRUCIAL: VÉRIFIEZ CECI DANS VERCEL

        try {
            // --- LOGIQUE GOOGLE CALENDAR (votre code existant) ---
            // Cette partie semble fonctionner (du moins, n'est pas la source de ce problème-ci)
            const bookingTimeLocalString = data.bookingTime; 
            let eventStartTime = new Date(bookingTimeLocalString);
            eventStartTime.setHours(eventStartTime.getHours() - 2); // Ajustement fixe pour l'heure d'été/hiver
            
            const durationSeconds = parseInt(data.durationValue || '3600', 10); 
            const eventEndTime = new Date(eventStartTime.getTime() + durationSeconds * 1000);
            
            await calendar.events.insert({
                calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
                resource: {
                    summary: `Course VTC - ${data.name || 'Client inconnu'}`,
                    description: `Client: ${data.name || 'N/A'}\nPayé: ${(session.amount_total / 100).toFixed(2)} € (Stripe)`,
                    start: { dateTime: eventStartTime.toISOString(), timeZone: 'Europe/Paris' },
                    end: { dateTime: eventEndTime.toISOString(), timeZone: 'Europe/Paris' },
                },
            });
            console.log("[Stripe Webhook] ✅ Événement ajouté au Google Calendar.");


            // --- ENVOI DE L'E-MAIL DE CONFIRMATION (votre code existant) ---
            const bookingVoucherHtml = `<h1>Confirmation pour ${data.name}</h1><p>Merci, votre course est confirmée et payée.</p>`;
            await transporter.sendMail({
                from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
                to: data.email,
                cc: import.meta.env.EMAIL_RECEIVER,
                subject: `✅ Votre réservation VTC est confirmée (Payée) - ${data.name}`,
                html: bookingVoucherHtml,
            });
            console.log("[Stripe Webhook] ✅ Email de confirmation envoyé à :", data.email);


            // --- DÉCLENCHER L'ENREGISTREMENT DANS GOOGLE SHEETS ---
            console.log("[Stripe Webhook] Tentative d'enregistrement du trajet dans Google Sheets...");
            const origin = new URL(request.url).origin;
            const logTripUrl = `${origin}/api/log-trip`;
            console.log(`[Stripe Webhook] Appel à l'URL: ${logTripUrl}`);

            // Utilisation de 'await' pour s'assurer que l'appel est terminé avant de continuer.
            // La gestion d'erreur est améliorée pour lire la réponse de /api/log-trip.
            const logTripResponse = await fetch(logTripUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data) // On envoie toutes les données de metadata.
            });

            if (!logTripResponse.ok) {
                // Si /api/log-trip renvoie une erreur (par exemple 400 ou 500)
                const errorBody = await logTripResponse.text(); // Lire le corps de la réponse pour plus de détails
                console.error(`[Stripe Webhook] ❌ Échec de l'appel à /api/log-trip (Statut: ${logTripResponse.status}). Réponse: ${errorBody}`);
                throw new Error(`Échec d'enregistrement Sheets: ${errorBody}`); // Provoque un catch et un 500 pour Stripe
            }
            
            console.log("[Stripe Webhook] ✅ Trajet enregistré avec succès dans Google Sheets.");

        } catch (error) {
            console.error("❌ [Stripe Webhook] Erreur lors du traitement post-paiement (Calendrier, Email, ou Sheets) :", error.message);
            // Retourne un 500 pour indiquer à Stripe que le webhook a échoué et qu'il devrait réessayer.
            return new Response(`Erreur interne: ${error.message}`, { status: 500 });
        }
    } else {
        console.log(`[Stripe Webhook] ℹ️ Événement Stripe ignoré : ${event.type}`);
    }

    // Toujours renvoyer un 200 à Stripe si le webhook a été reçu et traité sans erreur catastrophique.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
}