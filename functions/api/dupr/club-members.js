import { verifyClerkToken } from '../_auth.js';
import {
    ensureRequesterCanSubmitToConfiguredClub,
    getRequester,
    jsonResponse
} from './_submitted_matches.js';
import { getDuprBase } from './_partner.js';

function getClubMembersUrl(env, duprEnv) {
    const explicit = String(env.DUPR_CLUB_MEMBERS_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/club/v1.0/members`;
}

export async function onRequestPost({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getRequester(env, auth.userId);
    if (!requester || requester.is_admin !== 1) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const access = await ensureRequesterCanSubmitToConfiguredClub(env, requester);
    if (!access.ok) {
        return jsonResponse({ error: access.error, details: access.details || null }, access.status);
    }

    const endpoint = getClubMembersUrl(env, access.duprEnv);
    const payload = { clubId: access.configuredClubId };
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        return jsonResponse({ error: 'Unable to reach DUPR club members endpoint' }, 502);
    }

    const text = await response.text();
    let responseBody = null;
    try {
        responseBody = text ? JSON.parse(text) : null;
    } catch (error) {
        responseBody = text;
    }
    if (!response.ok) {
        return jsonResponse({
            error: 'DUPR club members lookup failed',
            status: response.status,
            details: responseBody
        }, 502);
    }

    return jsonResponse({
        success: true,
        environment: access.duprEnv,
        endpoint,
        clubId: access.configuredClubId,
        response: responseBody
    });
}
