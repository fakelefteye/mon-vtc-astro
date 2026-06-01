// src/pages/api/admin/login.ts
export const prerender = false;

import { createHash } from 'node:crypto';

function makeToken(password: string): string {
    const salt = import.meta.env.ADMIN_SALT || 'vtc-admin-salt-change-me';
    return createHash('sha256').update(password + ':' + salt).digest('hex');
}

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
    try {
        const { password } = await request.json();
        const expected = import.meta.env.ADMIN_PASSWORD;

        if (!expected) {
            return new Response(
                JSON.stringify({ error: 'ADMIN_PASSWORD non configuré dans les variables d\'environnement.' }),
                { status: 500 }
            );
        }

        if (password !== expected) {
            return new Response(JSON.stringify({ error: 'Mot de passe incorrect.' }), { status: 401 });
        }

        const token = makeToken(password);
        cookies.set('admin_session', token, {
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'strict',
            maxAge: 60 * 60 * 8, // 8 heures
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch {
        return new Response(JSON.stringify({ error: 'Requête invalide.' }), { status: 400 });
    }
};
