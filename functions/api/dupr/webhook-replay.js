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

function toNumberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseRatingPayload(raw) {
    if (!raw) return null;
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return null;
    }

    const event = String(parsed?.event || parsed?.topic || '').toUpperCase();
    if (event !== 'RATING') return null;

    const message = parsed?.message && typeof parsed.message === 'object'
        ? parsed.message
        : (parsed?.request && typeof parsed.request === 'object' ? parsed.request : null);
    if (!message) return null;

    const duprId = String(message.duprId || message.dupr_id || '').trim();
    const rating = message.rating && typeof message.rating === 'object' ? message.rating : null;
    const doubles = toNumberOrNull(rating?.doubles);
    const singles = toNumberOrNull(rating?.singles);
    if (!duprId || (doubles === null && singles === null)) return null;

    return { duprId, doubles, singles };
}

export async function onRequestPost({ request, env }) {
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
    const rows = await env.DB.prepare(
        `SELECT id, payload
         FROM dupr_webhook_events
         WHERE processed = 0
         ORDER BY id ASC
         LIMIT 100`
    ).all();
    const events = rows.results || [];

    let updatedUsers = 0;
    let markedProcessed = 0;
    for (const event of events) {
        const parsed = parseRatingPayload(event.payload);
        let processed = false;
        if (parsed) {
            const update = await env.DB.prepare(
                `UPDATE users
                 SET doubles_rating = COALESCE(?, doubles_rating),
                     singles_rating = COALESCE(?, singles_rating),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE dupr_id = ?`
            ).bind(
                parsed.doubles,
                parsed.singles,
                parsed.duprId
            ).run();
            const changes = Number(update?.meta?.changes || 0);
            if (changes > 0) {
                updatedUsers += changes;
                processed = true;
            }
        }
        if (processed) {
            await env.DB.prepare(
                'UPDATE dupr_webhook_events SET processed = 1 WHERE id = ?'
            ).bind(event.id).run();
            markedProcessed += 1;
        }
    }

    return jsonResponse({
        success: true,
        scannedEvents: events.length,
        markedProcessed,
        updatedUsers
    });
}
