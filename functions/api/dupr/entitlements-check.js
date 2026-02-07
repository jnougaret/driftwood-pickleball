import { verifyClerkToken } from '../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function getDuprEnv(env) {
    const requested = String(env.DUPR_ENV || 'uat').toLowerCase();
    return requested === 'prod' ? 'prod' : 'uat';
}

function getDefaultBasicInfoUrl(duprEnv) {
    return duprEnv === 'prod'
        ? 'https://api.dupr.gg/public/getBasicInfo'
        : 'https://api.uat.dupr.gg/public/getBasicInfo';
}

function parseEntitlements(source) {
    const raw = source?.entitlements
        ?? source?.stats?.entitlements
        ?? source?.permissions
        ?? source?.features
        ?? [];
    const values = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object' ? Object.keys(raw).filter(key => raw[key]) : []);
    const normalized = values
        .map(value => String(value || '').trim().toUpperCase())
        .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    return {
        values: unique,
        premiumL1: unique.includes('PREMIUM_L1'),
        verifiedL1: unique.includes('VERIFIED_L1')
    };
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        `SELECT
            id,
            dupr_id,
            dupr_premium_l1,
            dupr_verified_l1,
            dupr_entitlements_json,
            dupr_entitlements_checked_at
         FROM users
         WHERE id = ?`
    ).bind(userId).first();
}

async function updateCachedEntitlements(env, userId, entitlements, duprId) {
    await env.DB.prepare(
        `UPDATE users
         SET dupr_id = COALESCE(?, dupr_id),
             dupr_premium_l1 = ?,
             dupr_verified_l1 = ?,
             dupr_entitlements_json = ?,
             dupr_entitlements_checked_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(
        duprId || null,
        entitlements.premiumL1 ? 1 : 0,
        entitlements.verifiedL1 ? 1 : 0,
        JSON.stringify(entitlements.values),
        userId
    ).run();
}

function serializeUserEntitlements(user, source = 'cache') {
    let rawValues = [];
    try {
        rawValues = user?.dupr_entitlements_json ? JSON.parse(user.dupr_entitlements_json) : [];
    } catch (error) {
        rawValues = [];
    }
    const values = Array.isArray(rawValues) ? rawValues : [];
    return {
        source,
        duprId: user?.dupr_id || null,
        premiumL1: user?.dupr_premium_l1 === 1,
        verifiedL1: user?.dupr_verified_l1 === 1,
        entitlements: values,
        checkedAt: user?.dupr_entitlements_checked_at || null
    };
}

async function refreshFromUserToken(env, userId, userToken) {
    const duprEnv = getDuprEnv(env);
    const basicInfoUrl = (env.DUPR_BASIC_INFO_URL || '').trim() || getDefaultBasicInfoUrl(duprEnv);

    let upstream;
    try {
        upstream = await fetch(basicInfoUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
    } catch (error) {
        return { ok: false, status: 502, error: 'Unable to reach DUPR basic info endpoint' };
    }

    let payload = null;
    try {
        payload = await upstream.json();
    } catch (error) {
        payload = null;
    }

    if (!upstream.ok || !payload || typeof payload !== 'object') {
        return {
            ok: false,
            status: 502,
            error: 'Failed to fetch DUPR profile from user token',
            upstreamStatus: upstream.status
        };
    }

    const duprId = payload.duprId || payload.dupr_id || payload.id || null;
    const entitlements = parseEntitlements(payload);
    await updateCachedEntitlements(env, userId, entitlements, duprId);
    const user = await getUserById(env, userId);
    return { ok: true, user };
}

export async function onRequestPost({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        body = {};
    }

    const userToken = typeof body.userToken === 'string' ? body.userToken.trim() : '';
    if (userToken) {
        const refreshed = await refreshFromUserToken(env, auth.userId, userToken);
        if (!refreshed.ok) {
            return jsonResponse({ error: refreshed.error, upstreamStatus: refreshed.upstreamStatus || null }, refreshed.status);
        }
        return jsonResponse({ success: true, entitlements: serializeUserEntitlements(refreshed.user, 'token') });
    }

    const user = await getUserById(env, auth.userId);
    if (!user) return jsonResponse({ error: 'Profile not found' }, 404);
    return jsonResponse({ success: true, entitlements: serializeUserEntitlements(user, 'cache') });
}

export async function onRequestGet({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }
    const user = await getUserById(env, auth.userId);
    if (!user) return jsonResponse({ error: 'Profile not found' }, 404);
    return jsonResponse({ success: true, entitlements: serializeUserEntitlements(user, 'cache') });
}

