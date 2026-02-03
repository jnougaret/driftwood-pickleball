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

async function ensureAdminAllowlistTable(env) {
    await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS admin_allowlist (
            email TEXT PRIMARY KEY,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ).run();
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

    await ensureAdminAllowlistTable(env);

    const admins = await env.DB.prepare(
        `SELECT id, email, display_name, has_account FROM (
            SELECT u.id AS id,
                   u.email AS email,
                   u.display_name AS display_name,
                   1 AS has_account
            FROM users u
            WHERE u.is_admin = 1
            UNION
            SELECT NULL AS id,
                   a.email AS email,
                   NULL AS display_name,
                   0 AS has_account
            FROM admin_allowlist a
            WHERE NOT EXISTS (
                SELECT 1
                FROM users u
                WHERE LOWER(u.email) = LOWER(a.email)
            )
        )
        ORDER BY LOWER(email) ASC`
    ).all();

    return jsonResponse({ admins: admins.results || [], masterEmail });
}
