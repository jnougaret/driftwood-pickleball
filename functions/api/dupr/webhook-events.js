import { verifyClerkToken } from '../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function ensureWebhookTables(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS dupr_webhook_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT,
            topic TEXT,
            event TEXT,
            payload TEXT NOT NULL,
            processed INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

function summarizePayload(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        const message = parsed?.message && typeof parsed.message === 'object' ? parsed.message : null;
        return {
            event: parsed?.event || parsed?.topic || null,
            duprId: message?.duprId || message?.dupr_id || null,
            hasRating: Boolean(message?.rating)
        };
    } catch (error) {
        return { parseError: true };
    }
}

export async function onRequestGet({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const user = await env.DB.prepare(
        'SELECT id, is_admin FROM users WHERE id = ?'
    ).bind(auth.userId).first();
    if (!user || user.is_admin !== 1) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    await ensureWebhookTables(env);
    const result = await env.DB.prepare(
        `SELECT id, client_id, topic, event, processed, payload, created_at
         FROM dupr_webhook_events
         ORDER BY id DESC
         LIMIT 200`
    ).all();
    const rows = result.results || [];

    return jsonResponse({
        success: true,
        count: rows.length,
        events: rows.map(row => ({
            id: row.id,
            clientId: row.client_id,
            topic: row.topic,
            event: row.event,
            processed: row.processed === 1,
            createdAt: row.created_at,
            summary: summarizePayload(row.payload)
        }))
    });
}
