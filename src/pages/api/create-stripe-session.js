// src/pages/api/create-stripe-session.js
import Stripe from 'stripe';

export const prerender = false;

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
                    unit_amount: Math.round(price * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            // IMPORTANT : On transmet toutes les données de la course pour le webhook.
            metadata: rideDetails,
            success_url: `${request.headers.get('origin')}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${request.headers.get('origin')}/`,
        });

        return new Response(JSON.stringify({ id: session.id }), { status: 200 });
    } catch (error) {
        console.error("Erreur Stripe :", error);
        return new Response(JSON.stringify({ message: "Erreur lors de la création de la session de paiement" }), { status: 500 });
    }
}