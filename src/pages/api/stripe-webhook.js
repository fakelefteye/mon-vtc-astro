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
            // # GOOGLE CALENDAR (CORRECTION AVEC FORCAGE DU FUSEAU HORAIRE PARIS) #
            // ##########################################

            const bookingTimeLocalString = data.bookingTime; // Ex: "2023-10-27T21:30"
            console.log(`[Débogage Fuseau Horaire] Heure brute du formulaire: ${bookingTimeLocalString}`);

            // === CRÉATION DE LA DATE DANS LE FUSEAU HORAIRE DE PARIS ===
            // 1. On parse les composants de la date et de l'heure
            const [datePart, timePart] = bookingTimeLocalString.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);

            // 2. On construit une date avec les composants saisis par l'utilisateur.
            //    On va ensuite la formater comme une date ISO DANS le fuseau horaire de Paris.
            //    Ceci est une étape intermédiaire pour bien représenter l'heure voulue.
            const userDesiredDate = new Date(year, month - 1, day, hours, minutes); // Cette date est dans le TZ du serveur (UTC sur Vercel)

            // 3. On formate cette date en une chaîne ISO 8601 qui inclut le décalage de Paris
            //    Ceci assure que l'heure envoyée est explicitement "2023-10-27T21:30:00+02:00" ou "+01:00"
            //    Cette chaîne est ce que Google Calendar attend si vous voulez une heure spécifique dans un fuseau horaire.
            const eventStartTimeISO = userDesiredDate.toLocaleString('en-CA', { // 'en-CA' pour le format YYYY-MM-DD
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Europe/Paris',
                hourCycle: 'h23',
                fractionalSecondDigits: 3, // pour avoir les ms
                timeZoneName: 'longOffset' // Pour inclure le "+02:00" ou "+01:00"
            }).replace(',', ''); // Supprime la virgule si elle est présente


            // On doit re-parser cette chaîne pour obtenir un objet Date correct pour .toISOString()
            // et s'assurer que l'offset est bien pris en compte.
            // Le format généré est comme "2023-10-27 21:30:00.000 GMT+2". Google préfère "2023-10-27T21:30:00+02:00".
            // Nous devons ajuster le format.

            // Solution la plus fiable: utiliser l'objet Date et son timeZoneOffset
            // Construire une date string qui sera interprétée comme locale Paris
            const dt = new Date(year, month - 1, day, hours, minutes); // Ceci est l'heure locale du serveur (UTC)

            // Obtenir le décalage actuel pour Paris à cette date
            const parisTime = dt.toLocaleString('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const utcTime = dt.toLocaleString('en-US', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const offsetHours = (new Date(parisTime).getTime() - new Date(utcTime).getTime()) / (1000 * 60 * 60);

            // Créer la date de début en UTC en soustrayant le décalage de Paris
            // Si l'utilisateur a entré 21:30, et Paris est UTC+2, alors l'heure UTC doit être 19:30.
            let eventStartTimeAdjusted = new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes));
            
            console.log(`[Débogage Fuseau Horaire] Heure utilisateur (parseé en UTC): ${new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString()}`);
            console.log(`[Débogage Fuseau Horaire] Offset de Paris calculé pour cette date: ${offsetHours} heures`);
            console.log(`[Débogage Fuseau Horaire] Heure de début ajustée (UTC correcte): ${eventStartTimeAdjusted.toISOString()}`);


            const durationSeconds = parseInt(data.durationValue || '3600', 10); 
            const eventEndTimeAdjusted = new Date(eventStartTimeAdjusted.getTime() + durationSeconds * 1000);
            
            await calendar.events.insert({
                calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
                resource: {
                    summary: `Course VTC - ${data.name || 'Client inconnu'}`,
                    description: `Client: ${data.name || 'N/A'} (${data.email || 'N/A'}, ${data.phone || 'N/A'})\n\nDe: ${data.pickup || 'N/A'}\nÀ: ${data.dropoff || 'N/A'}\n\nPrix payé: ${(session.amount_total / 100).toFixed(2)} € (via Stripe)\nStatut: Payé en ligne.\nRequêtes spéciales: ${data.specialRequests || 'Aucune'}`,
                    start: { dateTime: eventStartTimeAdjusted.toISOString(), timeZone: 'Europe/Paris' },
                    end: { dateTime: eventEndTimeAdjusted.toISOString(), timeZone: 'Europe/Paris' },
                },
            });
            console.log("✅ Événement ajouté au Google Calendar.");

            // ##########################################
            // # FIN CORRECTION FUSEAU HORAIRE CALENDAR #
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