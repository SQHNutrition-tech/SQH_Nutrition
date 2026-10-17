// Identity comes from Cloudflare Access (Zero Trust), which sits in front of
// the whole site and handles sign-in (one-time email code, Google, Microsoft…).
// Access forwards a signed JWT in the Cf-Access-Jwt-Assertion header; we verify
// its signature, audience, issuer and expiry here rather than trusting any
// plain header, so a misconfigured route can never be used to impersonate.

let jwksCache = { teamDomain: '', keys: null, fetchedAt: 0 };

function b64urlToBytes(s) {
    const pad = '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, ch => ch.charCodeAt(0));
}

const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(teamDomain) {
    const fresh = Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000;
    if (jwksCache.keys && jwksCache.teamDomain === teamDomain && fresh) return jwksCache.keys;
    const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error('Could not load Access signing keys');
    const { keys } = await res.json();
    jwksCache = { teamDomain, keys, fetchedAt: Date.now() };
    return keys;
}

export async function verifyAccessJwt(token, { teamDomain, aud }) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (header.alg !== 'RS256') return null;

    const keys = await getKeys(teamDomain);
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;

    const now = Math.floor(Date.now() / 1000);
    // ACCESS_AUD may list several application tags, comma-separated.
    const allowed = String(aud).split(',').map(s => s.trim()).filter(Boolean);
    const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audList.some(a => allowed.includes(a))) return null;
    if (payload.iss !== `https://${teamDomain}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;
    return { email: payload.email.toLowerCase() };
}

/**
 * For the sign-in error page only: the application tag (AUD) in an Access
 * token, read without checking it, so a mismatch with ACCESS_AUD can be
 * spotted. Never used to let anyone in.
 */
export function tokenAudience(request) {
    try {
        const token = request.headers.get('Cf-Access-Jwt-Assertion');
        if (!token) return null;
        const aud = decodeJson(token.split('.')[1]).aud;
        return (Array.isArray(aud) ? aud : [aud]).filter(a => typeof a === 'string');
    } catch {
        return null;
    }
}

/** Returns { email } for the signed-in user, or null. */
export async function getUser(request, env) {
    const url = new URL(request.url);

    // Local development only: `wrangler dev` on localhost can act as a test user.
    // The hostname check means this can never apply on the real domain, even if
    // DEV_USER_EMAIL is accidentally set in production.
    if (env.DEV_USER_EMAIL && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        return { email: String(env.DEV_USER_EMAIL).toLowerCase() };
    }

    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return null;
    try {
        return await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD });
    } catch (e) {
        console.error('Access token check failed', e);
        return null;
    }
}
