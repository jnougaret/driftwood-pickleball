import { verifyClerkToken } from '../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function ensureRateLimitTable(env) {
    await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at DATETIME NOT NULL)'
    ).run();
}

async function checkRateLimit(env, key, limit = 10, windowSeconds = 60) {
    await ensureRateLimitTable(env);
    const now = new Date();
    const existing = await env.DB.prepare(
        'SELECT count, reset_at FROM rate_limits WHERE key = ?'
    ).bind(key).first();

    if (!existing) {
        const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();
        await env.DB.prepare(
            'INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)'
        ).bind(key, 1, resetAt).run();
        return { allowed: true };
    }

    const resetAt = new Date(existing.reset_at);
    if (resetAt <= now) {
        const nextReset = new Date(now.getTime() + windowSeconds * 1000).toISOString();
        await env.DB.prepare(
            'UPDATE rate_limits SET count = ?, reset_at = ? WHERE key = ?'
        ).bind(1, nextReset, key).run();
        return { allowed: true };
    }

    if (existing.count >= limit) {
        return { allowed: false, retryAt: resetAt.toISOString() };
    }

    await env.DB.prepare(
        'UPDATE rate_limits SET count = count + 1 WHERE key = ?'
    ).bind(key).run();
    return { allowed: true };
}

async function listTeams(env, tournamentId) {
    const teams = await env.DB.prepare(
        `SELECT t.id AS team_id,
                u.id AS user_id,
                u.display_name AS display_name,
                u.doubles_rating AS doubles_rating,
                u.singles_rating AS singles_rating
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = tm.user_id
         WHERE t.tournament_id = ?
         ORDER BY t.created_at ASC, tm.created_at ASC`
    ).bind(tournamentId).all();

    const teamMap = new Map();
    for (const row of teams.results || []) {
        if (!teamMap.has(row.team_id)) {
            teamMap.set(row.team_id, { id: row.team_id, players: [] });
        }
        if (row.user_id) {
            teamMap.get(row.team_id).players.push({
                id: row.user_id,
                name: row.display_name || 'Player',
                doublesRating: row.doubles_rating,
                singlesRating: row.singles_rating
            });
        }
    }

    return Array.from(teamMap.values());
}

async function getMaxTeams(env, tournamentId) {
    const settings = await env.DB.prepare(
        'SELECT max_teams FROM tournament_settings WHERE tournament_id = ?'
    ).bind(tournamentId).first();
    return settings?.max_teams ?? 12;
}

async function getTournamentStatus(env, tournamentId) {
    const state = await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
    return state?.status ?? 'registration';
}

async function getUserProfile(env, userId) {
    return await env.DB.prepare(
        'SELECT id, dupr_id FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function findUserTeam(env, tournamentId, userId) {
    return await env.DB.prepare(
        `SELECT t.id AS team_id
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         WHERE t.tournament_id = ? AND tm.user_id = ?
         LIMIT 1`
    ).bind(tournamentId, userId).first();
}

// GET - list registrations (public)
export async function onRequestGet({ env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    try {
        const teams = await listTeams(env, tournamentId);
        return jsonResponse({ teams });
    } catch (error) {
        console.error('Registration list error:', error);
        return jsonResponse({ error: 'Failed to load registrations' }, 500);
    }
}

// POST - create a team or join a team (auth required)
export async function onRequestPost({ request, env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    const rateKey = `registrations:${auth.userId}`;
    const rate = await checkRateLimit(env, rateKey, 10, 60);
    if (!rate.allowed) {
        return jsonResponse({ error: 'Rate limit exceeded', retryAt: rate.retryAt }, 429);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const action = body.action;
    if (!action || (action !== 'create' && action !== 'join' && action !== 'add_guest')) {
        return jsonResponse({ error: 'Invalid action' }, 400);
    }

    try {
        const status = await getTournamentStatus(env, tournamentId);
        if (status !== 'registration') {
            return jsonResponse({ error: 'Tournament has started' }, 400);
        }
        const maxTeams = await getMaxTeams(env, tournamentId);
        const teamCountResult = await env.DB.prepare(
            'SELECT COUNT(*) AS count FROM teams WHERE tournament_id = ?'
        ).bind(tournamentId).first();
        const teamCount = teamCountResult?.count ?? 0;
        if (teamCount >= maxTeams) {
            return jsonResponse({ error: 'Registration is full' }, 400);
        }

        const userId = auth.userId;

        if (action === 'add_guest') {
            const requester = await getUserById(env, userId);
            if (!requester || !requester.is_admin) {
                return jsonResponse({ error: 'Forbidden' }, 403);
            }

            const displayName = String(body.displayName || '').trim();
            if (!displayName) {
                return jsonResponse({ error: 'Guest name is required' }, 400);
            }

            const parseRating = (value) => {
                if (value === null || value === undefined || value === '') return null;
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) return null;
                return parsed;
            };

            const doublesRating = parseRating(body.doublesRating);
            const singlesRating = parseRating(body.singlesRating);
            if ((body.doublesRating !== null && body.doublesRating !== undefined && body.doublesRating !== '' && doublesRating === null) ||
                (body.singlesRating !== null && body.singlesRating !== undefined && body.singlesRating !== '' && singlesRating === null)) {
                return jsonResponse({ error: 'Ratings must be numbers between 0 and 10' }, 400);
            }

            const guestId = `guest_${crypto.randomUUID()}`;
            const guestEmail = `${guestId}@guest.driftwood.local`;
            const teamId = crypto.randomUUID();

            await env.DB.batch([
                env.DB.prepare(
                    `INSERT INTO users (id, email, display_name, dupr_id, doubles_rating, singles_rating)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(guestId, guestEmail, displayName, null, doublesRating, singlesRating),
                env.DB.prepare(
                    'INSERT INTO teams (id, tournament_id, created_by) VALUES (?, ?, ?)'
                ).bind(teamId, tournamentId, userId),
                env.DB.prepare(
                    'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)'
                ).bind(teamId, guestId)
            ]);

            const teams = await listTeams(env, tournamentId);
            return jsonResponse({ teams });
        }

        const profile = await getUserProfile(env, userId);
        if (!profile) {
            return jsonResponse({ error: 'Profile required before registering' }, 400);
        }
        if (!profile.dupr_id) {
            return jsonResponse({ error: 'DUPR account must be linked before registering' }, 400);
        }

        const existing = await findUserTeam(env, tournamentId, userId);
        if (existing) {
            return jsonResponse({ error: 'Already registered' }, 400);
        }

        if (action === 'create') {
            const teamId = crypto.randomUUID();
            await env.DB.batch([
                env.DB.prepare(
                    'INSERT INTO teams (id, tournament_id, created_by) VALUES (?, ?, ?)'
                ).bind(teamId, tournamentId, userId),
                env.DB.prepare(
                    'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)'
                ).bind(teamId, userId)
            ]);

            const teams = await listTeams(env, tournamentId);
            return jsonResponse({ teams });
        }

        const teamId = body.teamId;
        if (!teamId) {
            return jsonResponse({ error: 'Missing teamId' }, 400);
        }

        const team = await env.DB.prepare(
            'SELECT id FROM teams WHERE id = ? AND tournament_id = ?'
        ).bind(teamId, tournamentId).first();

        if (!team) {
            return jsonResponse({ error: 'Team not found' }, 404);
        }

        const members = await env.DB.prepare(
            'SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?'
        ).bind(teamId).first();

        if (members && members.count >= 2) {
            return jsonResponse({ error: 'Team is full' }, 400);
        }

        await env.DB.prepare(
            'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)'
        ).bind(teamId, userId).run();

        const teams = await listTeams(env, tournamentId);
        return jsonResponse({ teams });
    } catch (error) {
        console.error('Registration update error:', error);
        return jsonResponse({ error: 'Failed to update registration' }, 500);
    }
}

// DELETE - leave team (auth required)
export async function onRequestDelete({ request, env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    const auth = await verifyClerkToken(request);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    try {
        const userId = auth.userId;
        const team = await findUserTeam(env, tournamentId, userId);
        if (!team) {
            return jsonResponse({ error: 'Not registered' }, 400);
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

        const teams = await listTeams(env, tournamentId);
        return jsonResponse({ teams });
    } catch (error) {
        console.error('Registration leave error:', error);
        return jsonResponse({ error: 'Failed to leave registration' }, 500);
    }
}
