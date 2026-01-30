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

async function getTournamentState(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function getPlayoffState(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT status FROM playoff_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function getTeams(env, tournamentId) {
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

    return (result.results || []).map(row => ({
        id: row.team_id,
        name: row.team_name || 'Team'
    }));
}

async function getRoundRobinMatches(env, tournamentId) {
    const result = await env.DB.prepare(
        `SELECT m.team1_id,
                m.team2_id,
                s.score1,
                s.score2
         FROM round_robin_matches m
         LEFT JOIN round_robin_scores s ON s.match_id = m.id
         WHERE m.tournament_id = ?`
    ).bind(tournamentId).all();

    return result.results || [];
}

async function getSettings(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT playoff_teams, playoff_best_of_three FROM tournament_settings WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

function computeStandings(teams, matches) {
    const stats = new Map();
    teams.forEach(team => {
        stats.set(team.id, {
            teamId: team.id,
            name: team.name,
            wins: 0,
            losses: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            games: 0
        });
    });

    matches.forEach(match => {
        if (!Number.isInteger(match.score1) || !Number.isInteger(match.score2)) return;
        const team1 = stats.get(match.team1_id);
        const team2 = stats.get(match.team2_id);
        if (!team1 || !team2) return;
        team1.pointsFor += match.score1;
        team1.pointsAgainst += match.score2;
        team2.pointsFor += match.score2;
        team2.pointsAgainst += match.score1;
        team1.games += 1;
        team2.games += 1;
        if (match.score1 > match.score2) {
            team1.wins += 1;
            team2.losses += 1;
        } else if (match.score2 > match.score1) {
            team2.wins += 1;
            team1.losses += 1;
        }
    });

    return Array.from(stats.values()).map(team => {
        const diffTotal = team.pointsFor - team.pointsAgainst;
        const avgDiff = team.games > 0 ? diffTotal / team.games : 0;
        return { ...team, avgDiff };
    }).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;
        if (b.avgDiff !== a.avgDiff) return b.avgDiff - a.avgDiff;
        return a.name.localeCompare(b.name);
    });
}

function bracketSizeForTeams(count) {
    if (count <= 2) return 2;
    if (count <= 4) return 4;
    return 8;
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

    const tournamentState = await getTournamentState(env, tournamentId);
    if (!tournamentState || tournamentState.status !== 'tournament') {
        return jsonResponse({ error: 'Round robin not started' }, 400);
    }

    const playoffState = await getPlayoffState(env, tournamentId);
    if (playoffState?.status === 'playoff') {
        return jsonResponse({ error: 'Playoff already started' }, 400);
    }

    const teams = await getTeams(env, tournamentId);
    if (teams.length < 2) {
        return jsonResponse({ error: 'At least 2 teams are required' }, 400);
    }

    const settings = await getSettings(env, tournamentId);
    let playoffTeams = settings?.playoff_teams ?? null;
    if (!Number.isInteger(playoffTeams) || playoffTeams < 2) {
        playoffTeams = Math.min(8, teams.length);
    }
    if (playoffTeams > teams.length) {
        playoffTeams = teams.length;
    }
    if (playoffTeams > 8) {
        playoffTeams = 8;
    }

    const bestOfThree = settings?.playoff_best_of_three === 1;
    const standings = computeStandings(teams, await getRoundRobinMatches(env, tournamentId));
    const seededTeams = standings.slice(0, playoffTeams).map(team => team.teamId);
    const bracketSize = bracketSizeForTeams(playoffTeams);

    await env.DB.prepare(
        `INSERT INTO playoff_state (tournament_id, status, playoff_teams, best_of_three, bracket_size, seed_order)
         VALUES (?, 'playoff', ?, ?, ?, ?)
         ON CONFLICT(tournament_id) DO UPDATE SET
            status = 'playoff',
            playoff_teams = excluded.playoff_teams,
            best_of_three = excluded.best_of_three,
            bracket_size = excluded.bracket_size,
            seed_order = excluded.seed_order,
            started_at = CURRENT_TIMESTAMP`
    ).bind(
        tournamentId,
        playoffTeams,
        bestOfThree ? 1 : 0,
        bracketSize,
        JSON.stringify(seededTeams)
    ).run();

    await env.DB.prepare(
        'DELETE FROM playoff_scores WHERE tournament_id = ?'
    ).bind(tournamentId).run();

    return jsonResponse({ success: true });
}
