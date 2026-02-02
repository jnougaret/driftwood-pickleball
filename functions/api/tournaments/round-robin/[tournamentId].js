import { verifyClerkToken } from '../../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function getTournamentStatus(env, tournamentId) {
    const state = await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
    return state?.status ?? 'registration';
}

async function listMatches(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT m.id AS match_id,
                m.round_number,
                m.team1_id,
                m.team2_id,
                s.score1,
                s.score2,
                COALESCE(s.version, 0) AS version,
                t1names.names AS team1_name,
                t2names.names AS team2_name
         FROM round_robin_matches m
         LEFT JOIN round_robin_scores s ON s.match_id = m.id
         LEFT JOIN (
            SELECT tm.team_id, GROUP_CONCAT(u.display_name, ' / ') AS names
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            GROUP BY tm.team_id
         ) t1names ON t1names.team_id = m.team1_id
         LEFT JOIN (
            SELECT tm.team_id, GROUP_CONCAT(u.display_name, ' / ') AS names
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            GROUP BY tm.team_id
         ) t2names ON t2names.team_id = m.team2_id
         WHERE m.tournament_id = ?
         ORDER BY m.round_number ASC`
    ).bind(tournamentId).all();

    return result.results || [];
}

async function getCurrentScore(env, matchId) {
    return await env.DB.prepare(
        'SELECT score1, score2, version FROM round_robin_scores WHERE match_id = ?'
    ).bind(matchId).first();
}

async function listTeams(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT t.id AS team_id,
                GROUP_CONCAT(u.display_name, ' / ') AS team_name
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = tm.user_id
         WHERE t.tournament_id = ?
         GROUP BY t.id
         ORDER BY t.created_at ASC`
    ).bind(tournamentId).all();

    return result.results || [];
}

async function userTeams(env, tournamentId, userId) {
    const result = await env.DB.prepare(
        `SELECT t.id AS team_id
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         WHERE t.tournament_id = ? AND tm.user_id = ?`
    ).bind(tournamentId, userId).all();

    return new Set((result.results || []).map(row => row.team_id));
}

export async function onRequestGet({ env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    const status = await getTournamentStatus(env, tournamentId);
    if (status !== 'tournament') {
        return jsonResponse({ status });
    }

    const matches = await listMatches(env, tournamentId);
    const teams = await listTeams(env, tournamentId);
    return jsonResponse({ status, matches, teams });
}

export async function onRequestPost({ request, env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const status = await getTournamentStatus(env, tournamentId);
    if (status !== 'tournament') {
        return jsonResponse({ error: 'Tournament not started' }, 400);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { matchId, score1, score2, expectedVersion } = body;
    const score1Valid = score1 === null || Number.isInteger(score1);
    const score2Valid = score2 === null || Number.isInteger(score2);
    if (!matchId || !score1Valid || !score2Valid || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
        return jsonResponse({ error: 'matchId with score1/score2 and expectedVersion required' }, 400);
    }

    const requester = await getUserById(env, auth.userId);
    const isAdmin = requester && requester.is_admin;
    if (!isAdmin) {
        const match = await env.DB.prepare(
            'SELECT team1_id, team2_id FROM round_robin_matches WHERE id = ?'
        ).bind(matchId).first();
        if (!match) {
            return jsonResponse({ error: 'Match not found' }, 404);
        }
        const teams = await userTeams(env, tournamentId, auth.userId);
        if (!teams.has(match.team1_id) && !teams.has(match.team2_id)) {
            return jsonResponse({ error: 'Forbidden' }, 403);
        }
    }

    if (score1 === null && score2 === null) {
        let deleteResult;
        if (expectedVersion === 0) {
            deleteResult = await env.DB.prepare(
                'DELETE FROM round_robin_scores WHERE match_id = ? AND version = 0'
            ).bind(matchId).run();
            const existing = await getCurrentScore(env, matchId);
            if (!existing) {
                return jsonResponse({ success: true, version: 0 });
            }
            if (deleteResult.meta && deleteResult.meta.changes === 1) {
                return jsonResponse({ success: true, version: 0 });
            }
            return jsonResponse({
                error: 'Score was updated by another user',
                conflict: true,
                current: existing
            }, 409);
        }

        deleteResult = await env.DB.prepare(
            'DELETE FROM round_robin_scores WHERE match_id = ? AND version = ?'
        ).bind(matchId, expectedVersion).run();
        if (deleteResult.meta && deleteResult.meta.changes === 1) {
            return jsonResponse({ success: true, version: 0 });
        }
        const existing = await getCurrentScore(env, matchId);
        return jsonResponse({
            error: 'Score was updated by another user',
            conflict: true,
            current: existing || null
        }, 409);
    }

    const nextVersion = expectedVersion + 1;
    let writeResult;
    if (expectedVersion === 0) {
        writeResult = await env.DB.prepare(
            `INSERT INTO round_robin_scores (match_id, score1, score2, version)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(match_id) DO UPDATE SET
                score1 = excluded.score1,
                score2 = excluded.score2,
                version = round_robin_scores.version + 1,
                updated_at = CURRENT_TIMESTAMP
             WHERE round_robin_scores.version = 0`
        ).bind(matchId, score1, score2, nextVersion).run();
    } else {
        writeResult = await env.DB.prepare(
            `UPDATE round_robin_scores
             SET score1 = ?, score2 = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE match_id = ? AND version = ?`
        ).bind(score1, score2, matchId, expectedVersion).run();
    }

    if (!(writeResult.meta && writeResult.meta.changes === 1)) {
        const existing = await getCurrentScore(env, matchId);
        return jsonResponse({
            error: 'Score was updated by another user',
            conflict: true,
            current: existing || null
        }, 409);
    }

    return jsonResponse({ success: true, version: nextVersion });
}
