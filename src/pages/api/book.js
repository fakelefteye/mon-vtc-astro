// src/pages/api/book.js
export const prerender = false;
// src/pages/api/book.js
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: import.meta.env.EMAIL_HOST,
    port: import.meta.env.EMAIL_PORT,
    secure: true,
    auth: {
        user: import.meta.env.EMAIL_USER,
        pass: import.meta.env.EMAIL_PASSWORD,
    },
});

export const POST = async ({ request }) => {
    try {
        const data = await request.json();
        // Validation simple des données
        if (!data.name || !data.email || !data.bookingTime || !data.price) {
            return new Response(JSON.stringify({ message: "Données de réservation incomplètes." }), { status: 400 });
        }
        
        // --- Création d'un numéro de réservation unique ---
        const bookingId = `SC-${Date.now().toString().slice(-6)}`;

        // --- Création de l'événement Google Calendar ---
        const auth = new google.auth.GoogleAuth({ /* ... (config existante) ... */ });
        const calendar = google.calendar({ version: 'v3', auth });
        const eventStartTime = new Date(data.bookingTime);
        const eventEndTime = new Date(eventStartTime.getTime() + (data.durationValue || 3600) * 1000);

        const eventDescription = `
            Client: ${data.name} (${data.email}, ${data.phone})
            Passagers: ${data.passengers}
            Départ: ${data.pickup}
            Arrivée: ${data.dropoff}
            Prix: ${data.price.toFixed(2)} €
            Demandes: ${data.specialRequests || 'Aucune'}
            Réservation N°: ${bookingId}
        `;
        
        await calendar.events.insert({
            calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
            resource: {
                summary: `Course VTC - ${data.name}`,
                description: eventDescription,
                start: { dateTime: eventStartTime.toISOString(), timeZone: 'Europe/Paris' },
                end: { dateTime: eventEndTime.toISOString(), timeZone: 'Europe/Paris' },
            },
        });

        // --- Création du bon de réservation HTML ---
        const bookingVoucherHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd;">
                <div style="background-color: #1a1a1a; color: white; padding: 20px; text-align: center;">
                    <h1>Bon de Réservation VTC</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>Réservation N° : ${bookingId}</h2>
                    <p>Bonjour ${data.name}, merci pour votre confiance. Voici le récapitulatif de votre réservation.</p>
                    
                    <h3>Informations sur la Prestation</h3>
                    <p><strong>Date et Heure de Prise en Charge :</strong> ${new Date(data.bookingTime).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</p>
                    <p><strong>Lieu de Prise en Charge :</strong> ${data.pickup}</p>
                    <p><strong>Lieu de Destination :</strong> ${data.dropoff}</p>
                    
                    <h3>Détails</h3>
                    <p><strong>Nombre de Passagers :</strong> ${data.passengers}</p>
                    <p><strong>Demandes Particulières :</strong> ${data.specialRequests || 'Aucune'}</p>
                    
                    <h3 style="margin-top: 30px; color: #c5a47e;">Coût Total de la Course : ${data.price.toFixed(2)} € TTC</h3>
                    <p><i>Méthode de Paiement : Paiement à bord par carte bancaire ou espèces.</i></p>
                </div>
                <div style="background-color: #f4f4f4; padding: 20px; font-size: 12px; color: #555;">
                    <p><strong>Votre Chauffeure :</strong> ${import.meta.env.DRIVER_NAME}</p>
                    <hr>
                    <p><strong>${import.meta.env.COMPANY_NAME}</strong></p>
                    <p>${import.meta.env.COMPANY_CONTACT}</p>
                    <p><strong>N° d'inscription au registre VTC :</strong> ${import.meta.env.VTC_REGISTER_NUMBER}</p>
                    <p><i>Ce document fait office de bon de réservation. Merci de le conserver.</i></p>
                </div>
            </div>
        `;

        // --- Envoi de l'e-mail ---
        await transporter.sendMail({
            from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
            to: data.email, // E-mail du client
            cc: import.meta.env.EMAIL_RECEIVER, // Vous en copie
            subject: `Confirmation de votre réservation VTC N° ${bookingId}`,
            html: bookingVoucherHtml,
        });

        return new Response(JSON.stringify({ message: "Réservation réussie !" }), { status: 200 });

    } catch (error) {
        console.error("API Book Error:", error);
        return new Response(JSON.stringify({ message: "Erreur serveur lors de la réservation." }), { status: 500 });
    }
};