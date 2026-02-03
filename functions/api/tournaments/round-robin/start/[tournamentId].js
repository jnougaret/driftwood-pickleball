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

async function getTeams(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT t.id AS team_id,
                GROUP_CONCAT(u.display_name, ' / ') AS team_name,
                COUNT(u.id) AS player_count,
                SUM(COALESCE(u.doubles_rating, 0)) AS total_rating,
                MIN(t.created_at) AS created_at
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = tm.user_id
         WHERE t.tournament_id = ?
         GROUP BY t.id
         ORDER BY total_rating DESC, created_at ASC`
    ).bind(tournamentId).all();

    return (result.results || []).map(row => ({
        id: row.team_id,
        name: row.team_name || 'Open team',
        playerCount: Number(row.player_count || 0),
        rating: Number(row.total_rating || 0),
        createdAt: row.created_at
    }));
}

async function getTournamentStatus(env, tournamentId) {
    const state = await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
    return state?.status ?? 'registration';
}

async function ensureTournamentRow(env, tournamentId) {
    await env.DB.prepare(
        `INSERT OR IGNORE INTO tournaments (id, title, status)
         VALUES (?, ?, 'upcoming')`
    ).bind(tournamentId, tournamentId).run();
}

function generateRoundRobinPairings(teamIds, rounds) {
    const ids = [...teamIds];
    if (ids.length % 2 === 1) {
        ids.push(null);
    }
    const n = ids.length;
    const roundsToGenerate = Math.max(1, rounds);
    const schedule = [];
    const fixed = ids[0];
    let rotating = ids.slice(1);

    for (let round = 1; round <= roundsToGenerate; round++) {
        const pairs = [];
        const left = [fixed, ...rotating.slice(0, (n / 2) - 1)];
        const right = rotating.slice((n / 2) - 1).reverse();
        for (let i = 0; i < left.length; i++) {
            const team1 = left[i];
            const team2 = right[i];
            if (team1 && team2) {
                pairs.push([team1, team2]);
            } else if (team1 || team2) {
                pairs.push([team1 || null, team2 || null]);
            }
        }
        schedule.push(pairs);
        rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
    }
    return schedule;
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

    const settings = await env.DB.prepare(
        'SELECT rounds FROM tournament_settings WHERE tournament_id = ?'
    ).bind(tournamentId).first();
    const rounds = settings?.rounds ?? 6;

    await ensureTournamentRow(env, tournamentId);

    const status = await getTournamentStatus(env, tournamentId);
    if (status === 'tournament') {
        return jsonResponse({ error: 'Tournament already started' }, 400);
    }

    const teams = await getTeams(env, tournamentId);
    if (teams.length < 4) {
        return jsonResponse({ error: 'At least 4 teams are required' }, 400);
    }
    if (teams.some(team => team.playerCount < 2)) {
        return jsonResponse({ error: 'All teams must have two players' }, 400);
    }

    await env.DB.prepare(
        `DELETE FROM round_robin_scores
         WHERE match_id IN (SELECT id FROM round_robin_matches WHERE tournament_id = ?)`
    ).bind(tournamentId).run();
    await env.DB.prepare(
        'DELETE FROM round_robin_matches WHERE tournament_id = ?'
    ).bind(tournamentId).run();

    const sortedTeams = [...teams].sort((a, b) => {
        if (b.rating !== a.rating) {
            return b.rating - a.rating;
        }
        if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
            return a.createdAt.localeCompare(b.createdAt);
        }
        return 0;
    });
    const schedule = generateRoundRobinPairings(sortedTeams.map(t => t.id), rounds);
    const inserts = [];
    schedule.forEach((pairs, roundIndex) => {
        pairs.forEach(pair => {
            if (!pair[0] || !pair[1]) {
                return;
            }
            inserts.push(
                env.DB.prepare(
                    'INSERT INTO round_robin_matches (id, tournament_id, round_number, team1_id, team2_id) VALUES (?, ?, ?, ?, ?)'
                ).bind(crypto.randomUUID(), tournamentId, roundIndex + 1, pair[0], pair[1])
            );
        });
    });
    if (inserts.length) {
        await env.DB.batch(inserts);
    }

    await env.DB.prepare(
        `INSERT INTO tournament_state (tournament_id, status, started_at)
         VALUES (?, 'tournament', CURRENT_TIMESTAMP)
         ON CONFLICT(tournament_id) DO UPDATE SET
            status = 'tournament',
            started_at = CURRENT_TIMESTAMP`
    ).bind(tournamentId).run();

    return jsonResponse({ success: true });
}
