import { verifyClerkToken } from '../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, email, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

export async function onRequestGet({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getUserById(env, auth.userId);
    if (!requester) {
        return jsonResponse({ error: 'Requester profile not found' }, 400);
    }

    const masterEmail = env.MASTER_ADMIN_EMAIL || '';
    const isMasterAdmin = masterEmail &&
        requester.email.toLowerCase() === masterEmail.toLowerCase();
    if (!isMasterAdmin) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const admins = await env.DB.prepare(
        'SELECT id, email, display_name FROM users WHERE is_admin = 1 ORDER BY email ASC'
    ).all();

    return jsonResponse({ admins: admins.results || [], masterEmail });
}
