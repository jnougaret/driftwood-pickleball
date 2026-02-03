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

function formatStartLine(startDate, startTimeEt, fallback) {
    const time = formatTimeLabel(startTimeEt);
    const date = formatDateLabel(startDate);
    if (time && date) return `${time} - ${date}`;
    if (time && !date) return `${time} - Date TBD`;
    return fallback || 'Date TBD';
}

function mapTournamentRow(row) {
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

async function ensureSeedData(env) {
    const existing = await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM tournaments'
    ).first();

    if ((existing?.count || 0) > 0) {
        return;
    }

    await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO tournaments (
                id, title, start_time, start_date, start_time_et, timezone, location,
                format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                prize_split, theme, status, display_order, live_start, live_end
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            'feb28-tournament',
            'Saturday Moneyball',
            '2:00 PM - Date TBD',
            null,
            '14:00',
            'America/New_York',
            'The Picklr Westbrook',
            'Coed Doubles',
            'coed_doubles',
            'DUPR 9.25 and below',
            9.25,
            '$15 per player',
            15,
            '50% - 30% - 20%',
            'blue',
            'upcoming',
            10,
            '2026-02-07T14:00:00.000Z',
            '2026-02-07T18:00:00.000Z'
        ),
        env.DB.prepare(
            `INSERT INTO tournaments (
                id, title, start_time, start_date, start_time_et, timezone, location,
                format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                prize_split, theme, status, display_order, csv_url, photo_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            'jan24',
            'Saturday January 24 Moneyball',
            null,
            '2026-01-24',
            '14:00',
            'America/New_York',
            'The Picklr Westbrook',
            'Coed Doubles',
            'coed_doubles',
            'DUPR 9.25 and below',
            9.25,
            '$15 per player',
            15,
            '50% - 30% - 20%',
            'gold',
            'completed',
            20,
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRS9t1AEOSPAWfObfkh4vn77k1eEgMXQFAY7HNTfmSAwYwe2pQiXUpRQshRWGBf4pettKOkn1F-2bFY/pub?gid=1866706696&single=true&output=csv',
            'photos/winners-jan24.jpg'
        ),
        env.DB.prepare(
            `INSERT INTO tournaments (
                id, title, start_time, start_date, start_time_et, timezone, location,
                format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                prize_split, theme, status, display_order, csv_url, photo_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            'jan10',
            'Saturday January 10 Moneyball',
            null,
            '2026-01-10',
            '14:00',
            'America/New_York',
            'The Picklr Westbrook',
            'Coed Doubles',
            'coed_doubles',
            'DUPR 9.50 and below',
            9.5,
            '$15 per player',
            15,
            '50% - 30% - 20%',
            'blue',
            'completed',
            30,
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRS9t1AEOSPAWfObfkh4vn77k1eEgMXQFAY7HNTfmSAwYwe2pQiXUpRQshRWGBf4pettKOkn1F-2bFY/pub?gid=0&single=true&output=csv',
            'photos/winners-jan10.jpeg'
        )
    ]);
}

async function ensureAtLeastOneUpcoming(env) {
    const existingUpcoming = await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM tournaments
         WHERE status IN ('upcoming', 'live')`
    ).first();

    if ((existingUpcoming?.count || 0) > 0) {
        return;
    }

    const id = `tournament-${Date.now()}`;
    try {
        await env.DB.prepare(
            `INSERT INTO tournaments (
                id, title, start_time, start_date, start_time_et, timezone, location,
                format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                prize_split, theme, status, display_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            'Saturday Moneyball',
            '2:00 PM - Date TBD',
            null,
            '14:00',
            'America/New_York',
            'The Picklr Westbrook',
            'Coed Doubles',
            'coed_doubles',
            'TBD and below',
            null,
            '$15 per player',
            15,
            '50% - 30% - 20%',
            'blue',
            'upcoming',
            999
        ).run();
    } catch (error) {
        // Backward-compatible fallback for older schemas.
        await env.DB.prepare(
            `INSERT INTO tournaments (
                id, title, start_time, location, format, skill_level, entry_fee, prize_split, theme, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            'Saturday Moneyball',
            '2:00 PM - Date TBD',
            'The Picklr Westbrook',
            'Coed Doubles',
            'TBD and below',
            '$15 per player',
            '50% - 30% - 20%',
            'blue',
            'upcoming'
        ).run();
    }
}

export async function onRequestGet({ env }) {
    try {
        await ensureSeedData(env);
        await ensureAtLeastOneUpcoming(env);
        let result;
        try {
            result = await env.DB.prepare(
                `SELECT id, title, start_time, start_date, start_time_et, timezone, location,
                        format, format_type, skill_level, skill_level_cap, entry_fee, entry_fee_amount,
                        prize_split, theme, status, live_start, live_end, csv_url, photo_url, display_order
                 FROM tournaments
                 WHERE status IN ('upcoming', 'live', 'completed')
                 ORDER BY CASE status WHEN 'upcoming' THEN 0 WHEN 'live' THEN 1 ELSE 2 END,
                          display_order ASC,
                          COALESCE(start_date, '9999-12-31') ASC,
                          created_at ASC`
            ).all();
        } catch (error) {
            result = await env.DB.prepare(
                `SELECT id, title, start_time, location,
                        format, skill_level, entry_fee, prize_split,
                        theme, status, live_start, live_end
                 FROM tournaments
                 WHERE status IN ('upcoming', 'live', 'completed')
                 ORDER BY created_at ASC`
            ).all();
        }

        const mapped = (result.results || []).map(mapTournamentRow);
        const upcoming = mapped.filter(t => t.status !== 'completed');
        const results = mapped.filter(t => t.status === 'completed');

        return jsonResponse({ upcoming, results });
    } catch (error) {
        console.error('Tournament list error:', error);
        return jsonResponse({ error: 'Failed to load tournaments' }, 500);
    }
}
