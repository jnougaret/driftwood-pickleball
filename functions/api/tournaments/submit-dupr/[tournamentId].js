import { verifyClerkToken } from '../../_auth.js';
import { fetchPartnerAccessToken, getDuprEnv, getDuprBase } from '../../dupr/_partner.js';
import {
    fetchDuprMatchById,
    insertSubmittedMatch,
    parseDuprMatchMeta,
    updateSubmittedMatchVerification
} from '../../dupr/_submitted_matches.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function toIntegerOrNull(value) {
    return Number.isInteger(value) ? value : null;
}

function safeJsonString(value) {
    try {
        return JSON.stringify(value);
    } catch (error) {
        return null;
    }
}

function playoffSeedOrderForSize(size) {
    if (size === 2) return [1, 2];
    if (size === 4) return [1, 4, 2, 3];
    return [1, 8, 4, 5, 2, 7, 3, 6];
}

function buildPlayoffScoreMap(scores) {
    const map = new Map();
    scores.forEach(score => {
        map.set(`${score.round_number}-${score.match_number}`, score);
    });
    return map;
}

function evaluateBestOfThree(score) {
    if (!score) return { complete: false, winnerTeam: null, gamesPlayed: [] };
    const games = [
        [toIntegerOrNull(score.game1_score1), toIntegerOrNull(score.game1_score2)],
        [toIntegerOrNull(score.game2_score1), toIntegerOrNull(score.game2_score2)],
        [toIntegerOrNull(score.game3_score1), toIntegerOrNull(score.game3_score2)]
    ];
    let wins1 = 0;
    let wins2 = 0;
    const gamesPlayed = [];
    for (const game of games) {
        const [s1, s2] = game;
        if (!Number.isInteger(s1) || !Number.isInteger(s2) || s1 === s2) {
            continue;
        }
        gamesPlayed.push([s1, s2]);
        if (s1 > s2) wins1 += 1;
        if (s2 > s1) wins2 += 1;
        if (wins1 >= 2 || wins2 >= 2) break;
    }
    if (wins1 >= 2) return { complete: true, winnerTeam: 1, gamesPlayed };
    if (wins2 >= 2) return { complete: true, winnerTeam: 2, gamesPlayed };
    return { complete: false, winnerTeam: null, gamesPlayed };
}

function playoffMatchWinner(match, score, isFinal, bestOfThree, roundNumber) {
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
    const result = evaluateBestOfThree(score);
    if (!result.complete) return null;
    return result.winnerTeam === 1 ? match.team1Id : match.team2Id;
}

function playoffMatchLoser(match, score, isFinal, bestOfThree, roundNumber) {
    const winner = playoffMatchWinner(match, score, isFinal, bestOfThree, roundNumber);
    if (!winner) return null;
    return winner === match.team1Id ? match.team2Id : match.team1Id;
}

function computePlayoffRounds(seedOrder, bracketSize, scores, bestOfThree) {
    const seedSlots = playoffSeedOrderForSize(bracketSize).map(seed => seedOrder[seed - 1] || null);
    const scoreMap = buildPlayoffScoreMap(scores);
    const rounds = [];
    let current = [];

    for (let i = 0; i < seedSlots.length; i += 2) {
        current.push({
            team1Id: seedSlots[i],
            team2Id: seedSlots[i + 1],
            matchNumber: (i / 2) + 1
        });
    }

    const totalRounds = Math.log2(bracketSize);
    for (let round = 1; round <= totalRounds; round++) {
        const isFinal = round === totalRounds;
        const roundMatches = current.map(match => {
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

        const winners = roundMatches.map(match => playoffMatchWinner(match, match.score, isFinal, bestOfThree, round));
        if (round < totalRounds) {
            const next = [];
            for (let i = 0; i < winners.length; i += 2) {
                next.push({
                    team1Id: winners[i] || null,
                    team2Id: winners[i + 1] || null,
                    matchNumber: (i / 2) + 1
                });
            }
            current = next;
        }
    }

    return rounds;
}

function getPlayoffRoundName(bracketSize, roundNumber, matchNumber, totalRounds) {
    if (roundNumber === totalRounds && matchNumber === 2 && bracketSize >= 4) {
        return 'Bronze Match';
    }
    if (bracketSize === 2) return 'Finals';
    if (bracketSize === 4) return roundNumber === 1 ? 'Semi-finals' : 'Finals';
    if (bracketSize === 8) {
        if (roundNumber === 1) return 'Quarter-finals';
        if (roundNumber === 2) return 'Semi-finals';
        return 'Finals';
    }
    return `Round ${roundNumber}`;
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, email, is_admin, dupr_id FROM users WHERE id = ?'
    ).bind(userId).first();
}

function getClubMembershipUrl(env, duprEnv, duprId) {
    const explicit = (env.DUPR_USER_CLUBS_URL || '').trim();
    if (explicit) {
        return explicit.replace('{duprId}', encodeURIComponent(String(duprId)));
    }
    return `${getDuprBase(duprEnv)}/api/user/v1.0/${encodeURIComponent(String(duprId))}/clubs`;
}

async function fetchUserClubMembership(env, accessToken, duprEnv, duprId) {
    const url = getClubMembershipUrl(env, duprEnv, duprId);
    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return { ok: false, error: 'Unable to reach DUPR club membership endpoint', endpoint: url };
    }

    const rawText = await response.text();
    let payload = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
        payload = rawText;
    }

    if (!response.ok) {
        return {
            ok: false,
            error: 'DUPR club membership lookup failed',
            status: response.status,
            endpoint: url,
            response: payload
        };
    }

    const membership = Array.isArray(payload?.membership) ? payload.membership : [];
    return { ok: true, endpoint: url, membership };
}

async function ensureSubmissionTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS dupr_match_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id TEXT NOT NULL,
            submitted_by TEXT NOT NULL,
            dupr_env TEXT NOT NULL DEFAULT 'uat',
            endpoint TEXT NOT NULL,
            match_count INTEGER NOT NULL DEFAULT 0,
            status_code INTEGER,
            success INTEGER NOT NULL DEFAULT 0,
            response TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
}

async function getLatestSuccessfulSubmission(env, tournamentId) {
    return await env.DB.prepare(
        `SELECT id, created_at
         FROM dupr_match_submissions
         WHERE tournament_id = ? AND success = 1
         ORDER BY id DESC
         LIMIT 1`
    ).bind(tournamentId).first();
}

async function logSubmissionAttempt(env, payload) {
    await ensureSubmissionTable(env);
    const result = await env.DB.prepare(
        `INSERT INTO dupr_match_submissions (
            tournament_id, submitted_by, dupr_env, endpoint, match_count, status_code, success, response
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        payload.tournamentId,
        payload.submittedBy,
        payload.duprEnv,
        payload.endpoint,
        payload.matchCount,
        payload.statusCode,
        payload.success ? 1 : 0,
        safeJsonString(payload.response)
    ).run();
    return result.meta?.last_row_id || null;
}

async function getTournamentContext(env, tournamentId) {
    return await env.DB.prepare(
        `SELECT t.id,
                t.title,
                t.location,
                t.start_date,
                t.format_type,
                ts.status AS tournament_state,
                ps.status AS playoff_status,
                ps.bracket_size,
                ps.seed_order,
                ps.best_of_three,
                ps.bronze_best_of_three,
                COALESCE(s.dupr_required, 0) AS dupr_required
         FROM tournaments t
         LEFT JOIN tournament_state ts ON ts.tournament_id = t.id
         LEFT JOIN playoff_state ps ON ps.tournament_id = t.id
         LEFT JOIN tournament_settings s ON s.tournament_id = t.id
         WHERE t.id = ?`
    ).bind(tournamentId).first();
}

async function getTeamDuprData(env, tournamentId) {
    const rows = await env.DB.prepare(
        `SELECT t.id AS team_id,
                u.dupr_id
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = tm.user_id
         WHERE t.tournament_id = ?
         ORDER BY t.created_at ASC, tm.created_at ASC`
    ).bind(tournamentId).all();

    const byTeam = new Map();
    (rows.results || []).forEach(row => {
        if (!byTeam.has(row.team_id)) {
            byTeam.set(row.team_id, []);
        }
        if (row.dupr_id) {
            byTeam.get(row.team_id).push(String(row.dupr_id).trim());
        }
    });
    return byTeam;
}

async function getDuprDisplayNameMap(env, tournamentId) {
    const rows = await env.DB.prepare(
        `SELECT u.dupr_id, u.display_name
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         JOIN users u ON u.id = tm.user_id
         WHERE t.tournament_id = ? AND u.dupr_id IS NOT NULL`
    ).bind(tournamentId).all();
    const map = new Map();
    (rows.results || []).forEach(row => {
        const duprId = String(row.dupr_id || '').trim();
        if (!duprId) return;
        if (!map.has(duprId)) {
            map.set(duprId, String(row.display_name || duprId));
        }
    });
    return map;
}

async function getRoundRobinCompletedMatches(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT m.id,
                m.round_number,
                m.team1_id,
                m.team2_id,
                s.score1,
                s.score2
         FROM round_robin_matches m
         JOIN round_robin_scores s ON s.match_id = m.id
         WHERE m.tournament_id = ?
         ORDER BY m.round_number ASC, m.id ASC`
    ).bind(tournamentId).all();
    return (result.results || []).filter(row => (
        Number.isInteger(row.score1) &&
        Number.isInteger(row.score2) &&
        row.score1 !== row.score2
    ));
}

async function getPlayoffScores(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT round_number,
                match_number,
                game1_score1,
                game1_score2,
                game2_score1,
                game2_score2,
                game3_score1,
                game3_score2
         FROM playoff_scores
         WHERE tournament_id = ?
         ORDER BY round_number ASC, match_number ASC`
    ).bind(tournamentId).all();
    return result.results || [];
}

function buildExternalMatchRequest(options) {
    const {
        teamAPlayers,
        teamBPlayers,
        scores,
        tournament,
        bracketName,
        identifier
    } = options;
    const body = {
        location: tournament.location,
        matchDate: tournament.start_date,
        format: 'DOUBLES',
        event: tournament.title,
        bracket: bracketName,
        matchType: 'SIDEOUT',
        identifier,
        teamA: {
            player1: teamAPlayers[0],
            player2: teamAPlayers[1],
            game1: scores[0][0]
        },
        teamB: {
            player1: teamBPlayers[0],
            player2: teamBPlayers[1],
            game1: scores[0][1]
        }
    };

    if (scores[1]) {
        body.teamA.game2 = scores[1][0];
        body.teamB.game2 = scores[1][1];
    }
    if (scores[2]) {
        body.teamA.game3 = scores[2][0];
        body.teamB.game3 = scores[2][1];
    }

    const clubIdRaw = (options.clubId || '').toString().trim();
    if (clubIdRaw && Number.isInteger(Number(clubIdRaw))) {
        body.clubId = Number(clubIdRaw);
    }
    return body;
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
    if (!requester.dupr_id) {
        return jsonResponse({ error: 'Submitting admin must link a DUPR account first' }, 400);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        body = {};
    }
    const force = body.force === true;

    const tournament = await getTournamentContext(env, tournamentId);
    if (!tournament) {
        return jsonResponse({ error: 'Tournament not found' }, 404);
    }
    if (tournament.dupr_required !== 1) {
        return jsonResponse({ error: 'Tournament is not marked as DUPR reported' }, 400);
    }
    if (!tournament.start_date) {
        return jsonResponse({ error: 'Tournament start date is required before DUPR submission' }, 400);
    }
    if (tournament.tournament_state !== 'tournament') {
        return jsonResponse({ error: 'Round robin must be started before DUPR submission' }, 400);
    }
    if (tournament.playoff_status !== 'playoff') {
        return jsonResponse({ error: 'Playoff must be started before DUPR submission' }, 400);
    }
    const clubIdRaw = String(env.DUPR_CLUB_ID || '').trim();
    if (!clubIdRaw || !Number.isInteger(Number(clubIdRaw))) {
        return jsonResponse({ error: 'DUPR_CLUB_ID must be configured as a numeric value' }, 500);
    }
    const clubId = Number(clubIdRaw);

    const latestSuccess = await getLatestSuccessfulSubmission(env, tournamentId);
    if (latestSuccess && !force) {
        return jsonResponse({
            error: 'Tournament was already submitted to DUPR',
            submittedAt: latestSuccess.created_at
        }, 400);
    }

    const teamDuprMap = await getTeamDuprData(env, tournamentId);
    const duprDisplayNameMap = await getDuprDisplayNameMap(env, tournamentId);
    const getTeamPlayers = (teamId) => (teamDuprMap.get(teamId) || []).filter(Boolean);

    const roundRobin = await getRoundRobinCompletedMatches(env, tournamentId);
    const payloadMatches = [];
    const payloadMeta = [];
    const skippedMatches = [];

    roundRobin.forEach(match => {
        const teamAPlayers = getTeamPlayers(match.team1_id);
        const teamBPlayers = getTeamPlayers(match.team2_id);
        if (teamAPlayers.length < 2 || teamBPlayers.length < 2) {
            skippedMatches.push({
                source: 'round_robin',
                matchId: match.id,
                reason: 'Missing linked DUPR IDs on one or both teams'
            });
            return;
        }
        const requestPayload = buildExternalMatchRequest({
            teamAPlayers,
            teamBPlayers,
            scores: [[match.score1, match.score2]],
            tournament,
            bracketName: `Round Robin - Round ${match.round_number}`,
            identifier: `${tournamentId}:rr:${match.id}`,
            clubId: env.DUPR_CLUB_ID
        });
        payloadMatches.push(requestPayload);
        payloadMeta.push({
            tournamentId,
            eventName: requestPayload.event,
            bracketName: requestPayload.bracket,
            location: requestPayload.location,
            matchDate: requestPayload.matchDate,
            identifier: requestPayload.identifier,
            teamAPlayer1Dupr: requestPayload.teamA.player1,
            teamAPlayer2Dupr: requestPayload.teamA.player2 || null,
            teamBPlayer1Dupr: requestPayload.teamB.player1,
            teamBPlayer2Dupr: requestPayload.teamB.player2 || null,
            teamAGame1: requestPayload.teamA.game1,
            teamBGame1: requestPayload.teamB.game1,
            teamAGame2: requestPayload.teamA.game2 ?? null,
            teamBGame2: requestPayload.teamB.game2 ?? null,
            teamAGame3: requestPayload.teamA.game3 ?? null,
            teamBGame3: requestPayload.teamB.game3 ?? null,
            teamAGame4: requestPayload.teamA.game4 ?? null,
            teamBGame4: requestPayload.teamB.game4 ?? null,
            teamAGame5: requestPayload.teamA.game5 ?? null,
            teamBGame5: requestPayload.teamB.game5 ?? null
        });
    });

    const seedOrder = tournament.seed_order ? JSON.parse(tournament.seed_order) : [];
    const bracketSize = Number(tournament.bracket_size || 2);
    const playoffScores = await getPlayoffScores(env, tournamentId);
    const rounds = computePlayoffRounds(seedOrder, bracketSize, playoffScores, tournament.best_of_three === 1);
    const totalRounds = Math.log2(bracketSize);
    const scoreMap = buildPlayoffScoreMap(playoffScores);

    const finalRoundMatches = rounds[totalRounds - 1] || [];
    const goldFinal = finalRoundMatches.find(match => match.matchNumber === 1) || null;
    const goldScore = scoreMap.get(`${totalRounds}-1`) || (goldFinal ? goldFinal.score : null);
    let goldComplete = false;
    if (goldFinal && goldFinal.team1Id && goldFinal.team2Id && goldScore) {
        if (tournament.best_of_three === 1) {
            goldComplete = evaluateBestOfThree(goldScore).complete;
        } else {
            goldComplete = Number.isInteger(goldScore.game1_score1)
                && Number.isInteger(goldScore.game1_score2)
                && goldScore.game1_score1 !== goldScore.game1_score2;
        }
    }

    let bronzeComplete = true;
    if (bracketSize >= 4) {
        const semiRound = rounds[totalRounds - 2] || [];
        const semi1 = semiRound.find(match => match.matchNumber === 1) || null;
        const semi2 = semiRound.find(match => match.matchNumber === 2) || null;
        const semi1Loser = semi1 ? playoffMatchLoser(semi1, semi1.score, false, false, totalRounds - 1) : null;
        const semi2Loser = semi2 ? playoffMatchLoser(semi2, semi2.score, false, false, totalRounds - 1) : null;
        const bronzeScore = scoreMap.get(`${totalRounds}-2`) || null;
        bronzeComplete = false;
        if (semi1Loser && semi2Loser && bronzeScore) {
            if (tournament.bronze_best_of_three === 1) {
                bronzeComplete = evaluateBestOfThree(bronzeScore).complete;
            } else {
                bronzeComplete = Number.isInteger(bronzeScore.game1_score1)
                    && Number.isInteger(bronzeScore.game1_score2)
                    && bronzeScore.game1_score1 !== bronzeScore.game1_score2;
            }
        }
    }

    if (!goldComplete || !bronzeComplete) {
        return jsonResponse({ error: 'Playoff is not complete. Enter final scores before submitting to DUPR.' }, 400);
    }

    rounds.forEach((roundMatches, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const isFinal = roundNumber === totalRounds;
        roundMatches.forEach(match => {
            if (!match.team1Id || !match.team2Id) return;
            const score = scoreMap.get(`${roundNumber}-${match.matchNumber}`) || null;
            if (!score) return;

            let scoresToSend = null;
            if (isFinal && match.matchNumber === 1 && tournament.best_of_three === 1) {
                const series = evaluateBestOfThree(score);
                if (!series.complete) return;
                scoresToSend = series.gamesPlayed;
            } else if (isFinal && match.matchNumber === 2 && bracketSize >= 4 && tournament.bronze_best_of_three === 1) {
                const series = evaluateBestOfThree(score);
                if (!series.complete) return;
                scoresToSend = series.gamesPlayed;
            } else {
                const g1a = toIntegerOrNull(score.game1_score1);
                const g1b = toIntegerOrNull(score.game1_score2);
                if (!Number.isInteger(g1a) || !Number.isInteger(g1b) || g1a === g1b) return;
                scoresToSend = [[g1a, g1b]];
            }

            const teamAPlayers = getTeamPlayers(match.team1Id);
            const teamBPlayers = getTeamPlayers(match.team2Id);
            if (teamAPlayers.length < 2 || teamBPlayers.length < 2) {
                skippedMatches.push({
                    source: 'playoff',
                    roundNumber,
                    matchNumber: match.matchNumber,
                    reason: 'Missing linked DUPR IDs on one or both teams'
                });
                return;
            }

            const requestPayload = buildExternalMatchRequest({
                teamAPlayers,
                teamBPlayers,
                scores: scoresToSend,
                tournament,
                bracketName: getPlayoffRoundName(bracketSize, roundNumber, match.matchNumber, totalRounds),
                identifier: `${tournamentId}:po:r${roundNumber}:m${match.matchNumber}`,
                clubId: env.DUPR_CLUB_ID
            });
            payloadMatches.push(requestPayload);
            payloadMeta.push({
                tournamentId,
                eventName: requestPayload.event,
                bracketName: requestPayload.bracket,
                location: requestPayload.location,
                matchDate: requestPayload.matchDate,
                identifier: requestPayload.identifier,
                teamAPlayer1Dupr: requestPayload.teamA.player1,
                teamAPlayer2Dupr: requestPayload.teamA.player2 || null,
                teamBPlayer1Dupr: requestPayload.teamB.player1,
                teamBPlayer2Dupr: requestPayload.teamB.player2 || null,
                teamAGame1: requestPayload.teamA.game1,
                teamBGame1: requestPayload.teamB.game1,
                teamAGame2: requestPayload.teamA.game2 ?? null,
                teamBGame2: requestPayload.teamB.game2 ?? null,
                teamAGame3: requestPayload.teamA.game3 ?? null,
                teamBGame3: requestPayload.teamB.game3 ?? null,
                teamAGame4: requestPayload.teamA.game4 ?? null,
                teamBGame4: requestPayload.teamB.game4 ?? null,
                teamAGame5: requestPayload.teamA.game5 ?? null,
                teamBGame5: requestPayload.teamB.game5 ?? null
            });
        });
    });

    if (!payloadMatches.length) {
        return jsonResponse({
            error: 'No completed matches available to submit',
            skipped: skippedMatches
        }, 400);
    }

    const token = await fetchPartnerAccessToken(env);
    if (!token.ok) {
        return jsonResponse({ error: token.error, details: token.response || null }, 502);
    }

    const duprEnv = token.environment || getDuprEnv(env);
    const membership = await fetchUserClubMembership(env, token.accessToken, duprEnv, requester.dupr_id);
    if (!membership.ok) {
        return jsonResponse({
            error: membership.error || 'Unable to verify DUPR club membership',
            details: membership.response || null
        }, 502);
    }
    const clubMembership = membership.membership.find(item => Number(item?.clubId) === clubId) || null;
    const requesterEmail = String(requester.email || '').trim().toLowerCase();
    const masterEmail = String(env.MASTER_ADMIN_EMAIL || '').trim().toLowerCase();
    const isMasterAdmin = Boolean(masterEmail && requesterEmail && requesterEmail === masterEmail);
    if (!clubMembership && !isMasterAdmin) {
        return jsonResponse({
            error: 'Submitting admin is not a member of configured DUPR club',
            clubId
        }, 403);
    }
    const role = String(clubMembership?.role || '').toUpperCase();
    if (!isMasterAdmin && role !== 'DIRECTOR' && role !== 'ORGANIZER') {
        return jsonResponse({
            error: 'Submitting admin must be DUPR club DIRECTOR or ORGANIZER',
            clubId,
            role
        }, 403);
    }

    const endpoint = (env.DUPR_MATCH_BATCH_URL || '').trim()
        || `${getDuprBase(duprEnv)}/api/match/v1.0/batch`;

    let response;
    let responseBody = null;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadMatches)
        });
        const responseText = await response.text();
        try {
            responseBody = responseText ? JSON.parse(responseText) : null;
        } catch (error) {
            responseBody = responseText;
        }
    } catch (error) {
        await logSubmissionAttempt(env, {
            tournamentId,
            submittedBy: auth.userId,
            duprEnv,
            endpoint,
            matchCount: payloadMatches.length,
            statusCode: null,
            success: false,
            response: { error: 'Network error while submitting to DUPR' }
        });
        return jsonResponse({ error: 'Unable to reach DUPR match submission endpoint' }, 502);
    }

    const submissionId = await logSubmissionAttempt(env, {
        tournamentId,
        submittedBy: auth.userId,
        duprEnv,
        endpoint,
        matchCount: payloadMatches.length,
        statusCode: response.status,
        success: response.ok,
        response: responseBody
    });

    if (!response.ok) {
        return jsonResponse({
            error: 'DUPR batch submission failed',
            status: response.status,
            details: responseBody
        }, 502);
    }

    for (let i = 0; i < payloadMeta.length; i += 1) {
        const meta = payloadMeta[i];
        const parsed = parseDuprMatchMeta(responseBody, meta.identifier, i);
        await insertSubmittedMatch(env, {
            tournamentId: meta.tournamentId,
            submissionId,
            submittedBy: auth.userId,
            duprEnv,
            duprMatchId: parsed.matchId,
            duprMatchCode: parsed.matchCode,
            identifier: parsed.identifier || meta.identifier,
            eventName: meta.eventName,
            bracketName: meta.bracketName,
            location: meta.location,
            matchDate: meta.matchDate,
            format: 'DOUBLES',
            matchType: 'SIDEOUT',
            clubId,
            teamAPlayer1: duprDisplayNameMap.get(meta.teamAPlayer1Dupr) || meta.teamAPlayer1Dupr,
            teamAPlayer2: meta.teamAPlayer2Dupr ? (duprDisplayNameMap.get(meta.teamAPlayer2Dupr) || meta.teamAPlayer2Dupr) : null,
            teamBPlayer1: duprDisplayNameMap.get(meta.teamBPlayer1Dupr) || meta.teamBPlayer1Dupr,
            teamBPlayer2: meta.teamBPlayer2Dupr ? (duprDisplayNameMap.get(meta.teamBPlayer2Dupr) || meta.teamBPlayer2Dupr) : null,
            teamAPlayer1Dupr: meta.teamAPlayer1Dupr,
            teamAPlayer2Dupr: meta.teamAPlayer2Dupr,
            teamBPlayer1Dupr: meta.teamBPlayer1Dupr,
            teamBPlayer2Dupr: meta.teamBPlayer2Dupr,
            teamAGame1: meta.teamAGame1,
            teamBGame1: meta.teamBGame1,
            teamAGame2: meta.teamAGame2,
            teamBGame2: meta.teamBGame2,
            teamAGame3: meta.teamAGame3,
            teamBGame3: meta.teamBGame3,
            teamAGame4: meta.teamAGame4,
            teamBGame4: meta.teamBGame4,
            teamAGame5: meta.teamAGame5,
            teamBGame5: meta.teamBGame5,
            status: 'submitted',
            lastStatusCode: response.status,
            lastResponse: safeJsonString(responseBody)
        });

        const saved = await env.DB.prepare(
            `SELECT id FROM dupr_submitted_matches
             WHERE identifier = ? AND dupr_env = ?
             ORDER BY id DESC
             LIMIT 1`
        ).bind(parsed.identifier || meta.identifier, duprEnv).first();
        const insertedId = saved && Number.isInteger(saved.id) ? saved.id : null;
        if (insertedId && Number.isInteger(parsed.matchId)) {
            const verification = await fetchDuprMatchById(env, token.accessToken, duprEnv, parsed.matchId);
            await updateSubmittedMatchVerification(
                env,
                insertedId,
                verification.ok ? 'verified' : 'verify_failed',
                safeJsonString(verification.ok ? (verification.payload || {}) : {
                    error: verification.error || 'Verification failed',
                    status: verification.status,
                    response: verification.response || null
                })
            );
        }
    }

    return jsonResponse({
        success: true,
        submitted: payloadMatches.length,
        skipped: skippedMatches,
        endpoint,
        environment: duprEnv,
        response: responseBody
    });
}
