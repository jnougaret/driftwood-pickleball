// Shared authentication helpers for Pages Functions

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map();

function base64UrlToUint8Array(value) {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
        base64 += '='.repeat(4 - pad);
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function decodeJwtPart(part) {
    const bytes = base64UrlToUint8Array(part);
    return JSON.parse(new TextDecoder().decode(bytes));
}

async function getJwks(issuer) {
    const cached = jwksCache.get(issuer);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
        return cached.keys;
    }

    const jwksUrl = `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
    const response = await fetch(jwksUrl);
    if (!response.ok) {
        throw new Error('Failed to fetch JWKS');
    }

    const { keys } = await response.json();
    if (!Array.isArray(keys)) {
        throw new Error('Invalid JWKS response');
    }

    jwksCache.set(issuer, { keys, fetchedAt: now });
    return keys;
}

export async function verifyClerkToken(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Missing authorization token', status: 401 };
    }

    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
        return { error: 'Invalid token format', status: 401 };
    }

    try {
        const header = decodeJwtPart(parts[0]);
        const payload = decodeJwtPart(parts[1]);

        if (header.alg !== 'RS256' || !header.kid) {
            return { error: 'Unsupported token header', status: 401 };
        }

        if (!payload.iss || !payload.sub) {
            return { error: 'Invalid token payload', status: 401 };
        }

        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return { error: 'Token expired', status: 401 };
        }

        const jwks = await getJwks(payload.iss);
        const jwk = jwks.find(key => key.kid === header.kid);
        if (!jwk) {
            return { error: 'Signing key not found', status: 401 };
        }

        const cryptoKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const signature = base64UrlToUint8Array(parts[2]);
        const verified = await crypto.subtle.verify(
            { name: 'RSASSA-PKCS1-v1_5' },
            cryptoKey,
            signature,
            data
        );

        if (!verified) {
            return { error: 'Invalid token signature', status: 401 };
        }

        return { userId: payload.sub, session: payload };
    } catch (error) {
        console.error('Token verification error:', error);
        return { error: 'Token verification failed', status: 401 };
    }
}
