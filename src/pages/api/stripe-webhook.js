// src/pages/api/stripe-webhook.js
import Stripe from 'stripe';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

// Re-use your email and calendar logic from book.js
const transporter = nodemailer.createTransport({ /* ... your nodemailer config ... */ });
const auth = new google.auth.GoogleAuth({ /* ... your google auth config ... */ });
const calendar = google.calendar({ version: 'v3', auth });

async function finalizeBooking(data) {
    const eventStartTime = new Date(data.bookingTime);
    const durationSeconds = parseInt(data.durationValue, 10) || 3600;
    const eventEndTime = new Date(eventStartTime.getTime() + durationSeconds * 1000);
    const bookingId = `SC-${Date.now().toString().slice(-6)}`;
    
    await calendar.events.insert({
        calendarId: import.meta.env.GOOGLE_CALENDAR_ID,
        resource: {
            summary: `VTC Ride - ${data.name}`,
            description: `Client: ${data.name}\nContact: ${data.email}, ${data.phone}\nPrice: ${parseFloat(data.price).toFixed(2)} € (Paid Online)`,
            start: { dateTime: eventStartTime.toISOString(), timeZone: 'Europe/Paris' },
            end: { dateTime: eventEndTime.toISOString(), timeZone: 'Europe/Paris' },
        },
    });

    const bookingVoucherHtml = `<h1>Booking Confirmation #${bookingId}</h1><p>Thank you, ${data.name}!</p><p>Your ride from ${data.pickup} to ${data.dropoff} is confirmed.</p><p>Payment Method: Paid Online</p>`;
    
    await transporter.sendMail({
        from: `"${import.meta.env.COMPANY_NAME}" <${import.meta.env.EMAIL_USER}>`,
        to: data.email,
        cc: import.meta.env.EMAIL_RECEIVER,
        subject: `Your VTC Booking Confirmation #${bookingId}`,
        html: bookingVoucherHtml,
    });
}

export async function POST({ request }) {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    let event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        return new Response(err.message, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        try {
            await finalizeBooking(session.metadata);
        } catch (error) {
            console.error("Post-payment processing failed:", error);
            return new Response("Webhook Error", { status: 500 });
        }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}