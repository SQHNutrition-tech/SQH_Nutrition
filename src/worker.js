// Cloudflare Worker: serves the hub's pages and its JSON API, backed by D1.
// Every request (pages included) must carry a valid Cloudflare Access identity.

import { getUser } from './auth.js';
import { applyAction, importRow, InputError, today } from './model.js';
import * as CONFIG from './config.js';

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS }
    });

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
function adminEmails(env) {
    return new Set(String(env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

async function ensureMember(db, env, email) {
    const bootstrapAdmin = adminEmails(env).has(email);
    const defaultName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    await db.prepare(
        `INSERT INTO members (email, name, role, active, created_at, last_seen) VALUES (?1, ?2, ?3, 1, ?4, ?4)
         ON CONFLICT (email) DO UPDATE SET last_seen = ?4, role = CASE WHEN ?5 = 1 THEN 'admin' ELSE role END`
    ).bind(email, defaultName, bootstrapAdmin ? 'admin' : 'dietitian', nowIso(), bootstrapAdmin ? 1 : 0).run();
    return db.prepare('SELECT email, name, role, active FROM members WHERE email = ?').bind(email).first();
}

async function activeMemberEmails(db) {
    const { results } = await db.prepare('SELECT email FROM members WHERE active = 1').all();
    return new Set(results.map(r => r.email));
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
function rowToCase(r) {
    return {
        id: r.id,
        facility: r.facility,
        hospitalNo: r.hospital_no,
        setting: r.setting,
        location: r.location,
        bed: r.bed || '',
        owner: r.owner,
        status: r.status,
        risk: r.risk,
        urgent: !!r.urgent,
        due: r.due,
        nextAction: r.next_action,
        plan: JSON.parse(r.plan || '{}'),
        pendingTo: r.pending_to,
        pendingNote: r.pending_note,
        closeReason: r.close_reason,
        closedAt: r.closed_at,
        revision: r.revision,
        updatedAt: r.updated_at
    };
}

const caseColumns = (c) => [
    c.setting, c.location, c.bed || null, c.owner, c.status, c.risk, c.urgent ? 1 : 0, c.due, c.nextAction,
    JSON.stringify(c.plan || {}), c.pendingTo || null, c.pendingNote || null, c.closeReason || null, c.closedAt || null
];

async function insertCase(db, c, actor, eventAction, eventText) {
    const at = nowIso();
    try {
        const [ins] = await db.batch([
            db.prepare(
                `INSERT INTO cases (facility, hospital_no, setting, location, bed, owner, status, risk, urgent, due, next_action,
                                    plan, pending_to, pending_note, close_reason, closed_at, revision, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) RETURNING id`
            ).bind(c.facility, c.hospitalNo, ...caseColumns(c), at, at),
            db.prepare('INSERT INTO events (case_id, at, actor, action, text) VALUES (last_insert_rowid(), ?, ?, ?, ?)')
                .bind(at, actor, eventAction, eventText)
        ]);
        return ins.results[0].id;
    } catch (e) {
        if (String(e).includes('UNIQUE')) {
            throw new InputError(`Hospital number ${c.hospitalNo} already has an open case. Search the Department view.`, 409);
        }
        throw e;
    }
}

async function updateCase(db, id, revision, c, actor, eventAction, eventText) {
    const at = nowIso();
    let results;
    try {
        results = await db.batch([
            db.prepare(
                `UPDATE cases SET setting = ?, location = ?, bed = ?, owner = ?, status = ?, risk = ?, urgent = ?, due = ?,
                        next_action = ?, plan = ?, pending_to = ?, pending_note = ?, close_reason = ?, closed_at = ?,
                        revision = revision + 1, updated_at = ?
                 WHERE id = ? AND revision = ?`
            ).bind(...caseColumns(c), at, id, revision),
            // Only logged if the UPDATE above actually changed the row.
            db.prepare('INSERT INTO events (case_id, at, actor, action, text) SELECT ?, ?, ?, ?, ? WHERE changes() = 1')
                .bind(id, at, actor, eventAction, eventText)
        ]);
    } catch (e) {
        if (String(e).includes('UNIQUE')) {
            throw new InputError('This hospital number already has another open case, so this one cannot be reopened.', 409);
        }
        throw e;
    }
    if (results[0].meta.changes !== 1) {
        throw new InputError('A colleague updated this case a moment ago. Refresh and try again.', 409);
    }
}

async function getCase(db, id) {
    const r = await db.prepare('SELECT * FROM cases WHERE id = ?').bind(id).first();
    return r ? rowToCase(r) : null;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------
async function readJson(request, maxBytes) {
    const url = new URL(request.url);
    if (request.headers.get('Origin') !== url.origin) throw new InputError('Request origin not permitted.', 403);
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) throw new InputError('Expected JSON.', 415);
    const raw = await request.text();
    if (raw.length > maxBytes) throw new InputError('Request is too large.', 413);
    try {
        const body = JSON.parse(raw);
        if (!body || typeof body !== 'object') throw new Error();
        return body;
    } catch {
        throw new InputError('Invalid request.');
    }
}

function requireAdmin(member) {
    if (member.role !== 'admin') throw new InputError('Admins only.', 403);
}

function cleanText(v, max, label, required = true) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s && required) throw new InputError(`Please complete: ${label}.`);
    if (s.length > max) throw new InputError(`${label} is too long.`);
    return s;
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
async function api(request, env, member, path) {
    const db = env.DB;
    const method = request.method;
    const ctx = { today: today(), facility: CONFIG.FACILITY, isAdmin: member.role === 'admin' };

    if (path === '/api/me' && method === 'GET') {
        const { results } = await db.prepare('SELECT email, name, role FROM members WHERE active = 1 ORDER BY name').all();
        return json({
            me: member,
            members: results,
            today: ctx.today,
            config: {
                facility: CONFIG.FACILITY,
                locations: CONFIG.LOCATIONS,
                nextActions: CONFIG.NEXT_ACTIONS,
                feedingRoutes: CONFIG.FEEDING_ROUTES,
                closeReasons: CONFIG.CLOSE_REASONS,
                directoryCategories: CONFIG.DIRECTORY_CATEGORIES,
                retentionDays: CONFIG.RETENTION_DAYS
            }
        });
    }

    if (path === '/api/me' && method === 'POST') {
        const body = await readJson(request, 2000);
        const name = cleanText(body.name, 60, 'Display name');
        await db.prepare('UPDATE members SET name = ? WHERE email = ?').bind(name, member.email).run();
        return json({ ok: true });
    }

    if (path === '/api/summary' && method === 'GET') {
        const r = await db.prepare(
            `SELECT
                SUM(CASE WHEN owner = ?1 AND status = 'active' AND due < ?2 THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN owner = ?1 AND status = 'active' AND due = ?2 THEN 1 ELSE 0 END) AS today,
                SUM(CASE WHEN owner = ?1 AND status = 'active' AND due > ?2 THEN 1 ELSE 0 END) AS upcoming,
                SUM(CASE WHEN owner = ?1 AND status = 'active' AND urgent = 1 THEN 1 ELSE 0 END) AS urgent,
                SUM(CASE WHEN pending_to = ?1 AND status = 'active' THEN 1 ELSE 0 END) AS incoming,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS department
             FROM cases`
        ).bind(member.email, ctx.today).first();
        const counts = {};
        for (const k of ['overdue', 'today', 'upcoming', 'urgent', 'incoming', 'department']) counts[k] = r[k] || 0;
        return json({ counts, today: ctx.today });
    }

    if (path === '/api/cases' && method === 'GET') {
        const { results } = await db.prepare(
            `SELECT * FROM cases WHERE status = 'active' OR closed_at >= date(?, '-30 days') ORDER BY due`
        ).bind(ctx.today).all();
        return json({ cases: results.map(rowToCase), today: ctx.today });
    }

    const eventsMatch = path.match(/^\/api\/cases\/(\d+)\/events$/);
    if (eventsMatch && method === 'GET') {
        const { results } = await db.prepare(
            'SELECT at, actor, action, text FROM events WHERE case_id = ? ORDER BY id DESC'
        ).bind(Number(eventsMatch[1])).all();
        return json({ events: results });
    }

    if (path === '/api/cases' && method === 'POST') {
        const body = await readJson(request, 10000);
        const action = String(body.action || '');
        ctx.members = await activeMemberEmails(db);
        if (action === 'add') {
            const { next, event } = applyAction('add', body.values, null, member.email, ctx);
            const id = await insertCase(db, next, member.email, 'add', event);
            return json({ case: await getCase(db, id) });
        }
        const id = Number(body.id);
        if (!Number.isInteger(id) || !Number.isInteger(body.revision)) throw new InputError('Invalid case reference.');
        const current = await getCase(db, id);
        if (!current) throw new InputError('Case not found.', 404);
        if (current.revision !== body.revision) throw new InputError('A colleague updated this case a moment ago. Refresh and try again.', 409);
        const { next, event } = applyAction(action, body.values, current, member.email, ctx);
        await updateCase(db, id, body.revision, next, member.email, action, event);
        return json({ case: await getCase(db, id) });
    }

    if (path === '/api/directory' && method === 'GET') {
        const { results } = await db.prepare('SELECT id, category, name, ext, notes FROM directory ORDER BY sort, name').all();
        return json({ entries: results });
    }

    if (path === '/api/links' && method === 'GET') {
        const { results } = await db.prepare('SELECT id, label, url FROM links ORDER BY sort, label').all();
        return json({ links: results });
    }

    // ----- Admin -----
    if (path === '/api/admin/members' && method === 'GET') {
        requireAdmin(member);
        const { results } = await db.prepare(
            `SELECT m.email, m.name, m.role, m.active, m.last_seen,
                    (SELECT COUNT(*) FROM cases c WHERE c.owner = m.email AND c.status = 'active') AS open_cases
             FROM members m ORDER BY m.active DESC, m.name`
        ).all();
        return json({ members: results });
    }

    if (path === '/api/admin/members' && method === 'POST') {
        requireAdmin(member);
        const body = await readJson(request, 2000);
        const email = String(body.email || '').toLowerCase();
        const target = await db.prepare('SELECT email FROM members WHERE email = ?').bind(email).first();
        if (!target) throw new InputError('Member not found.', 404);
        switch (body.action) {
            case 'role':
                if (!['dietitian', 'admin'].includes(body.role)) throw new InputError('Invalid role.');
                if (email === member.email && body.role !== 'admin') throw new InputError('You cannot remove your own admin role.');
                await db.prepare('UPDATE members SET role = ? WHERE email = ?').bind(body.role, email).run();
                break;
            case 'active':
                if (email === member.email) throw new InputError('You cannot deactivate yourself.');
                await db.prepare('UPDATE members SET active = ? WHERE email = ?').bind(body.active ? 1 : 0, email).run();
                if (!body.active) {
                    // Pending handovers addressed to someone who has left go back to the sender.
                    await db.prepare('UPDATE cases SET pending_to = NULL, pending_note = NULL, revision = revision + 1 WHERE pending_to = ?').bind(email).run();
                }
                break;
            case 'name':
                await db.prepare('UPDATE members SET name = ? WHERE email = ?').bind(cleanText(body.name, 60, 'Name'), email).run();
                break;
            case 'reassign': {
                const to = String(body.to || '').toLowerCase();
                if (!(await activeMemberEmails(db)).has(to) || to === email) throw new InputError('Choose an active colleague to receive the cases.');
                const { results } = await db.prepare("SELECT id FROM cases WHERE owner = ? AND status = 'active'").bind(email).all();
                const at = nowIso();
                const stmts = [];
                for (const r of results) {
                    stmts.push(db.prepare('UPDATE cases SET owner = ?, pending_to = NULL, pending_note = NULL, revision = revision + 1, updated_at = ? WHERE id = ?').bind(to, at, r.id));
                    stmts.push(db.prepare('INSERT INTO events (case_id, at, actor, action, text) VALUES (?, ?, ?, ?, ?)')
                        .bind(r.id, at, member.email, 'reassign', `Reassigned by admin from ${email} to ${to}`));
                }
                if (stmts.length) await db.batch(stmts);
                return json({ ok: true, moved: results.length });
            }
            default:
                throw new InputError('Unknown action.');
        }
        return json({ ok: true });
    }

    const crud = path.match(/^\/api\/admin\/(directory|links)$/);
    if (crud && method === 'POST') {
        requireAdmin(member);
        const body = await readJson(request, 4000);
        const table = crud[1];
        const v = body.values || {};
        let cols, vals;
        if (table === 'directory') {
            const category = cleanText(v.category, 40, 'Category');
            if (!CONFIG.DIRECTORY_CATEGORIES.includes(category)) throw new InputError('Choose a category from the list.');
            cols = ['category', 'name', 'ext', 'notes', 'sort'];
            vals = [category, cleanText(v.name, 80, 'Name'), cleanText(v.ext, 40, 'Extension'), cleanText(v.notes, 120, 'Notes', false), Number(v.sort) || 0];
        } else {
            const url = cleanText(v.url, 400, 'Link');
            let parsed;
            try { parsed = new URL(url); } catch { throw new InputError('Enter a full link starting with https://'); }
            if (parsed.protocol !== 'https:') throw new InputError('Links must start with https://');
            cols = ['label', 'url', 'sort'];
            vals = [cleanText(v.label, 60, 'Label'), parsed.href, Number(v.sort) || 0];
        }
        if (body.action === 'add') {
            await db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...vals).run();
        } else if (body.action === 'edit') {
            await db.prepare(`UPDATE ${table} SET ${cols.map(c => c + ' = ?').join(', ')} WHERE id = ?`).bind(...vals, Number(body.id)).run();
        } else if (body.action === 'delete') {
            await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(Number(body.id)).run();
        } else {
            throw new InputError('Unknown action.');
        }
        return json({ ok: true });
    }

    if (path === '/api/admin/import' && method === 'POST') {
        requireAdmin(member);
        const body = await readJson(request, 300000);
        if (!Array.isArray(body.rows) || body.rows.length > 1000) throw new InputError('Expected up to 1000 rows.');
        const members = await activeMemberEmails(db);
        const report = { added: 0, skipped: [] };
        for (const [i, row] of body.rows.entries()) {
            try {
                if (String(row.status || 'active').toLowerCase() !== 'active') { report.skipped.push(`Row ${i + 2}: closed case`); continue; }
                const c = importRow(row, ctx);
                const owner = String(row.owner || '').toLowerCase();
                c.owner = members.has(owner) ? owner : member.email;
                await insertCase(db, c, member.email, 'import', `Imported from the pilot app${owner && !members.has(owner) ? ` (original dietitian ${owner} not yet signed in)` : ''}`);
                report.added++;
            } catch (e) {
                report.skipped.push(`Row ${i + 2}: ${e instanceof InputError ? e.message : 'could not be saved'}`);
            }
        }
        return json(report);
    }

    throw new InputError('Not found.', 404);
}

// ---------------------------------------------------------------------------
// Retention: delete closed cases after RETENTION_DAYS (runs daily via cron).
// ---------------------------------------------------------------------------
export async function purgeClosed(db, todayStr = today()) {
    const cutoff = `-${CONFIG.RETENTION_DAYS} days`;
    const [ev, cs] = await db.batch([
        db.prepare("DELETE FROM events WHERE case_id IN (SELECT id FROM cases WHERE status = 'closed' AND closed_at < date(?, ?))").bind(todayStr, cutoff),
        db.prepare("DELETE FROM cases WHERE status = 'closed' AND closed_at < date(?, ?)").bind(todayStr, cutoff)
    ]);
    return { events: ev.meta.changes, cases: cs.meta.changes };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------
function withSecurityHeaders(res) {
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    if ((out.headers.get('Content-Type') || '').includes('text/html')) out.headers.set('Cache-Control', 'no-store');
    return out;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const isApi = url.pathname.startsWith('/api/');
        try {
            const user = await getUser(request, env);
            if (!user) {
                return isApi
                    ? json({ error: 'Please sign in again.' }, 401)
                    : new Response('Sign-in required. Open the hub through the department link so Cloudflare Access can sign you in.', { status: 401, headers: SECURITY_HEADERS });
            }
            const member = await ensureMember(env.DB, env, user.email);
            if (!member.active) {
                return isApi
                    ? json({ error: 'Your access has been turned off. Contact the department admin.' }, 403)
                    : new Response('Your access has been turned off. Contact the department admin.', { status: 403, headers: SECURITY_HEADERS });
            }
            if (isApi) return await api(request, env, member, url.pathname);
            return withSecurityHeaders(await env.ASSETS.fetch(request));
        } catch (e) {
            if (e instanceof InputError) return json({ error: e.message }, e.status);
            console.error('Request failed', e);
            return json({ error: 'Something went wrong. Your changes were not saved; please try again.' }, 500);
        }
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil(purgeClosed(env.DB).then(r => console.log('Retention purge', r)));
    }
};
