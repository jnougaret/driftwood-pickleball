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

    await env.DB.prepare(
        `DELETE FROM round_robin_scores
         WHERE match_id IN (SELECT id FROM round_robin_matches WHERE tournament_id = ?)`
    ).bind(tournamentId).run();
    await env.DB.prepare(
        'DELETE FROM round_robin_matches WHERE tournament_id = ?'
    ).bind(tournamentId).run();
    await env.DB.prepare(
        'DELETE FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).run();
    await env.DB.prepare(
        'DELETE FROM playoff_scores WHERE tournament_id = ?'
    ).bind(tournamentId).run();
    await env.DB.prepare(
        'DELETE FROM playoff_state WHERE tournament_id = ?'
    ).bind(tournamentId).run();

    return jsonResponse({ success: true });
}
