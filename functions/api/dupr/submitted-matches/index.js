import { verifyClerkToken } from '../../_auth.js';
import {
    ensureRequesterCanSubmitToConfiguredClub,
    fetchDuprMatchById,
    getCreateMatchUrl,
    getEligiblePlayers,
    getRequester,
    insertSubmittedMatch,
    jsonResponse,
    listSubmittedMatches,
    normalizeGames,
    parseDuprMatchMeta,
    updateSubmittedMatchVerification
} from '../_submitted_matches.js';

function buildIdentifier(prefix = 'manual') {
    const stamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}:${stamp}:${random}`;
}

async function parseResponseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return text;
    }
}

function mapForClient(row) {
    return {
        id: row.id,
        tournamentId: row.tournament_id,
        duprEnv: row.dupr_env,
        duprMatchId: row.dupr_match_id,
        duprMatchCode: row.dupr_match_code,
        identifier: row.identifier,
        eventName: row.event_name,
        bracketName: row.bracket_name,
        location: row.location,
        matchDate: row.match_date,
        format: row.format,
        matchType: row.match_type,
        clubId: row.club_id,
        teamA: {
            player1: row.team_a_player1,
            player2: row.team_a_player2,
            player1Dupr: row.team_a_player1_dupr,
            player2Dupr: row.team_a_player2_dupr,
            game1: row.team_a_game1,
            game2: row.team_a_game2,
            game3: row.team_a_game3,
            game4: row.team_a_game4,
            game5: row.team_a_game5
        },
        teamB: {
            player1: row.team_b_player1,
            player2: row.team_b_player2,
            player1Dupr: row.team_b_player1_dupr,
            player2Dupr: row.team_b_player2_dupr,
            game1: row.team_b_game1,
            game2: row.team_b_game2,
            game3: row.team_b_game3,
            game4: row.team_b_game4,
            game5: row.team_b_game5
        },
        status: row.status,
        lastStatusCode: row.last_status_code,
        submittedBy: row.submitted_by,
        submittedByName: row.submitted_by_name || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        verificationStatus: row.verification_status || null,
        verificationResponse: row.verification_response || null,
        verifiedAt: row.verified_at || null
    };
}

export async function onRequestGet({ request, env }) {
    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const requester = await getRequester(env, auth.userId);
    if (!requester || requester.is_admin !== 1) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const [rows, players] = await Promise.all([
        listSubmittedMatches(env, 500),
        getEligiblePlayers(env)
    ]);

    return jsonResponse({
        matches: rows.map(mapForClient),
        eligiblePlayers: players.map(player => ({
            id: player.id,
            displayName: player.display_name,
            email: player.email,
            duprId: player.dupr_id
        }))
    });
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

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const eventName = String(body.eventName || '').trim();
    const bracketName = String(body.bracketName || '').trim();
    const location = String(body.location || '').trim();
    const matchDate = String(body.matchDate || '').trim();
    const tournamentId = body.tournamentId ? String(body.tournamentId).trim() : null;
    const teamAPlayer1Id = String(body?.teamA?.player1Id || '').trim();
    const teamAPlayer2Id = String(body?.teamA?.player2Id || '').trim();
    const teamBPlayer1Id = String(body?.teamB?.player1Id || '').trim();
    const teamBPlayer2Id = String(body?.teamB?.player2Id || '').trim();
    const games = normalizeGames(body.games);

    if (!eventName) return jsonResponse({ error: 'eventName is required' }, 400);
    if (!matchDate || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return jsonResponse({ error: 'matchDate must be YYYY-MM-DD' }, 400);
    if (!teamAPlayer1Id || !teamBPlayer1Id) return jsonResponse({ error: 'Each team requires player1' }, 400);
    if (!games.length) return jsonResponse({ error: 'At least one valid game score is required' }, 400);

    const eligiblePlayers = await getEligiblePlayers(env);
    const byId = new Map(eligiblePlayers.map(player => [String(player.id), player]));
    const selectedIds = [teamAPlayer1Id, teamAPlayer2Id, teamBPlayer1Id, teamBPlayer2Id].filter(Boolean);
    const uniqueIds = new Set(selectedIds);
    if (uniqueIds.size !== selectedIds.length) {
        return jsonResponse({ error: 'A player cannot be used twice in the same match' }, 400);
    }

    const teamA1 = byId.get(teamAPlayer1Id);
    const teamA2 = teamAPlayer2Id ? byId.get(teamAPlayer2Id) : null;
    const teamB1 = byId.get(teamBPlayer1Id);
    const teamB2 = teamBPlayer2Id ? byId.get(teamBPlayer2Id) : null;
    if (!teamA1 || !teamB1 || (teamAPlayer2Id && !teamA2) || (teamBPlayer2Id && !teamB2)) {
        return jsonResponse({ error: 'Players must be registered site users with linked DUPR accounts' }, 400);
    }

    const access = await ensureRequesterCanSubmitToConfiguredClub(env, requester);
    if (!access.ok) {
        return jsonResponse({ error: access.error, details: access.details || null }, access.status);
    }

    const identifier = String(body.identifier || '').trim() || buildIdentifier('manual');
    const createUrl = getCreateMatchUrl(env, access.duprEnv);
    const payload = {
        location: location || null,
        matchDate,
        format: 'DOUBLES',
        event: eventName,
        bracket: bracketName || 'Manual',
        matchType: 'SIDEOUT',
        identifier,
        clubId: access.configuredClubId,
        teamA: {
            player1: teamA1.dupr_id,
            player2: teamA2 ? teamA2.dupr_id : null,
            game1: games[0].teamA,
            game2: games[1] ? games[1].teamA : null,
            game3: games[2] ? games[2].teamA : null,
            game4: games[3] ? games[3].teamA : null,
            game5: games[4] ? games[4].teamA : null
        },
        teamB: {
            player1: teamB1.dupr_id,
            player2: teamB2 ? teamB2.dupr_id : null,
            game1: games[0].teamB,
            game2: games[1] ? games[1].teamB : null,
            game3: games[2] ? games[2].teamB : null,
            game4: games[3] ? games[3].teamB : null,
            game5: games[4] ? games[4].teamB : null
        }
    };

    let response;
    try {
        response = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        return jsonResponse({ error: 'Unable to reach DUPR create endpoint' }, 502);
    }

    const responseBody = await parseResponseBody(response);
    if (!response.ok) {
        return jsonResponse({
            error: 'DUPR create match failed',
            status: response.status,
            details: responseBody
        }, 502);
    }

    const meta = parseDuprMatchMeta(responseBody, identifier, 0);
    await insertSubmittedMatch(env, {
        tournamentId,
        submissionId: null,
        submittedBy: requester.id,
        duprEnv: access.duprEnv,
        duprMatchId: meta.matchId,
        duprMatchCode: meta.matchCode,
        identifier: meta.identifier || identifier,
        eventName,
        bracketName: bracketName || null,
        location: location || null,
        matchDate,
        format: 'DOUBLES',
        matchType: 'SIDEOUT',
        clubId: access.configuredClubId,
        teamAPlayer1: teamA1.display_name,
        teamAPlayer2: teamA2 ? teamA2.display_name : null,
        teamBPlayer1: teamB1.display_name,
        teamBPlayer2: teamB2 ? teamB2.display_name : null,
        teamAPlayer1Dupr: teamA1.dupr_id,
        teamAPlayer2Dupr: teamA2 ? teamA2.dupr_id : null,
        teamBPlayer1Dupr: teamB1.dupr_id,
        teamBPlayer2Dupr: teamB2 ? teamB2.dupr_id : null,
        teamAGame1: games[0].teamA,
        teamBGame1: games[0].teamB,
        teamAGame2: games[1] ? games[1].teamA : null,
        teamBGame2: games[1] ? games[1].teamB : null,
        teamAGame3: games[2] ? games[2].teamA : null,
        teamBGame3: games[2] ? games[2].teamB : null,
        teamAGame4: games[3] ? games[3].teamA : null,
        teamBGame4: games[3] ? games[3].teamB : null,
        teamAGame5: games[4] ? games[4].teamA : null,
        teamBGame5: games[4] ? games[4].teamB : null,
        status: 'submitted',
        lastStatusCode: response.status,
        lastResponse: JSON.stringify(responseBody || {})
    });

    const saved = await env.DB.prepare(
        `SELECT id FROM dupr_submitted_matches
         WHERE identifier = ? AND dupr_env = ?
         ORDER BY id DESC
         LIMIT 1`
    ).bind(meta.identifier || identifier, access.duprEnv).first();
    const insertedId = saved && Number.isInteger(saved.id) ? saved.id : null;
    if (insertedId && Number.isInteger(meta.matchId)) {
        const verification = await fetchDuprMatchById(env, access.token, access.duprEnv, meta.matchId);
        await updateSubmittedMatchVerification(
            env,
            insertedId,
            verification.ok ? 'verified' : 'verify_failed',
            JSON.stringify(verification.ok ? (verification.payload || {}) : {
                error: verification.error || 'Verification failed',
                status: verification.status,
                response: verification.response || null
            })
        );
    }

    const rows = await listSubmittedMatches(env, 500);
    return jsonResponse({
        success: true,
        created: rows.length ? mapForClient(rows[0]) : null,
        matches: rows.map(mapForClient)
    });
}
