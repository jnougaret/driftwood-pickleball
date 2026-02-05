import { verifyClerkToken } from '../_auth.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function getClerkUser(userId, env) {
    try {
        const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`
            }
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        return null;
    }
}

function getDuprEnv(env) {
    const requested = String(env.DUPR_ENV || 'uat').toLowerCase();
    return requested === 'prod' ? 'prod' : 'uat';
}

function getDefaultBasicInfoUrl(duprEnv) {
    return duprEnv === 'prod'
        ? 'https://api.dupr.gg/public/getBasicInfo'
        : 'https://api.uat.dupr.gg/public/getBasicInfo';
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseRatings(source) {
    if (!source || typeof source !== 'object') {
        return { doublesRating: null, singlesRating: null };
    }
    return {
        doublesRating: normalizeNumber(
            source.doublesRating
            ?? source.doubles_rating
            ?? source.doubles
            ?? source.doubleRating
        ),
        singlesRating: normalizeNumber(
            source.singlesRating
            ?? source.singles_rating
            ?? source.singles
            ?? source.singleRating
        )
    };
}

function fullName(firstName, lastName) {
    const first = String(firstName || '').trim();
    const last = String(lastName || '').trim();
    return `${first} ${last}`.trim();
}

async function ensureAdminAllowlistTable(env) {
    await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS admin_allowlist (
            email TEXT PRIMARY KEY,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
    ).run();
}

async function isAllowlistedAdminEmail(env, email) {
    if (!email) return false;
    await ensureAdminAllowlistTable(env);
    const row = await env.DB.prepare(
        'SELECT email FROM admin_allowlist WHERE LOWER(email) = LOWER(?)'
    ).bind(email).first();
    return Boolean(row);
}

export async function onRequestPost({ request, env }) {
    const auth = await verifyClerkToken(request, env);
    if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status);
    }

    let body = {};
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const userToken = typeof body.userToken === 'string' ? body.userToken.trim() : '';
    if (!userToken) {
        return jsonResponse({ error: 'userToken is required' }, 400);
    }

    const clerkUser = await getClerkUser(auth.userId, env);
    if (!clerkUser) {
        return jsonResponse({ error: 'Unable to fetch user info' }, 500);
    }
    const email = clerkUser.email_addresses?.[0]?.email_address;
    if (!email) {
        return jsonResponse({ error: 'No email address found' }, 400);
    }

    const duprEnv = getDuprEnv(env);
    const basicInfoUrl = (env.DUPR_BASIC_INFO_URL || '').trim() || getDefaultBasicInfoUrl(duprEnv);
    let upstream;
    try {
        upstream = await fetch(basicInfoUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
    } catch (error) {
        return jsonResponse({ error: 'Unable to reach DUPR basic info endpoint' }, 502);
    }

    let basicInfo = null;
    try {
        basicInfo = await upstream.json();
    } catch (error) {
        basicInfo = null;
    }

    if (!upstream.ok || !basicInfo || typeof basicInfo !== 'object') {
        return jsonResponse({
            error: 'Failed to fetch DUPR profile from SSO token',
            upstreamStatus: upstream.status
        }, 502);
    }

    const duprId = basicInfo.duprId || basicInfo.dupr_id || basicInfo.id || null;
    if (!duprId) {
        return jsonResponse({ error: 'DUPR profile missing duprId' }, 502);
    }

    const ratings = parseRatings(basicInfo.stats || basicInfo);
    const profileName = basicInfo.displayName
        || fullName(basicInfo.firstName, basicInfo.lastName)
        || fullName(clerkUser.first_name, clerkUser.last_name)
        || email.split('@')[0];

    const lowerEmail = email.toLowerCase();
    const masterEmail = (env.MASTER_ADMIN_EMAIL || '').toLowerCase();
    const isMasterAdmin = Boolean(lowerEmail && masterEmail && lowerEmail === masterEmail);
    const isAllowlistedAdmin = await isAllowlistedAdminEmail(env, lowerEmail);

    await env.DB.prepare(`
        INSERT INTO users (id, email, display_name, dupr_id, doubles_rating, singles_rating, is_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            dupr_id = excluded.dupr_id,
            doubles_rating = excluded.doubles_rating,
            singles_rating = excluded.singles_rating,
            is_admin = CASE WHEN excluded.is_admin = 1 THEN 1 ELSE users.is_admin END,
            updated_at = CURRENT_TIMESTAMP
    `).bind(
        auth.userId,
        email,
        profileName,
        duprId,
        ratings.doublesRating,
        ratings.singlesRating,
        (isMasterAdmin || isAllowlistedAdmin) ? 1 : 0
    ).run();

    const result = await env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    return jsonResponse({
        success: true,
        profile: {
            id: result.id,
            email: result.email,
            displayName: result.display_name,
            duprId: result.dupr_id,
            doublesRating: result.doubles_rating,
            singlesRating: result.singles_rating,
            isAdmin: Boolean(result.is_admin),
            isMasterAdmin: Boolean(isMasterAdmin),
            createdAt: result.created_at,
            updatedAt: result.updated_at
        }
    });
}

