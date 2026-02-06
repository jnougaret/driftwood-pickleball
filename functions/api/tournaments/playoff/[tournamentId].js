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
        'SELECT status, playoff_teams, best_of_three, bronze_best_of_three, bracket_size, seed_order FROM playoff_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function getTournamentMeta(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT status FROM tournaments WHERE id = ?'
    ).bind(tournamentId).first();
}

async function getLatestDuprSubmission(env, tournamentId) {
    try {
        return await env.DB.prepare(
            `SELECT success, created_at
             FROM dupr_match_submissions
             WHERE tournament_id = ?
             ORDER BY id DESC
             LIMIT 1`
        ).bind(tournamentId).first();
    } catch (error) {
        return null;
    }
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

async function listScores(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT round_number,
                match_number,
                game1_score1,
                game1_score2,
                game2_score1,
                game2_score2,
                game3_score1,
                game3_score2,
                version
         FROM playoff_scores
         WHERE tournament_id = ?
         ORDER BY round_number ASC, match_number ASC`
    ).bind(tournamentId).all();

    return result.results || [];
}

async function getCurrentScore(env, tournamentId, roundNumber, matchNumber) {
    return await env.DB.prepare(
        `SELECT game1_score1,
                game1_score2,
                game2_score1,
                game2_score2,
                game3_score1,
                game3_score2,
                version
         FROM playoff_scores
         WHERE tournament_id = ? AND round_number = ? AND match_number = ?`
    ).bind(tournamentId, roundNumber, matchNumber).first();
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

function seedOrderForSize(size) {
    if (size === 2) return [1, 2];
    if (size === 4) return [1, 4, 2, 3];
    return [1, 8, 4, 5, 2, 7, 3, 6];
}

function buildScoreMap(scores) {
    const map = new Map();
    scores.forEach(score => {
        const key = `${score.round_number}-${score.match_number}`;
        map.set(key, score);
    });
    return map;
}

function matchWinner(match, score, isFinal, bestOfThree, roundNumber) {
    if (!match.team1Id && !match.team2Id) return null;
    if (match.team1Id && !match.team2Id) return roundNumber === 1 ? match.team1Id : null;
    if (!match.team1Id && match.team2Id) return roundNumber === 1 ? match.team2Id : null;
    if (!score) return null;

    if (!isFinal || !bestOfThree) {
        if (!Number.isInteger(score.game1_score1) || !Number.isInteger(score.game1_score2)) {
            return null;
        }
        if (score.game1_score1 === score.game1_score2) return null;
        return score.game1_score1 > score.game1_score2 ? match.team1Id : match.team2Id;
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
    if (wins1 >= 2) return match.team1Id;
    if (wins2 >= 2) return match.team2Id;
    return null;
}

function computeRounds(seedOrder, bracketSize, scores, bestOfThree) {
    const seedSlots = seedOrderForSize(bracketSize).map(seed => seedOrder[seed - 1] || null);
    const scoreMap = buildScoreMap(scores);
    const rounds = [];
    let currentTeams = [];

    for (let i = 0; i < seedSlots.length; i += 2) {
        currentTeams.push({
            team1Id: seedSlots[i],
            team2Id: seedSlots[i + 1],
            matchNumber: (i / 2) + 1
        });
    }

    const totalRounds = Math.log2(bracketSize);
    for (let round = 1; round <= totalRounds; round++) {
        const isFinal = round === totalRounds;
        const roundMatches = currentTeams.map(match => {
            const score = scoreMap.get(`${round}-${match.matchNumber}`) || null;
            return {
                roundNumber: round,
                matchNumber: match.matchNumber,
                team1Id: match.team1Id,
                team2Id: match.team2Id,
                score
            };
        });
        rounds.push(roundMatches);

        const winners = roundMatches.map(match => matchWinner(match, match.score, isFinal, bestOfThree, round));
        if (round < totalRounds) {
            const nextTeams = [];
            for (let i = 0; i < winners.length; i += 2) {
                nextTeams.push({
                    team1Id: winners[i] || null,
                    team2Id: winners[i + 1] || null,
                    matchNumber: (i / 2) + 1
                });
            }
            currentTeams = nextTeams;
        }
    }

    return rounds;
}

function computeBronzeTeams(rounds, totalRounds, bestOfThree) {
    if (totalRounds < 2) return { team1Id: null, team2Id: null };
    const semiRound = rounds[totalRounds - 2] || [];
    const losers = semiRound.map(match => matchWinner({
        team1Id: match.team1Id,
        team2Id: match.team2Id
    }, match.score, false, bestOfThree ? false : false, totalRounds - 1)).map((winner, idx) => {
        if (!winner) return null;
        const match = semiRound[idx];
        return winner === match.team1Id ? match.team2Id : match.team1Id;
    });
    return { team1Id: losers[0] || null, team2Id: losers[1] || null };
}

export async function onRequestGet({ env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    const playoffState = await getPlayoffState(env, tournamentId);
    if (!playoffState) {
        return jsonResponse({ status: 'none' });
    }

    const tournamentMeta = await getTournamentMeta(env, tournamentId);
    const duprSubmission = await getLatestDuprSubmission(env, tournamentId);
    const teams = await listTeams(env, tournamentId);
    const scores = await listScores(env, tournamentId);
    const seedOrder = playoffState.seed_order ? JSON.parse(playoffState.seed_order) : [];
    const bracketSize = playoffState.bracket_size || 2;
    const bestOfThree = playoffState.best_of_three === 1;
    const bestOfThreeBronze = playoffState.bronze_best_of_three === 1;
    const rounds = computeRounds(seedOrder, bracketSize, scores, bestOfThree);
    const totalRounds = Math.log2(bracketSize);
    const finalMatch = (rounds[totalRounds - 1] || []).find(match => match.matchNumber === 1) || null;
    const goldWinner = finalMatch
        ? matchWinner(finalMatch, finalMatch.score, true, bestOfThree, totalRounds)
        : null;
    let bronzeWinner = null;
    if (bracketSize >= 4) {
        const bronzeTeams = computeBronzeTeams(rounds, totalRounds, bestOfThree);
        const scoreMap = buildScoreMap(scores);
        const bronzeScore = scoreMap.get(`${totalRounds}-2`) || null;
        bronzeWinner = matchWinner(
            { team1Id: bronzeTeams.team1Id, team2Id: bronzeTeams.team2Id },
            bronzeScore,
            true,
            bestOfThreeBronze,
            totalRounds
        );
    }

    return jsonResponse({
        status: playoffState.status || 'playoff',
        tournamentStatus: tournamentMeta?.status || 'upcoming',
        duprSubmission: duprSubmission
            ? {
                success: duprSubmission.success === 1,
                submittedAt: duprSubmission.created_at
            }
            : null,
        seedOrder,
        playoffTeams: playoffState.playoff_teams,
        bestOfThree,
        bestOfThreeBronze,
        bracketSize,
        isComplete: Boolean(goldWinner) && (bracketSize < 4 || Boolean(bronzeWinner)),
        scores,
        teams
    });
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

    const playoffState = await getPlayoffState(env, tournamentId);
    if (!playoffState || playoffState.status !== 'playoff') {
        return jsonResponse({ error: 'Playoff not started' }, 400);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { roundNumber, matchNumber, games, expectedVersion } = body;
    if (!Number.isInteger(roundNumber) || !Number.isInteger(matchNumber) || !games || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
        return jsonResponse({ error: 'roundNumber, matchNumber, games, expectedVersion required' }, 400);
    }

    const seedOrder = playoffState.seed_order ? JSON.parse(playoffState.seed_order) : [];
    const scores = await listScores(env, tournamentId);
    const bracketSize = playoffState.bracket_size || 2;
    const rounds = computeRounds(seedOrder, bracketSize, scores, playoffState.best_of_three === 1);
    const totalRounds = Math.log2(bracketSize);
    const roundMatches = rounds[roundNumber - 1] || [];
    let match = roundMatches.find(entry => entry.matchNumber === matchNumber);
    const isFinalRound = roundNumber === totalRounds;
    if (!match && isFinalRound && matchNumber === 2 && bracketSize >= 4) {
        const bronzeTeams = computeBronzeTeams(rounds, totalRounds, playoffState.best_of_three === 1);
        match = { team1Id: bronzeTeams.team1Id, team2Id: bronzeTeams.team2Id };
    }
    if (!match) {
        return jsonResponse({ error: 'Match not found' }, 404);
    }

    const requester = await getUserById(env, auth.userId);
    const isAdmin = requester && requester.is_admin;
    if (!isAdmin) {
        const teams = await userTeams(env, tournamentId, auth.userId);
        if (!match.team1Id || !match.team2Id || (!teams.has(match.team1Id) && !teams.has(match.team2Id))) {
            return jsonResponse({ error: 'Forbidden' }, 403);
        }
    }

    const isFinal = roundNumber === totalRounds;
    const isGoldMatch = matchNumber === 1;
    const isBronzeMatch = matchNumber === 2 && isFinal && bracketSize >= 4;
    const bestOfThree = playoffState.best_of_three === 1 && isFinal && isGoldMatch;
    const bestOfThreeBronze = playoffState.bronze_best_of_three === 1 && isBronzeMatch;

    const normalizeScore = (value) => (Number.isInteger(value) ? value : null);
    const game1 = games.game1 || {};
    const game2 = games.game2 || {};
    const game3 = games.game3 || {};
    const game1Score1 = normalizeScore(game1.score1);
    const game1Score2 = normalizeScore(game1.score2);
    const game2Score1 = normalizeScore(game2.score1);
    const game2Score2 = normalizeScore(game2.score2);
    const game3Score1 = normalizeScore(game3.score1);
    const game3Score2 = normalizeScore(game3.score2);

    const isCompletePair = (a, b) => Number.isInteger(a) && Number.isInteger(b);
    const hasAnyPairValue = (a, b) => Number.isInteger(a) || Number.isInteger(b);
    const game1Complete = isCompletePair(game1Score1, game1Score2);
    const game2Complete = isCompletePair(game2Score1, game2Score2);
    const game3Complete = isCompletePair(game3Score1, game3Score2);
    const game1Any = hasAnyPairValue(game1Score1, game1Score2);
    const game2Any = hasAnyPairValue(game2Score1, game2Score2);
    const game3Any = hasAnyPairValue(game3Score1, game3Score2);

    const allScores = [
        game1Score1, game1Score2,
        game2Score1, game2Score2,
        game3Score1, game3Score2
    ];
    const hasAnyScore = allScores.some(score => Number.isInteger(score));
    if (!hasAnyScore) {
        let deleteResult;
        if (expectedVersion === 0) {
            deleteResult = await env.DB.prepare(
                'DELETE FROM playoff_scores WHERE tournament_id = ? AND round_number = ? AND match_number = ? AND version = 0'
            ).bind(tournamentId, roundNumber, matchNumber).run();
            const existing = await getCurrentScore(env, tournamentId, roundNumber, matchNumber);
            if (!existing || (deleteResult.meta && deleteResult.meta.changes === 1)) {
                return jsonResponse({ success: true, version: 0 });
            }
            return jsonResponse({
                error: 'Score was updated by another user',
                conflict: true,
                current: existing
            }, 409);
        }

        deleteResult = await env.DB.prepare(
            'DELETE FROM playoff_scores WHERE tournament_id = ? AND round_number = ? AND match_number = ? AND version = ?'
        ).bind(tournamentId, roundNumber, matchNumber, expectedVersion).run();
        if (deleteResult.meta && deleteResult.meta.changes === 1) {
            return jsonResponse({ success: true, version: 0 });
        }
        const existing = await getCurrentScore(env, tournamentId, roundNumber, matchNumber);
        return jsonResponse({
            error: 'Score was updated by another user',
            conflict: true,
            current: existing || null
        }, 409);
    }

    if (game1Any && !game1Complete) {
        return jsonResponse({ error: 'Game 1 requires both team scores' }, 400);
    }
    if (game2Any && !game2Complete) {
        return jsonResponse({ error: 'Game 2 requires both team scores' }, 400);
    }
    if (game3Any && !game3Complete) {
        return jsonResponse({ error: 'Game 3 requires both team scores' }, 400);
    }

    if (!Number.isInteger(game1Score1) || !Number.isInteger(game1Score2)) {
        return jsonResponse({ error: 'Game 1 scores required' }, 400);
    }
    if (!bestOfThree && !bestOfThreeBronze) {
        if (game2Score1 !== null || game2Score2 !== null || game3Score1 !== null || game3Score2 !== null) {
            return jsonResponse({ error: 'Only finals support best of three' }, 400);
        }
    } else {
        if (game3Any && !game2Complete) {
            return jsonResponse({ error: 'Game 2 must be completed before entering Game 3' }, 400);
        }
    }

    const nextVersion = expectedVersion + 1;
    let writeResult;
    if (expectedVersion === 0) {
        writeResult = await env.DB.prepare(
            `INSERT INTO playoff_scores
                (tournament_id, round_number, match_number, game1_score1, game1_score2, game2_score1, game2_score2, game3_score1, game3_score2, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(tournament_id, round_number, match_number) DO UPDATE SET
                game1_score1 = excluded.game1_score1,
                game1_score2 = excluded.game1_score2,
                game2_score1 = excluded.game2_score1,
                game2_score2 = excluded.game2_score2,
                game3_score1 = excluded.game3_score1,
                game3_score2 = excluded.game3_score2,
                version = playoff_scores.version + 1,
                updated_at = CURRENT_TIMESTAMP
             WHERE playoff_scores.version = 0`
        ).bind(
            tournamentId,
            roundNumber,
            matchNumber,
            game1Score1,
            game1Score2,
            (bestOfThree || bestOfThreeBronze) ? game2Score1 : null,
            (bestOfThree || bestOfThreeBronze) ? game2Score2 : null,
            (bestOfThree || bestOfThreeBronze) ? game3Score1 : null,
            (bestOfThree || bestOfThreeBronze) ? game3Score2 : null,
            nextVersion
        ).run();
    } else {
        writeResult = await env.DB.prepare(
            `UPDATE playoff_scores
             SET game1_score1 = ?,
                 game1_score2 = ?,
                 game2_score1 = ?,
                 game2_score2 = ?,
                 game3_score1 = ?,
                 game3_score2 = ?,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE tournament_id = ? AND round_number = ? AND match_number = ? AND version = ?`
        ).bind(
            game1Score1,
            game1Score2,
            (bestOfThree || bestOfThreeBronze) ? game2Score1 : null,
            (bestOfThree || bestOfThreeBronze) ? game2Score2 : null,
            (bestOfThree || bestOfThreeBronze) ? game3Score1 : null,
            (bestOfThree || bestOfThreeBronze) ? game3Score2 : null,
            tournamentId,
            roundNumber,
            matchNumber,
            expectedVersion
        ).run();
    }

    if (!(writeResult.meta && writeResult.meta.changes === 1)) {
        const existing = await getCurrentScore(env, tournamentId, roundNumber, matchNumber);
        return jsonResponse({
            error: 'Score was updated by another user',
            conflict: true,
            current: existing || null
        }, 409);
    }

    return jsonResponse({ success: true, version: nextVersion });
}
