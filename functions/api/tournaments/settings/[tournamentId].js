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

async function getSettings(env, tournamentId) {
    return await env.DB.prepare(
        `SELECT max_teams,
                rounds,
                playoff_teams,
                playoff_best_of_three,
                playoff_best_of_three_bronze,
                dupr_required,
                requires_dupr_premium,
                requires_dupr_verified
         FROM tournament_settings
         WHERE tournament_id = ?`
    ).bind(tournamentId).first();
}

async function getTournamentState(env, tournamentId) {
    return await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
}

async function ensureTournamentRow(env, tournamentId) {
    await env.DB.prepare(
        `INSERT OR IGNORE INTO tournaments (id, title, status)
         VALUES (?, ?, 'upcoming')`
    ).bind(tournamentId, tournamentId).run();
}

async function upsertSettings(
    env,
    tournamentId,
    maxTeams,
    rounds,
    playoffTeams,
    playoffBestOfThree,
    playoffBestOfThreeBronze,
    duprRequired,
    requiresDuprPremium,
    requiresDuprVerified
) {
    await env.DB.prepare(
        `INSERT INTO tournament_settings (
            tournament_id,
            max_teams,
            rounds,
            playoff_teams,
            playoff_best_of_three,
            playoff_best_of_three_bronze,
            dupr_required,
            requires_dupr_premium,
            requires_dupr_verified
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tournament_id) DO UPDATE SET
            max_teams = excluded.max_teams,
            rounds = excluded.rounds,
            playoff_teams = excluded.playoff_teams,
            playoff_best_of_three = excluded.playoff_best_of_three,
            playoff_best_of_three_bronze = excluded.playoff_best_of_three_bronze,
            dupr_required = excluded.dupr_required,
            requires_dupr_premium = excluded.requires_dupr_premium,
            requires_dupr_verified = excluded.requires_dupr_verified,
            updated_at = CURRENT_TIMESTAMP`
    ).bind(
        tournamentId,
        maxTeams,
        rounds,
        playoffTeams,
        playoffBestOfThree,
        playoffBestOfThreeBronze,
        duprRequired,
        requiresDuprPremium,
        requiresDuprVerified
    ).run();
}

function deriveDuprRequirement(settings) {
    if (!settings) return 'dupr';
    const requiresVerified = settings?.requires_dupr_verified === 1;
    const requiresPremium = settings?.requires_dupr_premium === 1;
    const requiresDupr = settings?.dupr_required === 1 || requiresPremium || requiresVerified;
    if (requiresVerified) return 'verified';
    if (requiresPremium) return 'premium';
    if (requiresDupr) return 'dupr';
    return 'off';
}

function mapRequirementFlags(requirement) {
    const normalized = String(requirement || 'off').toLowerCase();
    if (normalized === 'verified') {
        return { duprRequired: 1, requiresDuprPremium: 1, requiresDuprVerified: 1, requirement: 'verified' };
    }
    if (normalized === 'premium') {
        return { duprRequired: 1, requiresDuprPremium: 1, requiresDuprVerified: 0, requirement: 'premium' };
    }
    if (normalized === 'dupr') {
        return { duprRequired: 1, requiresDuprPremium: 0, requiresDuprVerified: 0, requirement: 'dupr' };
    }
    return { duprRequired: 0, requiresDuprPremium: 0, requiresDuprVerified: 0, requirement: 'off' };
}

export async function onRequestGet({ env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    try {
        const settings = await getSettings(env, tournamentId);
        const state = await getTournamentState(env, tournamentId);
        const duprRequirement = deriveDuprRequirement(settings);
        return jsonResponse({
            maxTeams: settings?.max_teams ?? 12,
            rounds: settings?.rounds ?? 6,
            playoffTeams: settings?.playoff_teams ?? null,
            playoffBestOfThree: settings?.playoff_best_of_three === 1,
            playoffBestOfThreeBronze: settings?.playoff_best_of_three_bronze === 1,
            duprRequired: duprRequirement !== 'off',
            duprRequirement,
            requiresDuprPremium: duprRequirement === 'premium' || duprRequirement === 'verified',
            requiresDuprVerified: duprRequirement === 'verified',
            status: state?.status ?? 'registration'
        });
    } catch (error) {
        console.error('Settings load error:', error);
        return jsonResponse({ error: 'Failed to load settings' }, 500);
    }
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

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const {
        maxTeams,
        rounds,
        playoffTeams,
        playoffBestOfThree,
        playoffBestOfThreeBronze,
        duprRequired,
        duprRequirement,
        requiresDuprPremium,
        requiresDuprVerified
    } = body;
    const updates = [
        maxTeams,
        rounds,
        playoffTeams,
        playoffBestOfThree,
        playoffBestOfThreeBronze,
        duprRequired,
        duprRequirement,
        requiresDuprPremium,
        requiresDuprVerified
    ].some(value => value !== undefined);
    if (!updates) {
        return jsonResponse({ error: 'No settings provided' }, 400);
    }
    if (maxTeams !== undefined && !Number.isInteger(maxTeams)) {
        return jsonResponse({ error: 'maxTeams must be an integer' }, 400);
    }
    if (rounds !== undefined && !Number.isInteger(rounds)) {
        return jsonResponse({ error: 'rounds must be an integer' }, 400);
    }
    if (playoffTeams !== undefined && !Number.isInteger(playoffTeams)) {
        return jsonResponse({ error: 'playoffTeams must be an integer' }, 400);
    }
    if (playoffBestOfThree !== undefined && typeof playoffBestOfThree !== 'boolean') {
        return jsonResponse({ error: 'playoffBestOfThree must be a boolean' }, 400);
    }
    if (playoffBestOfThreeBronze !== undefined && typeof playoffBestOfThreeBronze !== 'boolean') {
        return jsonResponse({ error: 'playoffBestOfThreeBronze must be a boolean' }, 400);
    }
    if (duprRequired !== undefined && typeof duprRequired !== 'boolean') {
        return jsonResponse({ error: 'duprRequired must be a boolean' }, 400);
    }
    if (requiresDuprPremium !== undefined && typeof requiresDuprPremium !== 'boolean') {
        return jsonResponse({ error: 'requiresDuprPremium must be a boolean' }, 400);
    }
    if (requiresDuprVerified !== undefined && typeof requiresDuprVerified !== 'boolean') {
        return jsonResponse({ error: 'requiresDuprVerified must be a boolean' }, 400);
    }
    if (duprRequirement !== undefined) {
        const allowed = new Set(['off', 'dupr', 'premium', 'verified']);
        if (!allowed.has(String(duprRequirement).toLowerCase())) {
            return jsonResponse({ error: 'duprRequirement must be off, dupr, premium, or verified' }, 400);
        }
    }

    await ensureTournamentRow(env, tournamentId);

    const state = await getTournamentState(env, tournamentId);
    if (state?.status === 'tournament' && (maxTeams !== undefined || rounds !== undefined)) {
        return jsonResponse({ error: 'Tournament already started' }, 400);
    }

    const existing = await getSettings(env, tournamentId);
    const nextMaxTeams = maxTeams ?? existing?.max_teams ?? 12;
    const nextRounds = rounds ?? existing?.rounds ?? 6;
    const nextPlayoffTeams = playoffTeams ?? existing?.playoff_teams ?? null;
    const nextPlayoffBestOfThree = playoffBestOfThree ?? (existing?.playoff_best_of_three === 1);
    const nextPlayoffBestOfThreeBronze = playoffBestOfThreeBronze ?? (existing?.playoff_best_of_three_bronze === 1);
    const existingRequirement = deriveDuprRequirement(existing);
    const requestedRequirement = duprRequirement !== undefined
        ? String(duprRequirement).toLowerCase()
        : null;
    const derivedRequirement = requestedRequirement
        || (
            requiresDuprVerified === true ? 'verified'
                : (requiresDuprPremium === true ? 'premium'
                    : (duprRequired === true ? 'dupr'
                        : (duprRequired === false ? 'off' : existingRequirement)))
        );
    const requirementFlags = mapRequirementFlags(derivedRequirement);

    await upsertSettings(
        env,
        tournamentId,
        nextMaxTeams,
        nextRounds,
        nextPlayoffTeams,
        nextPlayoffBestOfThree ? 1 : 0,
        nextPlayoffBestOfThreeBronze ? 1 : 0,
        requirementFlags.duprRequired,
        requirementFlags.requiresDuprPremium,
        requirementFlags.requiresDuprVerified
    );
    return jsonResponse({ success: true });
}
