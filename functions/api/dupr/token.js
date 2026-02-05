import { verifyClerkToken } from '../_auth.js';

// Isolate-local cache (best effort). Cloudflare may evict/restart isolates at any time.
let tokenCache = {
    environment: null,
    accessToken: null,
    expiresAtMs: 0
};

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function ensureRateLimitTable(env) {
    await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at DATETIME NOT NULL)'
    ).run();
}

async function checkRateLimit(env, key, limit = 20, windowSeconds = 60) {
    await ensureRateLimitTable(env);
    const now = new Date();
    const existing = await env.DB.prepare(
        'SELECT count, reset_at FROM rate_limits WHERE key = ?'
    ).bind(key).first();

    if (!existing) {
        const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
        await env.DB.prepare(
            'INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)'
        ).bind(key, 1, resetAt).run();
        return { allowed: true };
    }

    const resetAt = new Date(existing.reset_at);
    if (resetAt <= now) {
        const nextReset = new Date(now.getTime() + windowSeconds * 1000).toISOString();
        await env.DB.prepare(
            'UPDATE rate_limits SET count = ?, reset_at = ? WHERE key = ?'
        ).bind(1, nextReset, key).run();
        return { allowed: true };
    }

    if (existing.count >= limit) {
        return { allowed: false, retryAt: resetAt.toISOString() };
    }

    await env.DB.prepare(
        'UPDATE rate_limits SET count = count + 1 WHERE key = ?'
    ).bind(key).run();
    return { allowed: true };
}

function getDuprEnv(env) {
    const requested = String(env.DUPR_ENV || 'uat').toLowerCase();
    return requested === 'prod' ? 'prod' : 'uat';
}

function getTokenUrl(env, duprEnv) {
    const explicit = (env.DUPR_TOKEN_URL || '').trim();
    if (explicit) return explicit;
    return duprEnv === 'prod'
        ? 'https://prod.mydupr.com/api/token'
        : 'https://uat.mydupr.com/api/token';
}

function base64Encode(value) {
    try {
        return btoa(value);
    } catch (error) {
        return null;
    }
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

function readCachedToken(duprEnv) {
    const now = Date.now();
    // Keep a safety window so callers do not receive near-expiry tokens.
    const safetyWindowMs = 60 * 1000;
    if (
        tokenCache.environment === duprEnv
        && tokenCache.accessToken
        && tokenCache.expiresAtMs - now > safetyWindowMs
    ) {
        return {
            accessToken: tokenCache.accessToken,
            expiresIn: Math.floor((tokenCache.expiresAtMs - now) / 1000),
            expiresAt: new Date(tokenCache.expiresAtMs).toISOString()
        };
    }
    return null;
}

function writeCachedToken(duprEnv, accessToken, expiresIn) {
    const expiresAtMs = Date.now() + (expiresIn * 1000);
    tokenCache = {
        environment: duprEnv,
        accessToken,
        expiresAtMs
    };
    return new Date(expiresAtMs).toISOString();
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

export async function onRequestPost({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getUserById(env, auth.userId);
    if (!requester || !requester.is_admin) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const clientKey = (env.DUPR_CLIENT_KEY || '').trim();
    const clientSecret = (env.DUPR_CLIENT_SECRET || '').trim();
    if (!clientKey || !clientSecret) {
        return jsonResponse({ error: 'DUPR client key/secret not configured' }, 500);
    }

    const duprEnv = getDuprEnv(env);
    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        body = {};
    }
    const forceRefresh = body && body.forceRefresh === true;

    const rateKey = forceRefresh
        ? `dupr-token-force:${auth.userId}`
        : `dupr-token:${auth.userId}`;
    const rate = await checkRateLimit(env, rateKey, forceRefresh ? 5 : 30, 60);
    if (!rate.allowed) {
        return jsonResponse({
            error: 'Rate limit exceeded',
            retryAt: rate.retryAt
        }, 429);
    }

    if (!forceRefresh) {
        const cached = readCachedToken(duprEnv);
        if (cached) {
            return jsonResponse({
                environment: duprEnv,
                accessToken: cached.accessToken,
                expiresIn: cached.expiresIn,
                expiresAt: cached.expiresAt,
                source: 'cache'
            });
        }
    }

    const tokenUrl = getTokenUrl(env, duprEnv);
    const encoded = base64Encode(`${clientKey}:${clientSecret}`);
    if (!encoded) {
        return jsonResponse({ error: 'Failed to encode DUPR client credentials' }, 500);
    }

    let upstream;
    try {
        upstream = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'x-authorization': encoded
            }
        });
    } catch (error) {
        return jsonResponse({ error: 'Unable to reach DUPR auth endpoint' }, 502);
    }

    let payload = null;
    try {
        payload = await upstream.json();
    } catch (error) {
        payload = null;
    }

    if (!upstream.ok) {
        return jsonResponse({
            error: 'DUPR auth request failed',
            upstreamStatus: upstream.status
        }, 502);
    }

    const { accessToken, expiresIn } = normalizeTokenResponse(payload);
    if (!accessToken) {
        return jsonResponse({ error: 'DUPR response missing access token' }, 502);
    }

    const expiresAt = writeCachedToken(duprEnv, accessToken, expiresIn);
    return jsonResponse({
        environment: duprEnv,
        accessToken,
        expiresIn,
        expiresAt,
        source: 'upstream'
    });
}
