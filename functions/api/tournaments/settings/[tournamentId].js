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

async function getSettings(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT max_teams, rounds, playoff_teams, playoff_best_of_three, playoff_best_of_three_bronze, dupr_required FROM tournament_settings WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function getTournamentState(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function ensureTournamentRow(env, tournamentId) {
    await env.DB.prepare(
        `INSERT OR IGNORE INTO tournaments (id, title, status)
         VALUES (?, ?, 'upcoming')`
    ).bind(tournamentId, tournamentId).run();
}

async function upsertSettings(env, tournamentId, maxTeams, rounds, playoffTeams, playoffBestOfThree, playoffBestOfThreeBronze, duprRequired) {
    await env.DB.prepare(
        `INSERT INTO tournament_settings (tournament_id, max_teams, rounds, playoff_teams, playoff_best_of_three, playoff_best_of_three_bronze, dupr_required)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tournament_id) DO UPDATE SET
            max_teams = excluded.max_teams,
            rounds = excluded.rounds,
            playoff_teams = excluded.playoff_teams,
            playoff_best_of_three = excluded.playoff_best_of_three,
            playoff_best_of_three_bronze = excluded.playoff_best_of_three_bronze,
            dupr_required = excluded.dupr_required,
            updated_at = CURRENT_TIMESTAMP`
    ).bind(tournamentId, maxTeams, rounds, playoffTeams, playoffBestOfThree, playoffBestOfThreeBronze, duprRequired).run();
}

export async function onRequestGet({ env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    try {
        const settings = await getSettings(env, tournamentId);
        const state = await getTournamentState(env, tournamentId);
        return jsonResponse({
            maxTeams: settings?.max_teams ?? 12,
            rounds: settings?.rounds ?? 6,
            playoffTeams: settings?.playoff_teams ?? null,
            playoffBestOfThree: settings?.playoff_best_of_three === 1,
            playoffBestOfThreeBronze: settings?.playoff_best_of_three_bronze === 1,
            duprRequired: settings?.dupr_required === 1 || settings?.dupr_required === null || settings?.dupr_required === undefined,
            status: state?.status ?? 'registration'
        });
    } catch (error) {
        console.error('Settings load error:', error);
        return jsonResponse({ error: 'Failed to load settings' }, 500);
    }
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

    const requester = await getUserById(env, auth.userId);
    if (!requester || !requester.is_admin) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { maxTeams, rounds, playoffTeams, playoffBestOfThree, playoffBestOfThreeBronze, duprRequired } = body;
    const updates = [maxTeams, rounds, playoffTeams, playoffBestOfThree, playoffBestOfThreeBronze, duprRequired].some(value => value !== undefined);
    if (!updates) {
        return jsonResponse({ error: 'No settings provided' }, 400);
    }
    if (maxTeams !== undefined && !Number.isInteger(maxTeams)) {
        return jsonResponse({ error: 'maxTeams must be an integer' }, 400);
    }
    if (rounds !== undefined && !Number.isInteger(rounds)) {
        return jsonResponse({ error: 'rounds must be an integer' }, 400);
    }
    if (playoffTeams !== undefined && !Number.isInteger(playoffTeams)) {
        return jsonResponse({ error: 'playoffTeams must be an integer' }, 400);
    }
    if (playoffBestOfThree !== undefined && typeof playoffBestOfThree !== 'boolean') {
        return jsonResponse({ error: 'playoffBestOfThree must be a boolean' }, 400);
    }
    if (playoffBestOfThreeBronze !== undefined && typeof playoffBestOfThreeBronze !== 'boolean') {
        return jsonResponse({ error: 'playoffBestOfThreeBronze must be a boolean' }, 400);
    }
    if (duprRequired !== undefined && typeof duprRequired !== 'boolean') {
        return jsonResponse({ error: 'duprRequired must be a boolean' }, 400);
    }

    await ensureTournamentRow(env, tournamentId);

    const state = await getTournamentState(env, tournamentId);
    if (state?.status === 'tournament' && (maxTeams !== undefined || rounds !== undefined)) {
        return jsonResponse({ error: 'Tournament already started' }, 400);
    }

    const existing = await getSettings(env, tournamentId);
    const nextMaxTeams = maxTeams ?? existing?.max_teams ?? 12;
    const nextRounds = rounds ?? existing?.rounds ?? 6;
    const nextPlayoffTeams = playoffTeams ?? existing?.playoff_teams ?? null;
    const nextPlayoffBestOfThree = playoffBestOfThree ?? (existing?.playoff_best_of_three === 1);
    const nextPlayoffBestOfThreeBronze = playoffBestOfThreeBronze ?? (existing?.playoff_best_of_three_bronze === 1);
    const nextDuprRequired = duprRequired ?? (existing?.dupr_required === 1);

    await upsertSettings(
        env,
        tournamentId,
        nextMaxTeams,
        nextRounds,
        nextPlayoffTeams,
        nextPlayoffBestOfThree ? 1 : 0,
        nextPlayoffBestOfThreeBronze ? 1 : 0,
        nextDuprRequired ? 1 : 0
    );
    return jsonResponse({ success: true });
}
