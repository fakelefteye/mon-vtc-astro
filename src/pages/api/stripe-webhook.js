import Stripe from 'stripe';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const prerender = false;

// --- INITIALISATIONS ---
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET; 

// Configuration de Nodemailer (connexion au serveur d'e-mails)
const transporter = nodemailer.createTransport({
    host: import.meta.env.EMAIL_HOST,
    port: parseInt(import.meta.env.EMAIL_PORT, 10),
    secure: import.meta.env.EMAIL_SECURE === 'true',
    auth: {
        user: import.meta.env.EMAIL_USER,
        pass: import.meta.env.EMAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    },
    logger: true,
    debug: true,
});

// Configuration de l'API Google (connexion à l'agenda)
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: import.meta.env.GOOGLE_CLIENT_EMAIL,
        private_key: import.meta.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
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
        console.error(`❌ Échec de la vérification de la signature du webhook : ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const data = session.metadata;

        console.log("✅ Paiement Stripe réussi, session ID :", session.id);
        console.log("Données de la réservation :", data);

        try {
            // ##########################################
            // # GOOGLE CALENDAR (CORRECTION SIMPLE -2 HEURES) #
            // ##########################################

            const bookingTimeLocalString = data.bookingTime; // Ex: "2023-10-27T21:30"
            let eventStartTime = new Date(bookingTimeLocalString); 

            console.log(`[Débogage Fuseau Horaire] Heure brute du formulaire: ${bookingTimeLocalString}`);
            console.log(`[Débogage Fuseau Horaire] Heure interprétée par Vercel (avant ajustement): ${eventStartTime.toISOString()}`);

            // === CORRECTION SIMPLE ET DIRECTE : RETIRER 2 HEURES ===
            // Cela suppose que Vercel interprète la chaîne comme UTC, et que l'heure locale (Paris) est UTC+2.
            // Si l'utilisateur a entré 21h30 (Paris, UTC+2), Vercel l'a interprété comme 21h30 UTC.
            // Pour que ce soit 21h30 Paris dans Google Calendar, il faut envoyer 19h30 UTC.
            // Donc, on retire 2 heures à la date "21h30 UTC" pour obtenir "19h30 UTC".
            eventStartTime.setHours(eventStartTime.getHours() - 2); 
            // =======================================================
            
            console.log(`[Débogage Fuseau Horaire] Heure de début ajustée (après soustraction de 2h): ${eventStartTime.toISOString()}`);

            const durationSeconds = parseInt(data.durationValue || '3600', 10); 
            const eventEndTime = new Date(eventStartTime.getTime() + durationSeconds * 1000);
            
            await calendar.events.insert({
                calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
                resource: {
                    summary: `Course VTC - ${data.name || 'Client inconnu'}`,
                    description: `Client: ${data.name || 'N/A'} (${data.email || 'N/A'}, ${data.phone || 'N/A'})\n\nDe: ${data.pickup || 'N/A'}\nÀ: ${data.dropoff || 'N/A'}\n\nPrix payé: ${(session.amount_total / 100).toFixed(2)} € (via Stripe)\nStatut: Payé en ligne.\nRequêtes spéciales: ${data.specialRequests || 'Aucune'}`,
                    start: { dateTime: eventStartTime.toISOString(), timeZone: 'Europe/Paris' },
                    end: { dateTime: eventEndTime.toISOString(), timeZone: 'Europe/Paris' },
                },
            });
            console.log("✅ Événement ajouté au Google Calendar.");

            // ##########################################
            // # FIN CORRECTION SIMPLE -2 HEURES #
            // ##########################################


            // --- ENVOI DE L'E-MAIL DE CONFIRMATION ---
            const bookingVoucherHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2d3a4c; color: white; padding: 20px; text-align: center;">
                        <h1>Confirmation de Réservation</h1>
                    </div>
                    <div style="padding: 20px;">
                        <p>Bonjour ${data.name || 'cher client'},</p>
                        <p>Votre réservation est confirmée et payée. Voici le récapitulatif :</p>
                        <h3 style="color: #c5a47e;">Détails du trajet</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Départ :</strong> ${data.pickup || 'Non spécifié'}</li>
                            <li><strong>Arrivée :</strong> ${data.dropoff || 'Non spécifié'}</li>
                            <li><strong>Date & Heure :</strong> ${new Date(data.bookingTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })}</li>
                            <li><strong>Passagers :</strong> ${data.passengers || '1'}</li>
                        </ul>
                        <h3 style="color: #c5a47e;">Détails du paiement</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Prix payé :</strong> ${(session.amount_total / 100).toFixed(2)} €</li>
                            <li><strong>Méthode :</strong> Payé en ligne (Stripe)</li>
                        </ul>
                        <p style="margin-top: 20px;">Merci de votre confiance.</p>
                        <p><strong>${import.meta.env.COMPANY_NAME}</strong></p>
                    </div>
                </div>
            `;
            
            await transporter.sendMail({
                from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
                to: data.email,
                cc: import.meta.env.EMAIL_RECEIVER,
                subject: `✅ Confirmation de votre réservation VTC (Payée) - ${data.name}`,
                html: bookingVoucherHtml,
            });
            console.log("✅ Email de confirmation envoyé à :", data.email);

        } catch (error) {
            console.error("❌ Erreur post-paiement (agenda ou email) :", error);
            return new Response("Erreur interne lors de la finalisation de la réservation.", { status: 500 });
        }
    } else {
        console.log(`ℹ️ Événement Stripe ignoré : ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}