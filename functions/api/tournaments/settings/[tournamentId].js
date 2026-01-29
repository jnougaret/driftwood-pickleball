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
        'SELECT max_teams, rounds FROM tournament_settings WHERE tournament_id = ?'
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

async function upsertSettings(env, tournamentId, maxTeams, rounds) {
    await env.DB.prepare(
        `INSERT INTO tournament_settings (tournament_id, max_teams, rounds)
         VALUES (?, ?, ?)
         ON CONFLICT(tournament_id) DO UPDATE SET
            max_teams = excluded.max_teams,
            rounds = excluded.rounds,
            updated_at = CURRENT_TIMESTAMP`
    ).bind(tournamentId, maxTeams, rounds).run();
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

    const { maxTeams, rounds } = body;
    if (!Number.isInteger(maxTeams) || !Number.isInteger(rounds)) {
        return jsonResponse({ error: 'maxTeams and rounds must be integers' }, 400);
    }

    await ensureTournamentRow(env, tournamentId);

    const state = await getTournamentState(env, tournamentId);
    if (state?.status === 'tournament') {
        return jsonResponse({ error: 'Tournament already started' }, 400);
    }

    await upsertSettings(env, tournamentId, maxTeams, rounds);
    return jsonResponse({ success: true });
}
