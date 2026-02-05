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

function pickToken(body) {
    if (!body || typeof body !== 'object') return null;
    const token = body.userToken || body.accessToken || body.token || null;
    return token && typeof token === 'string' ? token.trim() : null;
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
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const userToken = pickToken(body);
    if (!userToken) {
        return jsonResponse({ error: 'userToken is required' }, 400);
    }

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
        return jsonResponse({ error: 'Unable to reach DUPR basic info endpoint' }, 502);
    }

    let payload = null;
    try {
        payload = await upstream.json();
    } catch (error) {
        payload = null;
    }

    if (!upstream.ok) {
        return jsonResponse({
            error: 'DUPR basic info request failed',
            upstreamStatus: upstream.status,
            details: payload
        }, 502);
    }

    return jsonResponse({
        environment: duprEnv,
        profile: payload
    });
}

