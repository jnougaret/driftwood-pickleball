import { verifyClerkToken } from '../../_auth.js';
import {
    ensureRequesterCanSubmitToConfiguredClub,
    getDeleteMatchUrl,
    getRequester,
    getSubmittedMatchById,
    getUpdateMatchUrl,
    jsonResponse,
    normalizeGames,
    toIntegerOrNull
} from '../_submitted_matches.js';

async function parseResponseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return text;
    }
}

export async function onRequestPatch({ request, env, params }) {
    const matchId = Number(params.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
        return jsonResponse({ error: 'Invalid matchId' }, 400);
    }

    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getRequester(env, auth.userId);
    if (!requester || requester.is_admin !== 1) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const existing = await getSubmittedMatchById(env, matchId);
    if (!existing) return jsonResponse({ error: 'Match not found' }, 404);
    if (existing.status === 'deleted') {
        return jsonResponse({ error: 'Cannot edit deleted matches' }, 400);
    }
    if (!existing.dupr_match_id) {
        return jsonResponse({ error: 'This record cannot be edited because DUPR match id is missing' }, 400);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const games = normalizeGames(body.games);
    if (!games.length) {
        return jsonResponse({ error: 'At least one valid game score is required' }, 400);
    }

    const eventName = String(body.eventName || existing.event_name || '').trim();
    const bracketName = String(body.bracketName || existing.bracket_name || '').trim();
    const location = String(body.location || existing.location || '').trim();
    const matchDate = String(body.matchDate || existing.match_date || '').trim();
    if (!eventName) return jsonResponse({ error: 'eventName is required' }, 400);
    if (!matchDate || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return jsonResponse({ error: 'matchDate must be YYYY-MM-DD' }, 400);

    const access = await ensureRequesterCanSubmitToConfiguredClub(env, requester);
    if (!access.ok) {
        return jsonResponse({ error: access.error, details: access.details || null }, access.status);
    }

    const updateUrl = getUpdateMatchUrl(env, access.duprEnv);
    const payload = {
        matchId: toIntegerOrNull(existing.dupr_match_id),
        location: location || null,
        matchDate,
        format: 'DOUBLES',
        event: eventName,
        bracket: bracketName || 'Manual',
        matchType: 'SIDEOUT',
        identifier: existing.identifier,
        clubId: access.configuredClubId,
        teamA: {
            player1: existing.team_a_player1_dupr,
            player2: existing.team_a_player2_dupr,
            game1: games[0].teamA,
            game2: games[1] ? games[1].teamA : null,
            game3: games[2] ? games[2].teamA : null,
            game4: games[3] ? games[3].teamA : null,
            game5: games[4] ? games[4].teamA : null
        },
        teamB: {
            player1: existing.team_b_player1_dupr,
            player2: existing.team_b_player2_dupr,
            game1: games[0].teamB,
            game2: games[1] ? games[1].teamB : null,
            game3: games[2] ? games[2].teamB : null,
            game4: games[3] ? games[3].teamB : null,
            game5: games[4] ? games[4].teamB : null
        }
    };

    let response;
    try {
        response = await fetch(updateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        return jsonResponse({ error: 'Unable to reach DUPR update endpoint' }, 502);
    }

    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
        return jsonResponse({
            error: 'DUPR update match failed',
            status: response.status,
            details: responseBody
        }, 502);
    }

    await env.DB.prepare(
        `UPDATE dupr_submitted_matches
         SET event_name = ?,
             bracket_name = ?,
             location = ?,
             match_date = ?,
             team_a_game1 = ?,
             team_b_game1 = ?,
             team_a_game2 = ?,
             team_b_game2 = ?,
             team_a_game3 = ?,
             team_b_game3 = ?,
             team_a_game4 = ?,
             team_b_game4 = ?,
             team_a_game5 = ?,
             team_b_game5 = ?,
             status = 'updated',
             last_status_code = ?,
             last_response = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(
        eventName,
        bracketName || null,
        location || null,
        matchDate,
        games[0].teamA,
        games[0].teamB,
        games[1] ? games[1].teamA : null,
        games[1] ? games[1].teamB : null,
        games[2] ? games[2].teamA : null,
        games[2] ? games[2].teamB : null,
        games[3] ? games[3].teamA : null,
        games[3] ? games[3].teamB : null,
        games[4] ? games[4].teamA : null,
        games[4] ? games[4].teamB : null,
        response.status,
        JSON.stringify(responseBody || {}),
        matchId
    ).run();

    return jsonResponse({ success: true });
}

export async function onRequestDelete({ request, env, params }) {
    const matchId = Number(params.matchId);
    if (!Number.isInteger(matchId) || matchId <= 0) {
        return jsonResponse({ error: 'Invalid matchId' }, 400);
    }

    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getRequester(env, auth.userId);
    if (!requester || requester.is_admin !== 1) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const existing = await getSubmittedMatchById(env, matchId);
    if (!existing) return jsonResponse({ error: 'Match not found' }, 404);
    if (existing.status === 'deleted') {
        return jsonResponse({ success: true, alreadyDeleted: true });
    }
    if (!existing.dupr_match_code || !existing.identifier) {
        return jsonResponse({ error: 'This record cannot be deleted because DUPR match code is missing' }, 400);
    }

    const access = await ensureRequesterCanSubmitToConfiguredClub(env, requester);
    if (!access.ok) {
        return jsonResponse({ error: access.error, details: access.details || null }, access.status);
    }

    const deleteUrl = getDeleteMatchUrl(env, access.duprEnv);
    const payload = {
        matchCode: existing.dupr_match_code,
        identifier: existing.identifier
    };

    let response;
    try {
        response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${access.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        return jsonResponse({ error: 'Unable to reach DUPR delete endpoint' }, 502);
    }

    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
        return jsonResponse({
            error: 'DUPR delete match failed',
            status: response.status,
            details: responseBody
        }, 502);
    }

    await env.DB.prepare(
        `UPDATE dupr_submitted_matches
         SET status = 'deleted',
             deleted_at = CURRENT_TIMESTAMP,
             last_status_code = ?,
             last_response = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(response.status, JSON.stringify(responseBody || {}), matchId).run();

    return jsonResponse({ success: true });
}
