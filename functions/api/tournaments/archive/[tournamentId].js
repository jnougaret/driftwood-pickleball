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

async function getPlayoffState(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT status, bracket_size, best_of_three, bronze_best_of_three FROM playoff_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function getScore(env, tournamentId, roundNumber, matchNumber) {
    return await env.DB.prepare(
        `SELECT game1_score1, game1_score2, game2_score1, game2_score2, game3_score1, game3_score2
         FROM playoff_scores
         WHERE tournament_id = ? AND round_number = ? AND match_number = ?`
    ).bind(tournamentId, roundNumber, matchNumber).first();
}

function hasWinner(score, bestOfThree) {
    if (!score) return false;
    if (!bestOfThree) {
        return Number.isInteger(score.game1_score1)
            && Number.isInteger(score.game1_score2)
            && score.game1_score1 !== score.game1_score2;
    }

    let wins1 = 0;
    let wins2 = 0;
    const games = [
        [score.game1_score1, score.game1_score2],
        [score.game2_score1, score.game2_score2],
        [score.game3_score1, score.game3_score2]
    ];
    games.forEach(([s1, s2]) => {
        if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 === s2) return;
        if (s1 > s2) wins1 += 1;
        if (s2 > s1) wins2 += 1;
    });
    return wins1 >= 2 || wins2 >= 2;
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

    const playoff = await getPlayoffState(env, tournamentId);
    if (!playoff || playoff.status !== 'playoff') {
        return jsonResponse({ error: 'Playoff is not active' }, 400);
    }

    const totalRounds = Math.log2(playoff.bracket_size || 2);
    const goldScore = await getScore(env, tournamentId, totalRounds, 1);
    const goldComplete = hasWinner(goldScore, playoff.best_of_three === 1);

    let bronzeComplete = true;
    if ((playoff.bracket_size || 2) >= 4) {
        const bronzeScore = await getScore(env, tournamentId, totalRounds, 2);
        bronzeComplete = hasWinner(bronzeScore, playoff.bronze_best_of_three === 1);
    }

    if (!goldComplete || !bronzeComplete) {
        return jsonResponse({ error: 'Complete gold and bronze matches before archiving' }, 400);
    }

    await env.DB.prepare(
        `UPDATE tournaments
         SET status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(tournamentId).run();

    return jsonResponse({ success: true });
}
