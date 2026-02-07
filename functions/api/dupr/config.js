function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function base64Encode(value) {
    try {
        return btoa(value);
    } catch (error) {
        // Cloudflare Workers runtime supports btoa; this is a defensive fallback.
        return null;
    }
}

export async function onRequestGet({ env }) {
    const clientKey = (env.DUPR_CLIENT_KEY || '').trim();
    const requestedEnv = String(env.DUPR_ENV || 'uat').toLowerCase();
    const duprEnv = requestedEnv === 'prod' ? 'prod' : 'uat';

    if (!clientKey) {
        return jsonResponse({ error: 'DUPR client key is not configured' }, 500);
    }

    const encoded = base64Encode(clientKey);
    if (!encoded) {
        return jsonResponse({ error: 'Failed to encode DUPR client key' }, 500);
    }

    const linkBase = duprEnv === 'prod'
        ? 'https://dashboard.dupr.com/login-external-app'
        : 'https://uat.dupr.gg/login-external-app';

    const allowedOrigins = duprEnv === 'prod'
        ? ['https://dashboard.dupr.com']
        : ['https://uat.dupr.gg'];

    const premiumLinkUrl = (env.DUPR_PREMIUM_LOGIN_URL || '').trim() || `${linkBase}/${encoded}`;
    const verifiedLinkUrl = (env.DUPR_VERIFIED_LOGIN_URL || '').trim() || premiumLinkUrl;

    return jsonResponse({
        environment: duprEnv,
        linkUrl: `${linkBase}/${encoded}`,
        premiumLinkUrl,
        verifiedLinkUrl,
        allowedOrigins
    });
}
