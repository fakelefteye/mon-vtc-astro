// src/pages/api/book.js
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const prerender = false;

// Configuration de Nodemailer (connexion au serveur d'e-mails)
const transporter = nodemailer.createTransport({
    host: import.meta.env.EMAIL_HOST,
    port: 25,
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

// --- GESTIONNAIRE DE LA REQUÊTE ---
export async function POST({ request }) {
    const data = await request.json();

    console.log("Données de la réservation (Payer en véhicule) :", data);

    try {
        // ##########################################
        // # GOOGLE CALENDAR (CORRECTION DE FUSEAU HORAIRE) #
        // ##########################################

        const bookingTimeLocalString = data.bookingTime; // Ex: "2023-10-27T21:30"
        console.log(`[Débogage Fuseau Horaire - BOOK.JS] Heure brute du formulaire: ${bookingTimeLocalString}`);

        // 1. Parser les composants de la date et de l'heure
        const [datePart, timePart] = bookingTimeLocalString.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);

        // 2. Créer une date temporaire pour calculer l'offset
        const tempDateWithUserLocalTime = new Date(year, month - 1, day, hours, minutes); // Cette date est dans le fuseau horaire du serveur (UTC sur Vercel)

        // 3. Calculer le décalage (offset) de 'Europe/Paris' par rapport à UTC pour cette date spécifique
        const parisTime = tempDateWithUserLocalTime.toLocaleString('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const utcTime = tempDateWithUserLocalTime.toLocaleString('en-US', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const offsetHours = (new Date(parisTime).getTime() - new Date(utcTime).getTime()) / (1000 * 60 * 60);

        // 4. Construire la date de début de l'événement en UTC, en soustrayant l'offset de Paris
        //    (Si l'utilisateur a entré 21h30 (Paris, UTC+2), alors l'heure UTC correcte est 19h30 UTC.
        //     Les composants saisis sont (21h30), on soustrait l'offset (2h) pour obtenir 19h30 UTC.)
        let eventStartTimeAdjusted = new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes));
        
        console.log(`[Débogage Fuseau Horaire - BOOK.JS] Offset de Paris calculé pour cette date: ${offsetHours} heures`);
        console.log(`[Débogage Fuseau Horaire - BOOK.JS] Heure de début ajustée (UTC correcte): ${eventStartTimeAdjusted.toISOString()}`);

        const durationSeconds = parseInt(data.durationValue || '3600', 10); 
        const eventEndTimeAdjusted = new Date(eventStartTimeAdjusted.getTime() + durationSeconds * 1000);
        
        await calendar.events.insert({
            calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
            resource: {
                summary: `Course VTC - ${data.name || 'Client inconnu'} (À Payer)`,
                description: `Client: ${data.name || 'N/A'} (${data.email || 'N/A'}, ${data.phone || 'N/A'})\n\nDe: ${data.pickup || 'N/A'}\nÀ: ${data.dropoff || 'N/A'}\n\nPrix estimé: ${data.price ? data.price.toFixed(2) : 'N/A'} € (Paiement en véhicule)\nStatut: Réservé (À Payer).\nRequêtes spéciales: ${data.specialRequests || 'Aucune'}`,
                start: { dateTime: eventStartTimeAdjusted.toISOString(), timeZone: 'Europe/Paris' },
                end: { dateTime: eventEndTimeAdjusted.toISOString(), timeZone: 'Europe/Paris' },
            },
        });
        console.log("✅ Événement ajouté au Google Calendar pour paiement en véhicule.");

        // ##########################################
        // # FIN CORRECTION FUSEAU HORAIRE CALENDAR #
        // ##########################################


        // --- ENVOI DE L'E-MAIL DE CONFIRMATION ---
        const bookingVoucherHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2d3a4c; color: white; padding: 20px; text-align: center;">
                    <h1>Confirmation de Réservation (Paiement en Véhicule)</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Bonjour ${data.name || 'cher client'},</p>
                    <p>Votre réservation a bien été prise en compte et le paiement se fera directement dans le véhicule.</p>
                    <h3 style="color: #c5a47e;">Détails du trajet</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Départ :</strong> ${data.pickup || 'Non spécifié'}</li>
                        <li><strong>Arrivée :</strong> ${data.dropoff || 'Non spécifié'}</li>
                        <li><strong>Date & Heure :</strong> ${new Date(data.bookingTime).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' })}</li>
                        <li><strong>Passagers :</strong> ${data.passengers || '1'}</li>
                    </ul>
                    <h3 style="color: #c5a47e;">Détails du paiement</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Prix estimé :</strong> ${data.price ? data.price.toFixed(2) : 'N/A'} €</li>
                        <li><strong>Méthode :</strong> Paiement directement au chauffeur</li>
                    </ul>
                    <p style="margin-top: 20px;">Un chauffeur vous contactera prochainement.</p>
                    <p>Merci de votre confiance.</p>
                    <p><strong>${import.meta.env.COMPANY_NAME}</strong></p>
                </div>
            </div>
        `;
        
        await transporter.sendMail({
            from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
            to: data.email,
            cc: import.meta.env.EMAIL_RECEIVER,
            subject: `✅ Votre réservation VTC est confirmée (Paiement en véhicule) - ${data.name}`,
            html: bookingVoucherHtml,
        });
        console.log("✅ Email de confirmation envoyé pour paiement en véhicule à :", data.email);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("❌ Erreur lors de la réservation (Payer en véhicule) :", error);
        return new Response(JSON.stringify({ message: 'Erreur lors de la réservation.', error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}