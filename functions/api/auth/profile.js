// User Profile API Endpoint
// Handles profile creation, retrieval, and updates

import { verifyClerkToken } from '../_auth.js';

// Helper function to get user from Clerk
async function getClerkUser(userId, env) {
    try {
        const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching Clerk user:', error);
        return null;
    }
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

// GET - Retrieve user profile
export async function onRequestGet({ request, env }) {
    // Verify authentication
    const auth = await verifyClerkToken(request, env);
    if (auth.error) {
        return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const userId = auth.userId;

    try {
        // Query database for user profile
        const result = await env.DB.prepare(
            'SELECT * FROM users WHERE id = ?'
        ).bind(userId).first();

        if (!result) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const masterEmail = (env.MASTER_ADMIN_EMAIL || '').toLowerCase();
        const profileEmail = (result.email || '').toLowerCase();
        const shouldBeAdmin = Boolean(
            profileEmail &&
            (profileEmail === masterEmail || await isAllowlistedAdminEmail(env, profileEmail))
        );

        if (shouldBeAdmin && !result.is_admin) {
            await env.DB.prepare(
                'UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(result.id).run();
            result.is_admin = 1;
        }

        // Return user profile
        const isMasterAdmin = Boolean(profileEmail && masterEmail && profileEmail === masterEmail);
        return new Response(JSON.stringify({
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
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ error: 'Database error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// POST/PUT - Create or update user profile
export async function onRequestPost({ request, env }) {
    return handleProfileUpdate(request, env);
}

export async function onRequestPut({ request, env }) {
    return handleProfileUpdate(request, env);
}

async function handleProfileUpdate(request, env) {
    // Verify authentication
    const auth = await verifyClerkToken(request, env);
    if (auth.error) {
        return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const userId = auth.userId;

    // Get user info from Clerk
    const clerkUser = await getClerkUser(userId, env);
    if (!clerkUser) {
        return new Response(JSON.stringify({ error: 'Unable to fetch user info' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const email = clerkUser.email_addresses[0]?.email_address;
    if (!email) {
        return new Response(JSON.stringify({ error: 'No email address found' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    const isMasterAdmin = env.MASTER_ADMIN_EMAIL && email.toLowerCase() === env.MASTER_ADMIN_EMAIL.toLowerCase();
    const isAllowlistedAdmin = await isAllowlistedAdminEmail(env, email.toLowerCase());

    // Parse request body
    let body;
    try {
        body = await request.json();
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { displayName, duprId, doublesRating, singlesRating } = body;

    if (duprId !== undefined || doublesRating !== undefined || singlesRating !== undefined) {
        return new Response(JSON.stringify({
            error: 'DUPR fields must be linked via DUPR SSO'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Validate required fields
    if (!displayName || displayName.trim() === '') {
        return new Response(JSON.stringify({ error: 'Display name is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Insert or update user profile
        await env.DB.prepare(`
            INSERT INTO users (id, email, display_name, dupr_id, doubles_rating, singles_rating, is_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name,
                is_admin = CASE WHEN excluded.is_admin = 1 THEN 1 ELSE users.is_admin END,
                updated_at = CURRENT_TIMESTAMP
        `).bind(
            userId,
            email,
            displayName,
            null,
            null,
            null,
            (isMasterAdmin || isAllowlistedAdmin) ? 1 : 0
        ).run();

        // Fetch and return the updated profile
        const result = await env.DB.prepare(
            'SELECT * FROM users WHERE id = ?'
        ).bind(userId).first();

        return new Response(JSON.stringify({
            success: true,
            profile: {
                id: result.id,
                email: result.email,
                displayName: result.display_name,
                duprId: result.dupr_id,
                doublesRating: result.doubles_rating,
                singlesRating: result.singles_rating,
                isAdmin: Boolean(result.is_admin),
                isMasterAdmin: Boolean(env.MASTER_ADMIN_EMAIL && result.email && result.email.toLowerCase() === env.MASTER_ADMIN_EMAIL.toLowerCase()),
                createdAt: result.created_at,
                updatedAt: result.updated_at
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
