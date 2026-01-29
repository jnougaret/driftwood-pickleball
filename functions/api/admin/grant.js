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

async function getUserByEmail(env, email) {
    return await env.DB.prepare(
        'SELECT id, email, is_admin FROM users WHERE LOWER(email) = LOWER(?)'
    ).bind(email).first();
}

export async function onRequestPost({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getUserById(env, auth.userId);
    if (!requester) {
        return jsonResponse({ error: 'Requester profile not found' }, 400);
    }

    const isMasterAdmin = env.MASTER_ADMIN_EMAIL &&
        requester.email.toLowerCase() === env.MASTER_ADMIN_EMAIL.toLowerCase();
    if (!isMasterAdmin) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const targetEmail = body.email;
    if (!targetEmail) {
        return jsonResponse({ error: 'Email is required' }, 400);
    }

    const target = await getUserByEmail(env, targetEmail);
    if (!target) {
        return jsonResponse({ error: 'User not found' }, 404);
    }

    await env.DB.prepare(
        'UPDATE users SET is_admin = 1 WHERE id = ?'
    ).bind(target.id).run();

    return jsonResponse({ success: true });
}
