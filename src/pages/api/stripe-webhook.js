// src/pages/api/stripe-webhook.js
import Stripe from 'stripe';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const prerender = false;

// --- INITIALISATIONS ---
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
// Assurez-vous d'avoir cette clé dans votre .env, obtenue avec la Stripe CLI
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET; 

// Reprenez la configuration de votre fichier book.js
const transporter = nodemailer.createTransport({ /* ...votre config nodemailer... */ });
const auth = new google.auth.GoogleAuth({ /* ...votre config google auth... */ });
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
        return new Response(err.message, { status: 400 });
    }

    // On traite l'événement si le paiement est réussi
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const data = session.metadata; // On récupère les données de la course

        try {
            // C'est ici qu'on exécute la même logique que dans book.js
            console.log("Paiement réussi, finalisation de la réservation pour :", data.email);
            
            // GOOGLE CALENDAR
            const eventStartTime = new Date(data.bookingTime);
            const durationSeconds = parseInt(data.durationValue, 10) || 3600;
            const eventEndTime = new Date(eventStartTime.getTime() + durationSeconds * 1000);
            
            await calendar.events.insert({
                calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
                resource: {
                    summary: `Course VTC - ${data.name}`,
                    description: `Client: ${data.name} (${data.email}, ${data.phone})\nPayé en ligne.`,
                    start: { dateTime: eventStartTime.toISOString(), timeZone: 'Europe/Paris' },
                    end: { dateTime: eventEndTime.toISOString(), timeZone: 'Europe/Paris' },
                },
            });

            // NODEMAILER (Email de confirmation)
            // Recopiez ici votre logique de création de "bookingVoucherHtml" depuis book.js
            const bookingVoucherHtml = `<h1>Confirmation pour ${data.name}</h1><p>Merci, votre course de ${data.pickup} à ${data.dropoff} est confirmée et payée.</p>`;
            
            await transporter.sendMail({
                from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
                to: data.email,
                cc: import.meta.env.EMAIL_RECEIVER,
                subject: `Confirmation de votre réservation VTC (Payée)`,
                html: bookingVoucherHtml,
            });

        } catch (error) {
            console.error("❌ Erreur post-paiement (agenda ou email) :", error);
            return new Response("Erreur interne", { status: 500 });
        }
    }

    // On répond à Stripe pour confirmer la bonne réception
    return new Response(JSON.stringify({ received: true }), { status: 200 });
}