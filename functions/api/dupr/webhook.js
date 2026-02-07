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

function parseWebhookPayload(rawText) {
    try {
        return rawText ? JSON.parse(rawText) : null;
    } catch (error) {
        return null;
    }
}

function parseRatingEvent(parsed) {
    const event = String(parsed?.event || parsed?.topic || '').toUpperCase();
    if (event !== 'RATING') {
        return { supported: false, reason: 'not-rating' };
    }

    const message = parsed?.message && typeof parsed.message === 'object'
        ? parsed.message
        : (parsed?.request && typeof parsed.request === 'object' ? parsed.request : null);
    if (!message) {
        return { supported: false, reason: 'missing-message' };
    }

    const duprId = String(message.duprId || message.dupr_id || '').trim();
    const rating = message.rating && typeof message.rating === 'object' ? message.rating : null;
    const doubles = toNumberOrNull(rating?.doubles);
    const singles = toNumberOrNull(rating?.singles);

    if (!duprId || (doubles === null && singles === null)) {
        return { supported: false, reason: 'missing-dupr-or-ratings' };
    }

    return {
        supported: true,
        duprId,
        doubles,
        singles
    };
}

async function applyRatingUpdate(env, parsed) {
    const extracted = parseRatingEvent(parsed);
    if (!extracted.supported) return { applied: false, reason: extracted.reason };

    const result = await env.DB.prepare(
        `UPDATE users
         SET doubles_rating = COALESCE(?, doubles_rating),
             singles_rating = COALESCE(?, singles_rating),
             updated_at = CURRENT_TIMESTAMP
         WHERE dupr_id = ?`
    ).bind(
        extracted.doubles,
        extracted.singles,
        extracted.duprId
    ).run();

    const changes = Number(result?.meta?.changes || 0);
    return {
        applied: changes > 0,
        reason: changes > 0 ? 'updated' : 'dupr-id-not-found',
        duprId: extracted.duprId,
        doubles: extracted.doubles,
        singles: extracted.singles,
        changes
    };
}

export async function onRequestGet() {
    // DUPR registration validation expects 200 OK on GET.
    return jsonResponse({ ok: true, endpoint: 'dupr-webhook' }, 200);
}

export async function onRequestPost({ request, env }) {
    // DUPR registration + webhook delivery expects 200 OK on POST.
    // We persist payload best-effort and still return 200.
    let raw = '';
    let parsed = null;
    try {
        raw = await request.text();
        parsed = parseWebhookPayload(raw);
    } catch (error) {
        parsed = null;
    }

    let insertedId = null;
    try {
        await ensureWebhookTables(env);
        const inserted = await env.DB.prepare(`
            INSERT INTO dupr_webhook_events (client_id, topic, event, payload)
            VALUES (?, ?, ?, ?)
        `).bind(
            parsed?.clientId || parsed?.client_id || null,
            parsed?.topic || null,
            parsed?.event || null,
            raw || '{}'
        ).run();
        insertedId = inserted?.meta?.last_row_id ?? null;

        const syncResult = await applyRatingUpdate(env, parsed);
        if (insertedId !== null) {
            const processedFlag = syncResult.applied ? 1 : 0;
            await env.DB.prepare(
                `UPDATE dupr_webhook_events
                 SET processed = ?
                 WHERE id = ?`
            ).bind(processedFlag, insertedId).run();
        }
    } catch (error) {
        console.error('DUPR webhook persistence failed:', error);
    }

    return jsonResponse({ ok: true }, 200);
}
