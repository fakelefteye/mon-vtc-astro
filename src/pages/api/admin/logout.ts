// src/pages/api/admin/logout.ts
export const prerender = false;

export const POST = async ({ cookies }: { cookies: any }) => {
    cookies.delete('admin_session', { path: '/' });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
