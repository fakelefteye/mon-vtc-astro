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

        const origin = request.headers.get('origin') || '';
        const referer = request.headers.get('referer') || '';

        // 🔍 Détection de la langue à partir du referer
        let langPrefix = '';
        if (referer.includes('/en/')) langPrefix = '/en';
        else if (referer.includes('/es/')) langPrefix = '/es';
        else langPrefix = ''; // FR par défaut

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

            // ✅ Redirige vers la bonne langue après paiement
            success_url: `${origin}${langPrefix}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}${langPrefix}/`,
            metadata: rideDetails,
        });

        return new Response(JSON.stringify({ id: session.id }), { status: 200 });
    } catch (error) {
        console.error("Erreur Stripe :", error);
        return new Response(JSON.stringify({ message: "Erreur lors de la création de la session de paiement" }), { status: 500 });
    }
}
