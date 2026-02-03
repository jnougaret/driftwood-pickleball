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

async function setTournamentPhoto(env, tournamentId, photoUrl) {
    await env.DB.prepare(
        `UPDATE tournaments
         SET photo_url = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(photoUrl, tournamentId).run();
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
    if (action !== 'archive' && action !== 'delete' && action !== 'set_photo') {
        return jsonResponse({ error: 'Invalid action' }, 400);
    }

    if (action === 'delete') {
        const masterEmail = (env.MASTER_ADMIN_EMAIL || '').toLowerCase();
        const requesterEmail = (requester.email || '').toLowerCase();
        const isMasterAdmin = Boolean(masterEmail && requesterEmail && requesterEmail === masterEmail);
        if (!isMasterAdmin) {
            return jsonResponse({ error: 'Only master admin can delete tournaments' }, 403);
        }
    }

    try {
        if (action === 'archive') {
            await archiveTournament(env, tournamentId);
        } else if (action === 'delete') {
            await deleteTournament(env, tournamentId);
        } else {
            const photoUrlRaw = body.photoUrl === undefined || body.photoUrl === null
                ? ''
                : String(body.photoUrl).trim();
            if (photoUrlRaw.length > 255) {
                return jsonResponse({ error: 'photoUrl is too long' }, 400);
            }
            await setTournamentPhoto(env, tournamentId, photoUrlRaw || null);
        }
        return jsonResponse({ success: true });
    } catch (error) {
        console.error('Manage tournament error:', error);
        return jsonResponse({ error: 'Failed to update tournament' }, 500);
    }
}
