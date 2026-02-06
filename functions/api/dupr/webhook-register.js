import { verifyClerkToken } from '../_auth.js';
import { registerWebhook } from './_partner.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function ensureRegistrationTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS dupr_webhook_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_by TEXT NOT NULL,
            webhook_url TEXT NOT NULL,
            topics_json TEXT NOT NULL,
            status_code INTEGER,
            response TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, email, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

function parseTopics(value) {
    if (!Array.isArray(value)) return null;
    const topics = value
        .map(item => String(item || '').trim())
        .filter(Boolean);
    if (!topics.length) return null;
    return topics;
}

export async function onRequestPost({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getUserById(env, auth.userId);
    const masterEmail = String(env.MASTER_ADMIN_EMAIL || '').toLowerCase();
    const requesterEmail = String(requester?.email || '').toLowerCase();
    const isMasterAdmin = Boolean(masterEmail && requesterEmail && requesterEmail === masterEmail);
    if (!requester || !requester.is_admin || !isMasterAdmin) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        body = {};
    }

    const webhookUrl = String(
        body.webhookUrl || env.DUPR_WEBHOOK_URL || ''
    ).trim();
    if (!webhookUrl) {
        return jsonResponse({ error: 'Missing webhook URL' }, 400);
    }
    if (!/^https:\/\//i.test(webhookUrl)) {
        return jsonResponse({ error: 'Webhook URL must be HTTPS' }, 400);
    }

    const topics = parseTopics(body.topics) || ['RATING', 'REGISTRATION'];
    const registration = await registerWebhook(env, webhookUrl, topics);

    await ensureRegistrationTable(env);
    await env.DB.prepare(`
        INSERT INTO dupr_webhook_registrations (
            created_by, webhook_url, topics_json, status_code, response
        ) VALUES (?, ?, ?, ?, ?)
    `).bind(
        auth.userId,
        webhookUrl,
        JSON.stringify(topics),
        registration.status || null,
        JSON.stringify(registration.response || registration.error || null)
    ).run();

    if (!registration.ok) {
        return jsonResponse({
            error: registration.error || 'Webhook registration failed',
            details: registration.response || null,
            endpoint: registration.endpoint || null,
            status: registration.status || null
        }, 502);
    }

    return jsonResponse({
        success: true,
        environment: registration.environment,
        endpoint: registration.endpoint,
        request: registration.request,
        response: registration.response
    });
}

