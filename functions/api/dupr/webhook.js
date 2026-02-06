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
        parsed = raw ? JSON.parse(raw) : null;
    } catch (error) {
        parsed = null;
    }

    try {
        await ensureWebhookTables(env);
        await env.DB.prepare(`
            INSERT INTO dupr_webhook_events (client_id, topic, event, payload)
            VALUES (?, ?, ?, ?)
        `).bind(
            parsed?.clientId || parsed?.client_id || null,
            parsed?.topic || null,
            parsed?.event || null,
            raw || '{}'
        ).run();
    } catch (error) {
        console.error('DUPR webhook persistence failed:', error);
    }

    return jsonResponse({ ok: true }, 200);
}

