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

async function ensureAdminAllowlistTable(env) {
    await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS admin_allowlist (
            email TEXT PRIMARY KEY,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ).run();
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

    const targetEmail = String(body.email || '').trim().toLowerCase();
    if (!targetEmail) {
        return jsonResponse({ error: 'Email is required' }, 400);
    }

    await ensureAdminAllowlistTable(env);

    await env.DB.prepare(
        `INSERT INTO admin_allowlist (email, created_by)
         VALUES (?, ?)
         ON CONFLICT(email) DO UPDATE SET created_by = excluded.created_by`
    ).bind(targetEmail, requester.id).run();

    const target = await getUserByEmail(env, targetEmail);
    if (target) {
        await env.DB.prepare(
            'UPDATE users SET is_admin = 1 WHERE id = ?'
        ).bind(target.id).run();
    }

    return jsonResponse({ success: true });
}
