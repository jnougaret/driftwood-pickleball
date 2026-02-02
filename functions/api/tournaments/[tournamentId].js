import { verifyClerkToken } from '../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function formatTimeLabel(timeEt) {
    if (!timeEt || !/^\d{2}:\d{2}$/.test(timeEt)) return null;
    const [hoursRaw, minutesRaw] = timeEt.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const h12 = (hours % 12) || 12;
    return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDateLabel(startDate) {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    const [yearRaw, monthRaw, dayRaw] = startDate.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(dt.getTime())) return null;
    const monthLabel = dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${monthLabel} ${day}`;
}

function normalizeFormatType(formatType, fallback) {
    if (formatType === 'mixed_doubles' || /mixed/i.test(fallback || '')) return 'mixed_doubles';
    return 'coed_doubles';
}

function formatLabelFromType(formatType) {
    return formatType === 'mixed_doubles' ? 'Mixed Doubles' : 'Coed Doubles';
}

function formatStartLine(startDate, startTimeEt, fallback) {
    const time = formatTimeLabel(startTimeEt);
    const date = formatDateLabel(startDate);
    if (time && date) return `${time} - ${date}`;
    if (time && !date) return `${time} - Date TBD`;
    return fallback || 'Date TBD';
}

function formatSkillLevel(skillCap, fallback) {
    if (skillCap === null || skillCap === undefined || Number.isNaN(Number(skillCap))) {
        return fallback || 'DUPR ??.?? and below';
    }
    return `DUPR ${Number(skillCap).toFixed(2)} and below`;
}

function formatEntryFee(entryFeeAmount, fallback) {
    if (entryFeeAmount === null || entryFeeAmount === undefined || Number.isNaN(Number(entryFeeAmount))) {
        return fallback || '$0 per player';
    }
    const amount = Number(entryFeeAmount);
    const pretty = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    return `$${pretty} per player`;
}

function mapTournament(row) {
    const formatType = normalizeFormatType(row.format_type, row.format);
    const skillCap = row.skill_level_cap !== null && row.skill_level_cap !== undefined
        ? Number(row.skill_level_cap)
        : null;
    const entryFeeAmount = row.entry_fee_amount !== null && row.entry_fee_amount !== undefined
        ? Number(row.entry_fee_amount)
        : null;

    return {
        id: row.id,
        title: row.title || row.id,
        location: row.location || 'Location TBD',
        startDate: row.start_date || null,
        startTimeEt: row.start_time_et || null,
        timezone: row.timezone || 'America/New_York',
        startTime: formatStartLine(row.start_date, row.start_time_et, row.start_time),
        formatType,
        format: formatLabelFromType(formatType),
        skillLevelCap: Number.isFinite(skillCap) ? skillCap : null,
        skillLevel: formatSkillLevel(skillCap, row.skill_level),
        entryFeeAmount: Number.isFinite(entryFeeAmount) ? entryFeeAmount : null,
        entryFee: formatEntryFee(entryFeeAmount, row.entry_fee),
        prizeSplit: row.prize_split || '50% - 30% - 20%',
        theme: row.theme === 'gold' ? 'gold' : 'blue',
        status: row.status || 'upcoming',
        liveStart: row.live_start || null,
        liveEnd: row.live_end || null,
        csvUrl: row.csv_url || null,
        photoUrl: row.photo_url || null,
        displayOrder: Number(row.display_order || 0)
    };
}

async function getUserById(env, userId) {
    return await env.DB.prepare(
        'SELECT id, is_admin FROM users WHERE id = ?'
    ).bind(userId).first();
}

async function getTournament(env, tournamentId) {
    try {
        return await env.DB.prepare(
            `SELECT id, title, location, start_time, start_date, start_time_et, timezone,
                    format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                    prize_split, theme, status, live_start, live_end, csv_url, photo_url, display_order
             FROM tournaments
             WHERE id = ?`
        ).bind(tournamentId).first();
    } catch (error) {
        return await env.DB.prepare(
            `SELECT id, title, location, start_time,
                    format, skill_level, entry_fee,
                    prize_split, theme, status, live_start, live_end
             FROM tournaments
             WHERE id = ?`
        ).bind(tournamentId).first();
    }
}

async function getTournamentMode(env, tournamentId) {
    const row = await env.DB.prepare(
        'SELECT status FROM tournament_state WHERE tournament_id = ?'
    ).bind(tournamentId).first();
    return row?.status ?? 'registration';
}

export async function onRequestGet({ env, params }) {
    const tournamentId = params.tournamentId;
    if (!tournamentId) {
        return jsonResponse({ error: 'Missing tournamentId' }, 400);
    }

    try {
        const row = await getTournament(env, tournamentId);
        if (!row) {
            return jsonResponse({ error: 'Tournament not found' }, 404);
        }
        return jsonResponse({ tournament: mapTournament(row) });
    } catch (error) {
        console.error('Tournament fetch error:', error);
        return jsonResponse({ error: 'Failed to load tournament' }, 500);
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

    const title = String(body.title || '').trim();
    const location = String(body.location || '').trim();
    const startDate = body.startDate ? String(body.startDate).trim() : null;
    const startTimeEt = body.startTimeEt ? String(body.startTimeEt).trim() : null;
    const formatType = body.formatType === 'mixed_doubles' ? 'mixed_doubles' : 'coed_doubles';
    const skillLevelCap = body.skillLevelCap === null || body.skillLevelCap === undefined || body.skillLevelCap === ''
        ? null
        : Number(body.skillLevelCap);
    const entryFeeAmount = body.entryFeeAmount === null || body.entryFeeAmount === undefined || body.entryFeeAmount === ''
        ? null
        : Number(body.entryFeeAmount);

    if (!title) return jsonResponse({ error: 'Title is required' }, 400);
    if (!location) return jsonResponse({ error: 'Location is required' }, 400);
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return jsonResponse({ error: 'startDate must be YYYY-MM-DD' }, 400);
    }
    if (startTimeEt && !/^\d{2}:\d{2}$/.test(startTimeEt)) {
        return jsonResponse({ error: 'startTimeEt must be HH:MM' }, 400);
    }
    if (skillLevelCap !== null && (!Number.isFinite(skillLevelCap) || skillLevelCap < 0 || skillLevelCap > 20)) {
        return jsonResponse({ error: 'skillLevelCap must be a number between 0 and 20' }, 400);
    }
    if (entryFeeAmount !== null && (!Number.isFinite(entryFeeAmount) || entryFeeAmount < 0 || entryFeeAmount > 1000)) {
        return jsonResponse({ error: 'entryFeeAmount must be a number between 0 and 1000' }, 400);
    }

    const existing = await getTournament(env, tournamentId);
    if (!existing) {
        return jsonResponse({ error: 'Tournament not found' }, 404);
    }
    if (existing.status === 'completed') {
        return jsonResponse({ error: 'Only upcoming tournaments can be edited' }, 400);
    }
    const mode = await getTournamentMode(env, tournamentId);
    if (mode !== 'registration') {
        return jsonResponse({ error: 'Cannot edit details after tournament has started' }, 400);
    }

    try {
        await env.DB.prepare(
            `SELECT start_date, start_time_et, timezone, format_type, skill_level_cap, entry_fee_amount
             FROM tournaments WHERE id = ?`
        ).bind(tournamentId).first();
    } catch (error) {
        return jsonResponse({ error: 'Tournament schema is out of date. Run D1 migrations first.' }, 400);
    }

    const formatLabel = formatLabelFromType(formatType);
    const startTimeDisplay = formatStartLine(startDate, startTimeEt, existing.start_time);
    const skillLevel = formatSkillLevel(skillLevelCap, existing.skill_level);
    const entryFee = formatEntryFee(entryFeeAmount, existing.entry_fee);

    try {
        await env.DB.prepare(
            `UPDATE tournaments
             SET title = ?,
                 location = ?,
                 start_date = ?,
                 start_time_et = ?,
                 timezone = 'America/New_York',
                 start_time = ?,
                 format_type = ?,
                 format = ?,
                 skill_level_cap = ?,
                 skill_level = ?,
                 entry_fee_amount = ?,
                 entry_fee = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).bind(
            title,
            location,
            startDate,
            startTimeEt,
            startTimeDisplay,
            formatType,
            formatLabel,
            skillLevelCap,
            skillLevel,
            entryFeeAmount,
            entryFee,
            tournamentId
        ).run();

        const updated = await getTournament(env, tournamentId);
        return jsonResponse({ success: true, tournament: mapTournament(updated) });
    } catch (error) {
        console.error('Tournament update error:', error);
        return jsonResponse({ error: 'Failed to update tournament' }, 500);
    }
}
