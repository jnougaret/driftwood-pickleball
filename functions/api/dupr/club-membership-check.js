import { verifyClerkToken } from '../_auth.js';
import { fetchPartnerAccessToken, getDuprBase, getDuprEnv } from './_partner.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function readCookie(request, name) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const parts = cookieHeader.split(';');
    for (const part of parts) {
        const [rawKey, ...rawValue] = part.trim().split('=');
        if (rawKey === name) {
            return decodeURIComponent(rawValue.join('='));
        }
    }
    return '';
}

async function verifyFromHeaderOrSessionCookie(request) {
    let auth = await verifyClerkToken(request);
    if (!auth.error) return auth;

    const sessionToken = readCookie(request, '__session');
    if (!sessionToken) return auth;

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${sessionToken}`);
    const requestWithAuth = new Request(request, { headers });
    return await verifyClerkToken(requestWithAuth);
}

function getClubMembershipUrl(env, duprEnv, duprId) {
    const explicit = (env.DUPR_USER_CLUBS_URL || '').trim();
    if (explicit) {
        return explicit.replace('{duprId}', encodeURIComponent(String(duprId)));
    }
    return `${getDuprBase(duprEnv)}/api/user/v1.0/${encodeURIComponent(String(duprId))}/clubs`;
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, email, display_name, is_admin, dupr_id FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function fetchClubMembership(env, accessToken, duprEnv, duprId) {
    const endpoint = getClubMembershipUrl(env, duprEnv, duprId);
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return {
            ok: false,
            endpoint,
            error: 'Unable to reach DUPR club membership endpoint'
        };
    }

    const raw = await response.text();
    let parsed = null;
    try {
        parsed = raw ? JSON.parse(raw) : null;
    } catch (error) {
        parsed = raw;
    }

    if (!response.ok) {
        return {
            ok: false,
            endpoint,
            status: response.status,
            error: 'DUPR club membership lookup failed',
            response: parsed
        };
    }

    return {
        ok: true,
        endpoint,
        membership: Array.isArray(parsed?.membership) ? parsed.membership : []
    };
}

export async function onRequestGet({ request, env }) {
    const auth = await verifyFromHeaderOrSessionCookie(request);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

    const user = await getUserById(env, auth.userId);
    if (!user || !user.is_admin) return jsonResponse({ error: 'Forbidden' }, 403);
    if (!user.dupr_id) {
        return jsonResponse({ error: 'Current admin does not have a linked DUPR account' }, 400);
    }

    const token = await fetchPartnerAccessToken(env);
    if (!token.ok) {
        return jsonResponse({
            error: token.error || 'Unable to fetch partner token',
            details: token.response || null
        }, 502);
    }

    const duprEnv = token.environment || getDuprEnv(env);
    const membershipResult = await fetchClubMembership(env, token.accessToken, duprEnv, user.dupr_id);
    if (!membershipResult.ok) {
        return jsonResponse({
            error: membershipResult.error,
            endpoint: membershipResult.endpoint,
            status: membershipResult.status || null,
            details: membershipResult.response || null
        }, 502);
    }

    const configuredClubRaw = String(env.DUPR_CLUB_ID || '').trim();
    const configuredClubId = configuredClubRaw && Number.isInteger(Number(configuredClubRaw))
        ? Number(configuredClubRaw)
        : null;

    const clubs = membershipResult.membership.map(item => ({
        clubId: Number(item.clubId),
        clubName: item.clubName || '',
        role: String(item.role || '').toUpperCase()
    }));

    const targetClub = configuredClubId !== null
        ? clubs.find(item => item.clubId === configuredClubId) || null
        : null;

    const allowedToSubmit = Boolean(
        targetClub && (targetClub.role === 'DIRECTOR' || targetClub.role === 'ORGANIZER')
    );

    return jsonResponse({
        success: true,
        environment: duprEnv,
        endpoint: membershipResult.endpoint,
        user: {
            id: user.id,
            email: user.email || '',
            displayName: user.display_name || '',
            duprId: user.dupr_id,
            isAdmin: user.is_admin === 1
        },
        clubConfig: {
            duprClubId: configuredClubId,
            isConfigured: configuredClubId !== null
        },
        evaluation: {
            inConfiguredClub: Boolean(targetClub),
            configuredClubRole: targetClub ? targetClub.role : null,
            allowedToSubmit
        },
        memberships: clubs
    });
}
