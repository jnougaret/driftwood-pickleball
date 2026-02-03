import { verifyClerkToken } from '../../../_auth.js';

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

async function tournamentExists(env, tournamentId) {
    const row = await env.DB.prepare(
        'SELECT id FROM tournaments WHERE id = ?'
    ).bind(tournamentId).first();
    return Boolean(row);
}

async function archiveTournament(env, tournamentId) {
    await env.DB.prepare(
        `UPDATE tournaments
         SET status = 'archived',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(tournamentId).run();
}

async function deleteTournament(env, tournamentId) {
    await env.DB.batch([
        env.DB.prepare(
            `DELETE FROM round_robin_scores
             WHERE match_id IN (
                SELECT id FROM round_robin_matches WHERE tournament_id = ?
             )`
        ).bind(tournamentId),
        env.DB.prepare('DELETE FROM round_robin_matches WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM playoff_scores WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM playoff_state WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM tournament_state WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM tournament_settings WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM registrations WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare(
            `DELETE FROM team_members
             WHERE team_id IN (
                SELECT id FROM teams WHERE tournament_id = ?
             )`
        ).bind(tournamentId),
        env.DB.prepare('DELETE FROM teams WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM admin_actions WHERE tournament_id = ?').bind(tournamentId),
        env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(tournamentId)
    ]);
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

    const exists = await tournamentExists(env, tournamentId);
    if (!exists) {
        return jsonResponse({ error: 'Tournament not found' }, 404);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const action = String(body.action || '').trim();
    if (action !== 'archive' && action !== 'delete') {
        return jsonResponse({ error: 'Invalid action' }, 400);
    }

    try {
        if (action === 'archive') {
            await archiveTournament(env, tournamentId);
        } else {
            await deleteTournament(env, tournamentId);
        }
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Manage tournament error:', error);
        return jsonResponse({ error: 'Failed to update tournament' }, 500);
    }
}
