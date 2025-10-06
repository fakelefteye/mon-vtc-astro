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
            // # GOOGLE CALENDAR (CORRECTION DE FUSEAU HORAIRE V3) #
            // ##########################################

            const bookingTimeLocalString = data.bookingTime; // Ex: "2023-10-27T21:30"
            console.log(`[Débogage Fuseau Horaire] Heure brute du formulaire: ${bookingTimeLocalString}`);

            // 1. Parser la chaîne comme une date ISO dans le fuseau horaire de Paris
            //    On construit manuellement pour éviter les interprétations par défaut de new Date()
            const [datePart, timePart] = bookingTimeLocalString.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);

            // Créer une date qui est **explicitement** l'heure locale de Paris.
            // On peut le faire en créant une Date UTC puis en lui assignant les composants.
            // La façon la plus simple est d'utiliser un format spécifique qui est toujours interprété comme UTC.
            // Mais puisque datetime-local ne met pas de Z à la fin, on doit ajuster.

            // Calculer le décalage pour Paris à la date donnée
            // On crée un objet Date temporaire pour la date entrée (interprétée comme UTC par Vercel)
            const tempDate = new Date(bookingTimeLocalString);
            
            // On détermine le décalage de 'Europe/Paris' pour cette date.
            // new Date().toLocaleString() avec timeZone peut être imprécis avec les heures de transition.
            // Une méthode plus robuste serait de construire la date dans un autre fuseau puis de comparer.
            // Ou, plus simple, d'assumer le décalage actuel de Paris par rapport à UTC (pour une solution rapide).
            // Si Paris est UTC+1 ou UTC+2, il faut soustraire ce décalage.

            // *** OPTION LA PLUS SIMPLE ET SOUVENT SUFFISANTE POUR CETTE ERREUR DE +2H ***
            // Crée une date objet qui est l'heure locale que l'utilisateur a saisie,
            // puis l'on retire simplement l'offset du serveur à cette date.
            let eventStartTime = new Date(bookingTimeLocalString); // Vercel l'interprète comme UTC
            
            // Calculer l'offset de la date locale du serveur (UTC) par rapport à UTC. C'est 0.
            // Calculer l'offset du temps entré (qui est Europe/Paris) par rapport à UTC. C'est -60 ou -120 minutes.
            // On veut que l'heure sur Vercel corresponde à l'heure locale de Paris.
            // Si on entre 21h30 (Paris, UTC+2), Vercel pense que c'est 21h30 UTC.
            // Il faut que Vercel pense que c'est 19h30 UTC. Donc on soustrait 2 heures.
            // Le décalage de Paris par rapport à UTC pour la date donnée.

            // Une méthode plus directe, mais potentiellement moins précise aux changements d'heure :
            // Retirer simplement l'offset LOCAL de la machine Vercel (qui est 0)
            // et ajouter l'offset de Paris à UTC. C'est le contraire.

            // OK, voici la méthode directe sans librairie externe, mais qui demande un peu d'analyse.
            // '2023-10-27T21:30' (utilisateur veut 21h30 Paris)
            // Vercel : new Date('2023-10-27T21:30') => 21h30 UTC (objet Date).
            // Heure UTC que nous voulons : 19h30 UTC (car 21h30 Paris = 19h30 UTC en été)
            // Donc, il faut soustraire 2 heures (l'offset de l'heure d'été de Paris).

            // On va utiliser l'API Intl.DateTimeFormat pour obtenir le décalage précis.
            const timeZone = 'Europe/Paris';
            const dateInParis = new Date(bookingTimeLocalString).toLocaleString('en-US', {timeZone: timeZone, hourCycle: 'h23'});
            // Ex: "10/27/2023, 21:30:00" si local de Vercel est US ou UTC.

            // Reconstruire la date pour qu'elle soit interprétée comme UTC dès le départ.
            // En gros, on prend l'heure entrée par l'utilisateur (ex: 21:30) et on la force à être UTC.
            // Pour ça, on crée un objet Date à partir de ses composants, puis on applique le décalage.
            
            const eventDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
            
            // Maintenant, eventDate est 21h30 UTC.
            // On sait que l'utilisateur voulait 21h30 Europe/Paris.
            // On doit retirer le décalage horaire de Paris par rapport à UTC pour cette date.

            // La méthode la plus robuste pour obtenir le décalage de Paris pour cette date:
            const tempDateWithUserLocalTime = new Date(year, month - 1, day, hours, minutes); // Cette date est dans le fuseau horaire du SERVER
            const offsetParis = tempDateWithUserLocalTime.toLocaleString('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
            const offsetUTC = tempDateWithUserLocalTime.toLocaleString('en-US', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });

            const diffHours = (new Date(offsetParis).getTime() - new Date(offsetUTC).getTime()) / (1000 * 60 * 60);

            // Donc, si l'utilisateur a entré 21h30 (Paris, ex: UTC+2), il faut que le datetime de l'événement soit 19h30 UTC.
            // La `eventDate` est actuellement 21h30 UTC. On doit lui soustraire `diffHours`.
            eventDate.setHours(eventDate.getHours() - diffHours);

            // C'est cette 'eventDate' (maintenant 19h30 UTC si tout va bien) qui devient notre 'eventStartTime'
            eventStartTime = eventDate;

            console.log(`[Débogage Fuseau Horaire] Décalage calculé (Paris vs UTC): ${diffHours} heures`);
            console.log(`[Débogage Fuseau Horaire] eventStartTime finale (devrait être UTC correcte): ${eventStartTime.toISOString()}`);
            
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
            // # FIN CORRECTION DE FUSEAU HORAIRE CALENDAR #
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