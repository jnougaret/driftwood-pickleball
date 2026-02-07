import { fetchPartnerAccessToken, getDuprBase, getDuprEnv } from './_partner.js';

export function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export function toIntegerOrNull(value) {
    return Number.isInteger(value) ? value : null;
}

export function normalizeGames(rawGames) {
    if (!Array.isArray(rawGames)) return [];
    const normalized = [];
    for (let i = 0; i < rawGames.length && i < 5; i += 1) {
        const game = rawGames[i] || {};
        const teamA = toIntegerOrNull(game.teamA);
        const teamB = toIntegerOrNull(game.teamB);
        if (!Number.isInteger(teamA) || !Number.isInteger(teamB) || teamA === teamB) {
            continue;
        }
        normalized.push({ teamA, teamB });
    }
    return normalized;
}

export async function ensureSubmittedMatchesTable(env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS dupr_submitted_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id TEXT,
            submission_id INTEGER,
            submitted_by TEXT NOT NULL,
            dupr_env TEXT NOT NULL DEFAULT 'uat',
            dupr_match_id INTEGER,
            dupr_match_code TEXT,
            identifier TEXT NOT NULL,
            event_name TEXT NOT NULL,
            bracket_name TEXT,
            location TEXT,
            match_date TEXT NOT NULL,
            format TEXT NOT NULL DEFAULT 'DOUBLES',
            match_type TEXT NOT NULL DEFAULT 'SIDEOUT',
            club_id INTEGER,
            team_a_player1 TEXT NOT NULL,
            team_a_player2 TEXT,
            team_b_player1 TEXT NOT NULL,
            team_b_player2 TEXT,
            team_a_player1_dupr TEXT NOT NULL,
            team_a_player2_dupr TEXT,
            team_b_player1_dupr TEXT NOT NULL,
            team_b_player2_dupr TEXT,
            team_a_game1 INTEGER NOT NULL,
            team_b_game1 INTEGER NOT NULL,
            team_a_game2 INTEGER,
            team_b_game2 INTEGER,
            team_a_game3 INTEGER,
            team_b_game3 INTEGER,
            team_a_game4 INTEGER,
            team_b_game4 INTEGER,
            team_a_game5 INTEGER,
            team_b_game5 INTEGER,
            status TEXT NOT NULL DEFAULT 'submitted',
            last_status_code INTEGER,
            last_response TEXT,
            deleted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(identifier, dupr_env)
        )
    `).run();
}

export async function getRequester(env, userId) {
    return await env.DB.prepare(
        'SELECT id, email, display_name, is_admin, dupr_id FROM users WHERE id = ?'
    ).bind(userId).first();
}

export async function getEligiblePlayers(env) {
    const result = await env.DB.prepare(
        `SELECT DISTINCT
            u.id,
            u.display_name,
            u.email,
            u.dupr_id
         FROM users u
         JOIN team_members tm ON tm.user_id = u.id
         WHERE u.dupr_id IS NOT NULL
         ORDER BY LOWER(u.display_name) ASC`
    ).all();
    return result.results || [];
}

function getClubMembershipUrl(env, duprEnv, duprId) {
    const explicit = (env.DUPR_USER_CLUBS_URL || '').trim();
    if (explicit) {
        return explicit.replace('{duprId}', encodeURIComponent(String(duprId)));
    }
    return `${getDuprBase(duprEnv)}/api/user/v1.0/${encodeURIComponent(String(duprId))}/clubs`;
}

async function parseFetchBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return text;
    }
}

export async function ensureRequesterCanSubmitToConfiguredClub(env, requester) {
    if (!requester || requester.is_admin !== 1) {
        return { ok: false, status: 403, error: 'Forbidden' };
    }
    if (!requester.dupr_id) {
        return { ok: false, status: 400, error: 'Submitting admin must link a DUPR account first' };
    }

    const clubIdRaw = String(env.DUPR_CLUB_ID || '').trim();
    if (!clubIdRaw || !Number.isInteger(Number(clubIdRaw))) {
        return { ok: false, status: 500, error: 'DUPR_CLUB_ID must be configured as a numeric value' };
    }
    const configuredClubId = Number(clubIdRaw);

    const token = await fetchPartnerAccessToken(env);
    if (!token.ok) {
        return { ok: false, status: 502, error: token.error || 'Failed to generate DUPR token', details: token.response || null };
    }

    const duprEnv = token.environment || getDuprEnv(env);

    // Master admin can operate regardless of DUPR club membership role.
    const masterEmail = String(env.MASTER_ADMIN_EMAIL || '').trim().toLowerCase();
    const requesterEmail = String(requester.email || '').trim().toLowerCase();
    if (masterEmail && requesterEmail && masterEmail === requesterEmail) {
        return {
            ok: true,
            token: token.accessToken,
            duprEnv,
            configuredClubId
        };
    }

    const membershipEndpoint = getClubMembershipUrl(env, duprEnv, requester.dupr_id);
    let membershipResponse;
    try {
        membershipResponse = await fetch(membershipEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        return { ok: false, status: 502, error: 'Unable to reach DUPR club membership endpoint' };
    }

    const membershipPayload = await parseFetchBody(membershipResponse);
    if (!membershipResponse.ok) {
        return {
            ok: false,
            status: 502,
            error: 'DUPR club membership lookup failed',
            details: membershipPayload
        };
    }

    const memberships = Array.isArray(membershipPayload?.membership) ? membershipPayload.membership : [];
    const targetClub = memberships.find(item => Number(item?.clubId) === configuredClubId);
    if (!targetClub) {
        return {
            ok: false,
            status: 403,
            error: 'Submitting admin is not a member of configured DUPR club',
            details: { configuredClubId }
        };
    }

    const role = String(targetClub.role || '').toUpperCase();
    if (role !== 'DIRECTOR' && role !== 'ORGANIZER') {
        return {
            ok: false,
            status: 403,
            error: 'Submitting admin must be DUPR club DIRECTOR or ORGANIZER',
            details: { configuredClubId, role }
        };
    }

    return {
        ok: true,
        token: token.accessToken,
        duprEnv,
        configuredClubId
    };
}

export function getCreateMatchUrl(env, duprEnv) {
    const explicit = (env.DUPR_MATCH_CREATE_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/match/v1.0/create`;
}

export function getUpdateMatchUrl(env, duprEnv) {
    const explicit = (env.DUPR_MATCH_UPDATE_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/match/v1.0/update`;
}

export function getDeleteMatchUrl(env, duprEnv) {
    const explicit = (env.DUPR_MATCH_DELETE_URL || '').trim();
    if (explicit) return explicit;
    return `${getDuprBase(duprEnv)}/api/match/v1.0/delete`;
}

export function parseDuprMatchMeta(payload, fallbackIdentifier = null, fallbackIndex = 0) {
    const result = payload && typeof payload === 'object' ? (payload.result ?? payload.data ?? payload.matches ?? null) : null;
    const candidateArray = Array.isArray(result)
        ? result
        : Array.isArray(payload?.matches)
            ? payload.matches
            : null;
    const candidateObject = candidateArray
        ? (candidateArray[fallbackIndex] || candidateArray[0] || null)
        : (result && typeof result === 'object' ? result : (payload && typeof payload === 'object' ? payload : null));

    const matchIdRaw = candidateObject?.matchId ?? candidateObject?.id ?? null;
    const matchCodeRaw = candidateObject?.matchCode ?? candidateObject?.code ?? null;
    const identifierRaw = candidateObject?.identifier ?? fallbackIdentifier ?? null;

    const matchId = Number.isInteger(Number(matchIdRaw)) ? Number(matchIdRaw) : null;
    const matchCode = matchCodeRaw ? String(matchCodeRaw).trim() : null;
    const identifier = identifierRaw ? String(identifierRaw).trim() : null;

    return { matchId, matchCode, identifier };
}

export async function insertSubmittedMatch(env, record) {
    await ensureSubmittedMatchesTable(env);
    await env.DB.prepare(
        `INSERT INTO dupr_submitted_matches (
            tournament_id, submission_id, submitted_by, dupr_env, dupr_match_id, dupr_match_code, identifier,
            event_name, bracket_name, location, match_date, format, match_type, club_id,
            team_a_player1, team_a_player2, team_b_player1, team_b_player2,
            team_a_player1_dupr, team_a_player2_dupr, team_b_player1_dupr, team_b_player2_dupr,
            team_a_game1, team_b_game1, team_a_game2, team_b_game2, team_a_game3, team_b_game3, team_a_game4, team_b_game4, team_a_game5, team_b_game5,
            status, last_status_code, last_response, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(identifier, dupr_env) DO UPDATE SET
            tournament_id = excluded.tournament_id,
            submission_id = excluded.submission_id,
            dupr_match_id = excluded.dupr_match_id,
            dupr_match_code = excluded.dupr_match_code,
            event_name = excluded.event_name,
            bracket_name = excluded.bracket_name,
            location = excluded.location,
            match_date = excluded.match_date,
            format = excluded.format,
            match_type = excluded.match_type,
            club_id = excluded.club_id,
            team_a_player1 = excluded.team_a_player1,
            team_a_player2 = excluded.team_a_player2,
            team_b_player1 = excluded.team_b_player1,
            team_b_player2 = excluded.team_b_player2,
            team_a_player1_dupr = excluded.team_a_player1_dupr,
            team_a_player2_dupr = excluded.team_a_player2_dupr,
            team_b_player1_dupr = excluded.team_b_player1_dupr,
            team_b_player2_dupr = excluded.team_b_player2_dupr,
            team_a_game1 = excluded.team_a_game1,
            team_b_game1 = excluded.team_b_game1,
            team_a_game2 = excluded.team_a_game2,
            team_b_game2 = excluded.team_b_game2,
            team_a_game3 = excluded.team_a_game3,
            team_b_game3 = excluded.team_b_game3,
            team_a_game4 = excluded.team_a_game4,
            team_b_game4 = excluded.team_b_game4,
            team_a_game5 = excluded.team_a_game5,
            team_b_game5 = excluded.team_b_game5,
            status = excluded.status,
            last_status_code = excluded.last_status_code,
            last_response = excluded.last_response,
            deleted_at = excluded.deleted_at,
            updated_at = CURRENT_TIMESTAMP`
    ).bind(
        record.tournamentId || null,
        record.submissionId || null,
        record.submittedBy,
        record.duprEnv,
        record.duprMatchId ?? null,
        record.duprMatchCode ?? null,
        record.identifier,
        record.eventName,
        record.bracketName || null,
        record.location || null,
        record.matchDate,
        record.format || 'DOUBLES',
        record.matchType || 'SIDEOUT',
        record.clubId ?? null,
        record.teamAPlayer1,
        record.teamAPlayer2 || null,
        record.teamBPlayer1,
        record.teamBPlayer2 || null,
        record.teamAPlayer1Dupr,
        record.teamAPlayer2Dupr || null,
        record.teamBPlayer1Dupr,
        record.teamBPlayer2Dupr || null,
        record.teamAGame1,
        record.teamBGame1,
        record.teamAGame2 ?? null,
        record.teamBGame2 ?? null,
        record.teamAGame3 ?? null,
        record.teamBGame3 ?? null,
        record.teamAGame4 ?? null,
        record.teamBGame4 ?? null,
        record.teamAGame5 ?? null,
        record.teamBGame5 ?? null,
        record.status || 'submitted',
        record.lastStatusCode ?? null,
        record.lastResponse || null,
        record.deletedAt || null
    ).run();
}

export async function listSubmittedMatches(env, limit = 400) {
    await ensureSubmittedMatchesTable(env);
    const cappedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 1000)) : 400;
    const result = await env.DB.prepare(
        `SELECT
            m.*,
            ua.display_name AS submitted_by_name
         FROM dupr_submitted_matches m
         LEFT JOIN users ua ON ua.id = m.submitted_by
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`
    ).bind(cappedLimit).all();
    return result.results || [];
}

export async function getSubmittedMatchById(env, id) {
    await ensureSubmittedMatchesTable(env);
    return await env.DB.prepare(
        `SELECT * FROM dupr_submitted_matches WHERE id = ?`
    ).bind(id).first();
}
