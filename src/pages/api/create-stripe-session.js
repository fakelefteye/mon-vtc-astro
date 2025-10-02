// src/pages/api/create-stripe-session.js
import Stripe from 'stripe';

export const prerender = false;

// Initialise Stripe avec votre clé SECRÈTE
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export async function POST({ request }) {
    try {
        const rideDetails = await request.json();
        const { price, pickup, dropoff, email, bookingTime } = rideDetails;

        if (!price || price <= 0) {
            return new Response(JSON.stringify({ message: 'Prix invalide' }), { status: 400 });
        }

        const session = await stripe.checkout.sessions.create({
            customer_email: email,
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `Course VTC : ${pickup} → ${dropoff}`,
                        description: `Prise en charge le ${new Date(bookingTime).toLocaleString('fr-FR')}`,
                    },
                    unit_amount: Math.round(price * 100), // Prix en centimes
                },
                quantity: 1,
            }],
            mode: 'payment',
            // URLs vers lesquelles le client est redirigé
            success_url: `${request.headers.get('origin')}/confirmation?payment=success`,
            cancel_url: `${request.headers.get('origin')}/`,
        });

        // On renvoie l'ID de la session au frontend
        return new Response(JSON.stringify({ id: session.id }), { status: 200 });

    } catch (error) {
        console.error("Erreur Stripe :", error);
        return new Response(JSON.stringify({ message: "Erreur lors de la création de la session de paiement" }), { status: 500 });
    }
}