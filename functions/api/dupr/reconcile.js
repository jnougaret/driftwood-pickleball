import { verifyClerkToken } from '../_auth.js';
import {
    ensureRequesterCanSubmitToConfiguredClub,
    getRequester,
    jsonResponse,
    listSubmittedMatches
} from './_submitted_matches.js';
import { getDuprBase } from './_partner.js';

function toEpochSeconds(input, fallback) {
    if (typeof input === 'number' && Number.isFinite(input)) {
        return Math.max(0, Math.floor(input));
    }
    if (typeof input === 'string' && input.trim()) {
        const num = Number(input.trim());
        if (Number.isFinite(num)) return Math.max(0, Math.floor(num));
        const date = new Date(input);
        if (!Number.isNaN(date.getTime())) return Math.floor(date.getTime() / 1000);
    }
    return fallback;
}

function getClubMatchSearchUrl(env, duprEnv) {
    const explicit = String(env.DUPR_CLUB_MATCH_SEARCH_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/club/v1.0/match/search`;
}

function normalizeRemoteMatch(remote) {
    if (!remote || typeof remote !== 'object') return null;
    const identifier = remote.identifier || remote.matchIdentifier || null;
    const matchIdRaw = remote.matchId ?? remote.id ?? null;
    const matchCode = remote.matchCode || remote.code || null;
    const matchId = Number.isInteger(Number(matchIdRaw)) ? Number(matchIdRaw) : null;
    return {
        identifier: identifier ? String(identifier).trim() : null,
        matchId,
        matchCode: matchCode ? String(matchCode).trim() : null
    };
}

function getRemoteMatches(payload) {
    if (!payload || typeof payload !== 'object') return [];
    const candidates = [
        payload.result,
        payload.matches,
        payload.data,
        payload.items
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
        if (candidate && typeof candidate === 'object') {
            if (Array.isArray(candidate.matches)) return candidate.matches;
            if (Array.isArray(candidate.items)) return candidate.items;
            if (Array.isArray(candidate.result)) return candidate.result;
        }
    }
    return [];
}

export async function onRequestPost({ request, env }) {
    try {
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

        let body = {};
        try {
            body = await request.json();
        } catch (error) {
            body = {};
        }

        const nowEpoch = Math.floor(Date.now() / 1000);
        const defaultStart = nowEpoch - (180 * 24 * 60 * 60);
        const startDate = toEpochSeconds(body.startDate, defaultStart);
        const endDate = toEpochSeconds(body.endDate, nowEpoch);
        const offset = Number.isInteger(body.offset) ? Math.max(0, body.offset) : 0;
        const limit = Number.isInteger(body.limit) ? Math.max(1, Math.min(100, body.limit)) : 50;

        const endpoint = getClubMatchSearchUrl(env, access.duprEnv);
        const searchPayload = {
            offset,
            limit,
            eventFormat: ['DOUBLES', 'SINGLES'],
            startDate,
            endDate,
            clubId: access.configuredClubId
        };

        let response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchPayload)
            });
        } catch (error) {
            return jsonResponse({ error: 'Unable to reach DUPR club match search endpoint' }, 502);
        }

        const text = await response.text();
        let remotePayload = null;
        try {
            remotePayload = text ? JSON.parse(text) : null;
        } catch (error) {
            remotePayload = text;
        }

        if (!response.ok) {
            return jsonResponse({
                error: 'DUPR club match search failed',
                status: response.status,
                details: remotePayload
            }, 502);
        }

        const localMatches = await listSubmittedMatches(env, 1000);
        const localByIdentifier = new Map();
        const localByMatchId = new Map();
        const localByMatchCode = new Map();
        localMatches.forEach(match => {
            if (match.identifier) localByIdentifier.set(String(match.identifier).trim(), match);
            if (Number.isInteger(Number(match.dupr_match_id))) localByMatchId.set(Number(match.dupr_match_id), match);
            if (match.dupr_match_code) localByMatchCode.set(String(match.dupr_match_code).trim(), match);
        });

        const remoteMatchesRaw = getRemoteMatches(remotePayload);
        const remoteMatches = remoteMatchesRaw.map(normalizeRemoteMatch).filter(Boolean);

        let linkedCount = 0;
        const missingInLocal = [];
        remoteMatches.forEach(match => {
            const found =
                (match.identifier && localByIdentifier.get(match.identifier)) ||
                (Number.isInteger(match.matchId) ? localByMatchId.get(match.matchId) : null) ||
                (match.matchCode && localByMatchCode.get(match.matchCode));
            if (found) {
                linkedCount += 1;
            } else {
                missingInLocal.push(match);
            }
        });

        const localNotInRemote = localMatches.filter(match => {
            const identifier = match.identifier ? String(match.identifier).trim() : null;
            const matchId = Number.isInteger(Number(match.dupr_match_id)) ? Number(match.dupr_match_id) : null;
            const matchCode = match.dupr_match_code ? String(match.dupr_match_code).trim() : null;
            return !remoteMatches.some(remote => (
                (identifier && remote.identifier && identifier === remote.identifier) ||
                (matchId !== null && remote.matchId !== null && matchId === remote.matchId) ||
                (matchCode && remote.matchCode && matchCode === remote.matchCode)
            ));
        });

        return jsonResponse({
            success: true,
            environment: access.duprEnv,
            endpoint,
            request: searchPayload,
            summary: {
                remoteCount: remoteMatches.length,
                localCount: localMatches.length,
                matchedCount: linkedCount,
                remoteMissingInLocal: missingInLocal.length,
                localMissingInRemote: localNotInRemote.length
            },
            remoteMissingInLocal: missingInLocal.slice(0, 50),
            localMissingInRemote: localNotInRemote.slice(0, 50).map(match => ({
                id: match.id,
                identifier: match.identifier,
                duprMatchId: match.dupr_match_id,
                duprMatchCode: match.dupr_match_code,
                eventName: match.event_name,
                matchDate: match.match_date,
                status: match.status
            }))
        });
    } catch (error) {
        return jsonResponse({
            error: 'Unexpected reconcile failure',
            details: String(error && error.message ? error.message : error)
        }, 500);
    }
}
