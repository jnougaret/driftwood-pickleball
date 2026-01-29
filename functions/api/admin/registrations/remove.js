import { verifyClerkToken } from '../../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, email, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function removeUserFromTournament(env, tournamentId, userId) {
    const team = await env.DB.prepare(
        `SELECT t.id AS team_id
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         WHERE t.tournament_id = ? AND tm.user_id = ?
         LIMIT 1`
    ).bind(tournamentId, userId).first();

    if (!team) {
        return false;
    }

    await env.DB.prepare(
        'DELETE FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(team.team_id, userId).run();

    const remaining = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?'
    ).bind(team.team_id).first();

    if (!remaining || remaining.count === 0) {
        await env.DB.prepare('DELETE FROM teams WHERE id = ?')
            .bind(team.team_id)
            .run();
    }

    return true;
}

export async function onRequestPost({ request, env }) {
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

    const { tournamentId, userId } = body;
    if (!tournamentId || !userId) {
        return jsonResponse({ error: 'tournamentId and userId are required' }, 400);
    }

    const removed = await removeUserFromTournament(env, tournamentId, userId);
    if (!removed) {
        return jsonResponse({ error: 'User not registered' }, 404);
    }

    return jsonResponse({ success: true });
}
