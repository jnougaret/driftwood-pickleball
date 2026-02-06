export function getDuprEnv(env) {
    const requested = String(env.DUPR_ENV || 'uat').toLowerCase();
    return requested === 'prod' ? 'prod' : 'uat';
}

export function getDuprBase(duprEnv) {
    return duprEnv === 'prod'
        ? 'https://prod.mydupr.com'
        : 'https://uat.mydupr.com';
}

function getTokenUrl(env, duprEnv) {
    const explicit = (env.DUPR_TOKEN_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/auth/v1.0/token`;
}

function getWebhookRegisterUrl(env, duprEnv) {
    const explicit = (env.DUPR_WEBHOOK_REGISTER_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/v1.0/webhook`;
}

function getSubscribePlayerUrl(env, duprEnv) {
    const explicit = (env.DUPR_SUBSCRIBE_PLAYER_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/v1.0/subscribe/rating-changes`;
}

function normalizeTokenResponse(payload) {
    if (!payload || typeof payload !== 'object') {
        return { accessToken: null, expiresIn: null };
    }
    const accessToken = payload.accessToken
        || payload.access_token
        || payload.token
        || payload.jwt
        || null;
    const expiresInRaw = payload.expiresIn
        || payload.expires_in
        || payload.expires
        || null;
    const expiresIn = Number.isFinite(Number(expiresInRaw)) ? Number(expiresInRaw) : 3600;
    return { accessToken, expiresIn };
}

function asJson(payload) {
    try {
        return JSON.stringify(payload);
    } catch (error) {
        return '';
    }
}

async function parseResponse(response) {
    const rawText = await response.text();
    if (!rawText) return { rawText: '', json: null };
    try {
        return { rawText, json: JSON.parse(rawText) };
    } catch (error) {
        return { rawText, json: null };
    }
}

function encodeBasicAuth(clientKey, clientSecret) {
    try {
        return btoa(`${clientKey}:${clientSecret}`);
    } catch (error) {
        return null;
    }
}

export async function fetchPartnerAccessToken(env) {
    const clientKey = (env.DUPR_CLIENT_KEY || '').trim();
    const clientSecret = (env.DUPR_CLIENT_SECRET || '').trim();
    if (!clientKey || !clientSecret) {
        return { ok: false, error: 'DUPR client key/secret not configured' };
    }

    const duprEnv = getDuprEnv(env);
    const tokenUrl = getTokenUrl(env, duprEnv);
    const encoded = encodeBasicAuth(clientKey, clientSecret);
    if (!encoded) {
        return { ok: false, error: 'Failed to encode DUPR credentials' };
    }

    let response;
    try {
        response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'x-authorization': encoded
            }
        });
    } catch (error) {
        return { ok: false, error: 'Unable to reach DUPR token endpoint' };
    }

    const parsed = await parseResponse(response);
    if (!response.ok) {
        return {
            ok: false,
            error: 'DUPR token request failed',
            status: response.status,
            response: parsed.json || parsed.rawText
        };
    }

    const normalized = normalizeTokenResponse(parsed.json);
    if (!normalized.accessToken) {
        return {
            ok: false,
            error: 'DUPR token response missing access token',
            response: parsed.json || parsed.rawText
        };
    }

    return {
        ok: true,
        environment: duprEnv,
        accessToken: normalized.accessToken,
        expiresIn: normalized.expiresIn
    };
}

export async function registerWebhook(env, webhookUrl, topics) {
    const token = await fetchPartnerAccessToken(env);
    if (!token.ok) return token;

    const clientId = (env.DUPR_CLIENT_KEY || '').trim();
    const duprEnv = token.environment;
    const url = getWebhookRegisterUrl(env, duprEnv);
    const payload = {
        clientId,
        webhookUrl,
        topics
    };

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.accessToken}`
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        return { ok: false, error: 'Unable to reach DUPR webhook register endpoint' };
    }

    const parsed = await parseResponse(response);
    return {
        ok: response.ok,
        status: response.status,
        environment: duprEnv,
        endpoint: url,
        request: payload,
        response: parsed.json || parsed.rawText || null,
        responseText: parsed.rawText || '',
        responseJson: parsed.json
    };
}

export async function subscribePlayerRating(env, duprId) {
    const trimmedDuprId = String(duprId || '').trim();
    if (!trimmedDuprId) {
        return { ok: false, skipped: true, error: 'Missing DUPR id' };
    }

    const token = await fetchPartnerAccessToken(env);
    if (!token.ok) return token;

    const duprEnv = token.environment;
    const subscribeUrl = getSubscribePlayerUrl(env, duprEnv);
    if (!subscribeUrl) {
        return {
            ok: false,
            skipped: true,
            error: 'DUPR_SUBSCRIBE_PLAYER_URL is not configured'
        };
    }

    const payload = [trimmedDuprId];

    let response;
    try {
        response = await fetch(subscribeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.accessToken}`
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        return { ok: false, error: 'Unable to reach DUPR subscribe endpoint' };
    }

    const parsed = await parseResponse(response);
    return {
        ok: response.ok,
        status: response.status,
        environment: duprEnv,
        endpoint: subscribeUrl,
        request: payload,
        response: parsed.json || parsed.rawText || null,
        responseText: parsed.rawText || '',
        responseJson: parsed.json
    };
}

export async function ensureDuprSubscriptionTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS dupr_player_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            dupr_id TEXT NOT NULL,
            topic TEXT NOT NULL DEFAULT 'RATING',
            dupr_env TEXT NOT NULL DEFAULT 'uat',
            status TEXT NOT NULL,
            last_http_status INTEGER,
            last_response TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, dupr_id, topic, dupr_env)
        )
    `).run();
}

export async function upsertDuprSubscription(env, record) {
    await ensureDuprSubscriptionTable(env);
    await env.DB.prepare(`
        INSERT INTO dupr_player_subscriptions (
            user_id, dupr_id, topic, dupr_env, status, last_http_status, last_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, dupr_id, topic, dupr_env) DO UPDATE SET
            status = excluded.status,
            last_http_status = excluded.last_http_status,
            last_response = excluded.last_response,
            updated_at = CURRENT_TIMESTAMP
    `).bind(
        record.userId,
        record.duprId,
        record.topic || 'RATING',
        record.duprEnv || 'uat',
        record.status,
        record.lastHttpStatus ?? null,
        asJson(record.lastResponse)
    ).run();
}
