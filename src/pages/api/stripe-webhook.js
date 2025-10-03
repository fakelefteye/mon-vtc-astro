// src/pages/api/stripe-webhook.js
import Stripe from 'stripe';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const prerender = false;

// --- INITIALISATIONS ---
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET; 

// Configuration de Nodemailer
const transporter = nodemailer.createTransport({
    host: import.meta.env.EMAIL_HOST,
    port: parseInt(import.meta.env.EMAIL_PORT || '465', 10), // Assurez-vous que le port est un nombre
    secure: import.meta.env.EMAIL_SECURE === 'true', // true pour le port 465 (Gmail), false pour les autres (ex: 587)
    auth: {
        user: import.meta.env.EMAIL_USER,
        pass: import.meta.env.EMAIL_PASSWORD, // Utilisez EMAIL_PASSWORD si c'est ce que vous avez configuré
    },
    // --- NOUVELLES OPTIONS DE DÉBOGAGE ---
    timeout: 30000, // Augmenter le délai d'attente à 30 secondes (par défaut 10s)
    logger: true,   // Active les logs internes de Nodemailer
    debug: true,    // Affiche des informations de débogage supplémentaires
});
});


// Configuration de Google Auth pour Calendar
const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: import.meta.env.GOOGLE_CLIENT_EMAIL, // Utilisez GOOGLE_CLIENT_EMAIL si c'est ce que vous avez configuré
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
        console.error(`❌ Échec de la vérification du webhook : ${err.message}`);
        // Il est crucial de renvoyer une 400 pour que Stripe sache que la vérification a échoué
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // On traite l'événement si le paiement est réussi
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const data = session.metadata; // On récupère les données de la course

        console.log("Paiement Stripe réussi, session ID :", session.id);
        console.log("Données de la réservation (metadata) :", data);

        try {
            // GOOGLE CALENDAR
            const eventStartTime = new Date(data.bookingTime);
            // S'assurer que durationValue est bien un nombre ou fournir une valeur par défaut sûre
            const durationSeconds = parseInt(data.durationValue || '3600', 10); 
            const eventEndTime = new Date(eventStartTime.getTime() + durationSeconds * 1000);
            
            await calendar.events.insert({
                calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
                resource: {
                    summary: `Course VTC - ${data.name || 'Client inconnu'}`,
                    description: `Client: ${data.name || 'N/A'} (${data.email || 'N/A'}, ${data.phone || 'N/A'})
De: ${data.pickup || 'N/A'}
À: ${data.dropoff || 'N/A'}
Prix payé: ${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A'} € (via Stripe)
Statut: Payé en ligne.
Requêtes spéciales: ${data.specialRequests || 'Aucune'}`, // Assurez-vous que specialRequests est passé via metadata
                    start: { dateTime: eventStartTime.toISOString(), timeZone: 'Europe/Paris' },
                    end: { dateTime: eventEndTime.toISOString(), timeZone: 'Europe/Paris' },
                    //attendees: [{ email: import.meta.env.EMAIL_RECEIVER }], // Pour que vous receviez l'événement
                },
            });
            console.log("✅ Événement ajouté au Google Calendar.");

            // NODEMAILER (Email de confirmation)
            // Recopiez ici votre logique de création de "bookingVoucherHtml" depuis book.js
            // J'ai mis un exemple plus complet pour l'email de confirmation
            const bookingVoucherHtml = `
                <h1>Confirmation de votre réservation VTC</h1>
                <p>Bonjour ${data.name || 'cher client'},</p>
                <p>Nous confirmons la prise en charge de votre réservation.</p>
                <p><strong>Détails du trajet :</strong></p>
                <ul>
                    <li><strong>De :</strong> ${data.pickup || 'Non spécifié'}</li>
                    <li><strong>À :</strong> ${data.dropoff || 'Non spécifié'}</li>
                    <li><strong>Date & Heure :</strong> ${new Date(data.bookingTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })}</li>
                    <li><strong>Nombre de passagers :</strong> ${data.passengers || '1'}</li>
                    <li><strong>Prix payé :</strong> ${session.amount_total ? (session.amount_total / 100).toFixed(2) : 'N/A'} €</li>
                    <li><strong>Méthode de paiement :</strong> En ligne (Stripe)</li>
                    ${data.specialRequests ? `<li><strong>Demandes spéciales :</strong> ${data.specialRequests}</li>` : ''}
                </ul>
                <p>Un chauffeur vous contactera prochainement.</p>
                <p>Merci de votre confiance.</p>
                <p>${import.meta.env.COMPANY_NAME}</p>
            `;
            
            await transporter.sendMail({
                from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
                to: data.email,
                cc: import.meta.env.EMAIL_RECEIVER, // Pour que vous receviez aussi la confirmation
                subject: `✅ Votre réservation VTC est confirmée et payée (${data.name || 'N/A'})`,
                html: bookingVoucherHtml,
            });
            console.log("✅ Email de confirmation envoyé à :", data.email);

        } catch (error) {
            console.error("❌ Erreur lors du traitement post-paiement (agenda ou email) :", error);
            // Il est important de renvoyer une 500 si le traitement échoue
            return new Response("Erreur interne du serveur lors du traitement post-paiement", { status: 500 });
        }
    } else {
        console.log(`ℹ️ Événement Stripe non traité : ${event.type}`);
    }

    // Réponse standard pour Stripe
    return new Response(JSON.stringify({ received: true }), { status: 200 });
}