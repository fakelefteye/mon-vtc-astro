// src/pages/api/admin/pricing.ts
export const prerender = false;

import { createHash } from 'node:crypto';
import { getPricing, savePricing } from '@/lib/pricing';
import type { PricingConfig } from '@/config/site.config';

function isAuthenticated(cookies: any): boolean {
    const token = cookies.get('admin_session')?.value;
    if (!token) return false;
    const password = import.meta.env.ADMIN_PASSWORD;
    if (!password) return false;
    const salt = import.meta.env.ADMIN_SALT || 'vtc-admin-salt-change-me';
    const expected = createHash('sha256').update(password + ':' + salt).digest('hex');
    return token === expected;
}

export const GET = async ({ cookies }: { cookies: any }) => {
    if (!isAuthenticated(cookies)) {
        return new Response(JSON.stringify({ error: 'Non autorisé.' }), { status: 401 });
    }
    const pricing = await getPricing();
    return new Response(JSON.stringify(pricing), { status: 200 });
};

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
    if (!isAuthenticated(cookies)) {
        return new Response(JSON.stringify({ error: 'Non autorisé.' }), { status: 401 });
    }
    try {
        const data = (await request.json()) as PricingConfig;

        // Validation des valeurs
        if (
            typeof data.pricePerKm !== 'number' || data.pricePerKm < 0 ||
            typeof data.pricePerMinute !== 'number' || data.pricePerMinute < 0 ||
            typeof data.minimumPrice !== 'number' || data.minimumPrice < 0 ||
            typeof data.nightSurchargePercent !== 'number' || data.nightSurchargePercent < 0
        ) {
            return new Response(
                JSON.stringify({ error: 'Valeurs de tarification invalides.' }),
                { status: 400 }
            );
        }

        const result = await savePricing(data);
        if (!result.ok) {
            return new Response(
                JSON.stringify({
                    error: result.error ?? 'Échec de la sauvegarde.',
                    hint: 'Vérifiez que BLOB_READ_WRITE_TOKEN est bien configuré dans Vercel.',
                }),
                { status: 500 }
            );
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch {
        return new Response(JSON.stringify({ error: 'Requête invalide.' }), { status: 400 });
    }
};
