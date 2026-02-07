import { verifyClerkToken } from '../_auth.js';
import {
    ensureRequesterCanSubmitToConfiguredClub,
    getRequester,
    jsonResponse,
    updateSubmittedMatchVerification
} from './_submitted_matches.js';
import { getDuprBase } from './_partner.js';

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
    const candidates = [payload.result, payload.matches, payload.data, payload.items];
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

function getMatchWindowEpoch(matchDate) {
    const base = new Date(`${String(matchDate || '').trim()}T12:00:00Z`);
    if (Number.isNaN(base.getTime())) {
        const now = Date.now();
        return {
            startDate: Math.floor((now - (7 * 24 * 60 * 60 * 1000)) / 1000),
            endDate: Math.floor(now / 1000)
        };
    }
    const start = new Date(base.getTime() - (24 * 60 * 60 * 1000));
    const end = new Date(base.getTime() + (24 * 60 * 60 * 1000));
    return {
        startDate: Math.floor(start.getTime() / 1000),
        endDate: Math.floor(end.getTime() / 1000)
    };
}

async function getPendingCount(env) {
    const row = await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM dupr_submitted_matches
         WHERE deleted_at IS NULL
           AND status = 'submitted'
           AND (verification_status IS NULL OR TRIM(verification_status) = '')`
    ).first();
    return Number(row?.count || 0);
}

async function getNextPendingMatch(env, requestedMatchId = null) {
    if (Number.isInteger(requestedMatchId)) {
        return await env.DB.prepare(
            `SELECT *
             FROM dupr_submitted_matches
             WHERE id = ?
               AND deleted_at IS NULL
               AND status = 'submitted'
             LIMIT 1`
        ).bind(requestedMatchId).first();
    }
    return await env.DB.prepare(
        `SELECT *
         FROM dupr_submitted_matches
         WHERE deleted_at IS NULL
           AND status = 'submitted'
           AND (verification_status IS NULL OR TRIM(verification_status) = '')
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
    ).first();
}

async function updateMatchRemoteMeta(env, id, duprMatchId, duprMatchCode) {
    await env.DB.prepare(
        `UPDATE dupr_submitted_matches
         SET dupr_match_id = ?,
             dupr_match_code = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(
        duprMatchId ?? null,
        duprMatchCode ?? null,
        id
    ).run();
}

function findRemoteMatchForLocal(localMatch, remoteMatches) {
    const localIdentifier = localMatch.identifier ? String(localMatch.identifier).trim() : null;
    const localMatchId = Number.isInteger(Number(localMatch.dupr_match_id))
        ? Number(localMatch.dupr_match_id)
        : null;
    const localMatchCode = localMatch.dupr_match_code ? String(localMatch.dupr_match_code).trim() : null;
    return remoteMatches.find(remote => (
        (localIdentifier && remote.identifier && localIdentifier === remote.identifier)
        || (localMatchId !== null && remote.matchId !== null && localMatchId === remote.matchId)
        || (localMatchCode && remote.matchCode && localMatchCode === remote.matchCode)
    )) || null;
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

        const requestedMatchId = Number.isInteger(body?.matchId) ? body.matchId : null;
        const localMatch = await getNextPendingMatch(env, requestedMatchId);
        if (!localMatch) {
            const pendingRemaining = await getPendingCount(env);
            return jsonResponse({
                success: true,
                done: true,
                message: 'No pending matches to reconcile.',
                summary: {
                    processedCount: 0,
                    pendingRemaining
                }
            });
        }

        const endpoint = getClubMatchSearchUrl(env, access.duprEnv);
        const { startDate, endDate } = getMatchWindowEpoch(localMatch.match_date);
        const eventFormat = String(localMatch.format || 'DOUBLES').toUpperCase();
        const searchPayload = {
            offset: 0,
            limit: 20,
            eventFormat: [eventFormat],
            startDate,
            endDate,
            clubId: access.configuredClubId
        };

        let response;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchPayload),
                signal: controller.signal
            });
            clearTimeout(timer);
        } catch (error) {
            await updateSubmittedMatchVerification(
                env,
                localMatch.id,
                'verify_failed',
                'Reconcile failed: DUPR endpoint unreachable'
            );
            const pendingRemaining = await getPendingCount(env);
            return jsonResponse({
                success: false,
                processed: {
                    id: localMatch.id,
                    identifier: localMatch.identifier,
                    verificationStatus: 'verify_failed'
                },
                error: 'Unable to reach DUPR club match search endpoint',
                summary: {
                    processedCount: 1,
                    pendingRemaining
                }
            });
        }

        const text = await response.text();
        let remotePayload = null;
        try {
            remotePayload = text ? JSON.parse(text) : null;
        } catch (error) {
            remotePayload = text;
        }

        if (!response.ok) {
            await updateSubmittedMatchVerification(
                env,
                localMatch.id,
                'verify_failed',
                typeof remotePayload === 'string' ? remotePayload.slice(0, 2000) : JSON.stringify(remotePayload)
            );
            const pendingRemaining = await getPendingCount(env);
            return jsonResponse({
                success: false,
                processed: {
                    id: localMatch.id,
                    identifier: localMatch.identifier,
                    verificationStatus: 'verify_failed'
                },
                error: 'DUPR club match search failed',
                status: response.status,
                summary: {
                    processedCount: 1,
                    pendingRemaining
                }
            });
        }

        const remoteMatches = getRemoteMatches(remotePayload)
            .map(normalizeRemoteMatch)
            .filter(Boolean);
        const found = findRemoteMatchForLocal(localMatch, remoteMatches);

        if (!found) {
            await updateSubmittedMatchVerification(
                env,
                localMatch.id,
                'verify_failed',
                'Reconcile: match not found in DUPR club search'
            );
            const pendingRemaining = await getPendingCount(env);
            return jsonResponse({
                success: true,
                processed: {
                    id: localMatch.id,
                    identifier: localMatch.identifier,
                    verificationStatus: 'verify_failed'
                },
                summary: {
                    processedCount: 1,
                    pendingRemaining,
                    remoteCandidates: remoteMatches.length
                }
            });
        }

        await updateMatchRemoteMeta(env, localMatch.id, found.matchId, found.matchCode);
        await updateSubmittedMatchVerification(
            env,
            localMatch.id,
            'verified',
            JSON.stringify(found)
        );

        const pendingRemaining = await getPendingCount(env);
        return jsonResponse({
            success: true,
            processed: {
                id: localMatch.id,
                identifier: localMatch.identifier,
                duprMatchId: found.matchId,
                duprMatchCode: found.matchCode,
                verificationStatus: 'verified'
            },
            summary: {
                processedCount: 1,
                pendingRemaining
            }
        });
    } catch (error) {
        return jsonResponse({
            success: false,
            error: 'Unexpected reconcile failure',
            details: String(error && error.message ? error.message : error)
        }, 500);
    }
}
