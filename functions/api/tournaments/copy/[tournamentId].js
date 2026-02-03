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

async function getTournament(env, tournamentId) {
    return await env.DB.prepare(
        `SELECT *
         FROM tournaments
         WHERE id = ?`
    ).bind(tournamentId).first();
}

async function nextDisplayOrder(env) {
    const row = await env.DB.prepare(
        `SELECT COALESCE(MAX(display_order), 0) AS max_order
         FROM tournaments
         WHERE status IN ('upcoming', 'live')`
    ).first();
    return Number(row?.max_order || 0) + 10;
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

    const source = await getTournament(env, tournamentId);
    if (!source) {
        return jsonResponse({ error: 'Tournament not found' }, 404);
    }
    if (source.status === 'completed') {
        return jsonResponse({ error: 'Only upcoming tournaments can be copied' }, 400);
    }

    const newId = `tournament-${Date.now()}`;
    const displayOrder = await nextDisplayOrder(env);

    try {
        await env.DB.prepare(
            `INSERT INTO tournaments (
                id, title, start_time, start_date, start_time_et, timezone, location,
                format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                prize_split, theme, max_registrations, registration_opens, registration_closes,
                live_start, live_end, status, swish_url, csv_url, photo_url, display_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?)`
        ).bind(
            newId,
            source.title,
            source.start_time,
            source.start_date,
            source.start_time_et,
            source.timezone || 'America/New_York',
            source.location,
            source.format,
            source.format_type,
            source.skill_level,
            source.skill_level_cap,
            source.entry_fee,
            source.entry_fee_amount,
            source.prize_split,
            source.theme,
            source.max_registrations,
            source.registration_opens,
            source.registration_closes,
            source.live_start,
            source.live_end,
            source.swish_url,
            null,
            null,
            displayOrder
        ).run();
    } catch (error) {
        console.error('Copy tournament error:', error);
        return jsonResponse({ error: 'Failed to copy tournament' }, 500);
    }

    return jsonResponse({ success: true, id: newId });
}
