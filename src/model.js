// Business rules for a follow-up case. Pure functions (no database, no
// request objects) so they can be unit-tested with `node --test`.

import { LOCATIONS, NEXT_ACTIONS, FEEDING_ROUTES, CLOSE_REASONS, TIME_ZONE } from './config.js';

export class InputError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export const today = (now = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

const settingOf = (name) => (LOCATIONS.find(l => l.name === name) || {}).setting;

function text(v, max, label, { required = true } = {}) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) {
        if (required) throw new InputError(`Please complete: ${label}.`);
        return '';
    }
    if (s.length > max) throw new InputError(`${label} is too long (max ${max} characters).`);
    return s;
}

function isDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
}

function dueDate(v, ctx, { allowPast = false } = {}) {
    const due = text(v, 10, 'Next review date');
    if (!isDate(due)) throw new InputError('Choose a valid review date.');
    if (!allowPast && due < ctx.today) throw new InputError('Choose today or a future review date.');
    return due;
}

function location(v) {
    const loc = text(v.location, 40, 'Ward / clinic');
    if (!settingOf(loc)) throw new InputError('Select a ward or clinic from the list.');
    const bed = text(v.bed, 20, 'Bed number', { required: false });
    return { location: loc, setting: settingOf(loc), bed };
}

function followup(v, ctx, opts) {
    const nextAction = text(v.nextAction, 60, 'Next action');
    if (!NEXT_ACTIONS.includes(nextAction)) throw new InputError('Select a next action from the list.');
    if (!['high', 'medium', 'low'].includes(v.risk)) throw new InputError('Select a nutrition risk level.');
    return {
        risk: v.risk,
        urgent: v.urgent === true || v.urgent === 'on',
        due: dueDate(v.due, ctx, opts),
        nextAction
    };
}

function optionalNumber(v, label, max) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new InputError(`${label} must be between 0 and ${max}.`);
    return Math.round(n);
}

// The nutrition plan travels with the case on every handover.
export function plan(v, { required = false } = {}) {
    const route = text(v.route, 40, 'Feeding route', { required });
    if (route && !FEEDING_ROUTES.includes(route)) throw new InputError('Select a feeding route from the list.');
    const p = {
        route,
        diet: text(v.diet, 120, 'Diet / formula', { required: false }),
        kcal: optionalNumber(v.kcal, 'Energy target', 6000),
        protein: optionalNumber(v.protein, 'Protein target', 400),
        fluid: optionalNumber(v.fluid, 'Fluid target', 6000),
        notes: text(v.notes, 400, 'Goals / handover notes', { required })
    };
    return p;
}

function recipient(v, ctx, current, { required }) {
    const r = typeof v.recipient === 'string' ? v.recipient.trim().toLowerCase() : '';
    if (!r) {
        if (required) throw new InputError('Choose the receiving dietitian.');
        return '';
    }
    if (!ctx.members.has(r)) throw new InputError('Choose an active colleague from the list.');
    if (r === current.owner) throw new InputError('That dietitian already owns this case.');
    return r;
}

export function hospitalNumber(v) {
    const n = text(v, 30, 'Hospital number').toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(n) || !/[0-9]/.test(n)) throw new InputError('Hospital number may contain only letters, digits and hyphens.');
    return n;
}

/**
 * Applies one action to a case.
 * @param {string} action
 * @param {object} v       form values from the browser
 * @param {object|null} c  current case (null for "add")
 * @param {string} actor   signed-in member email
 * @param {{today: string, members: Set<string>, isAdmin?: boolean, facility: string}} ctx
 * @returns {{ next: object, event: string }}
 */
export function applyAction(action, v, c, actor, ctx) {
    v = v && typeof v === 'object' ? v : {};

    if (action === 'add') {
        const loc = location(v);
        return {
            next: {
                facility: ctx.facility,
                hospitalNo: hospitalNumber(v.hospitalNo),
                ...loc,
                ...followup(v, ctx),
                plan: plan(v),
                owner: actor,
                status: 'active',
                pendingTo: null,
                pendingNote: null,
                closeReason: null,
                closedAt: null
            },
            event: `Case added · ${loc.location}`
        };
    }

    if (!c) throw new InputError('Case not found.', 404);
    const n = structuredClone(c);
    const receiving = action === 'accept' || action === 'decline';
    const allowed = receiving ? c.pendingTo === actor : (c.owner === actor || ctx.isAdmin);
    if (!allowed) throw new InputError('This action is not assigned to you.', 403);
    if (c.status === 'closed' && action !== 'reopen') throw new InputError('This case is closed.');

    switch (action) {
        case 'edit': {
            Object.assign(n, location(v), followup(v, ctx), { plan: plan(v) });
            return { next: n, event: 'Details updated' };
        }
        case 'review': {
            Object.assign(n, followup(v, ctx), { plan: plan(v) });
            return { next: n, event: `Reviewed · next review ${n.due}` };
        }
        case 'handover': {
            n.pendingTo = recipient(v, ctx, c, { required: true });
            n.pendingNote = text(v.note, 400, 'Handover note', { required: false }) || null;
            return { next: n, event: `Handover requested to ${n.pendingTo}` };
        }
        case 'transfer': {
            const from = c.location;
            const fromSetting = c.setting;
            const loc = location(v);
            if (loc.location === from && loc.bed === (c.bed || '')) throw new InputError('Choose a different ward, clinic or bed.');
            const toClinic = fromSetting === 'inpatient' && loc.setting === 'outpatient';
            Object.assign(n, loc);
            if (toClinic) {
                // Discharge to outpatients: the plan and clinic date are the handover.
                n.plan = plan(v, { required: true });
                n.due = dueDate(v.due, ctx);
                n.nextAction = 'Outpatient review';
            }
            const to = recipient(v, ctx, c, { required: false });
            n.pendingTo = to || null;
            n.pendingNote = to ? (text(v.note, 400, 'Handover note', { required: false }) || null) : null;
            const verb = toClinic ? 'Discharged to' : (fromSetting === 'outpatient' && loc.setting === 'inpatient' ? 'Admitted to' : 'Transferred to');
            const where = `${loc.location}${loc.bed ? ' · Bed ' + loc.bed : ''}`;
            return { next: n, event: `${verb} ${where} (from ${from})${to ? ` · handover requested to ${to}` : ''}` };
        }
        case 'accept': {
            const from = c.owner;
            n.owner = actor;
            n.pendingTo = null;
            n.pendingNote = null;
            return { next: n, event: `Handover accepted from ${from}` };
        }
        case 'decline': {
            n.pendingTo = null;
            n.pendingNote = null;
            return { next: n, event: 'Handover declined; original dietitian keeps the case' };
        }
        case 'withdraw': {
            if (!c.pendingTo) throw new InputError('There is no pending handover.');
            n.pendingTo = null;
            n.pendingNote = null;
            return { next: n, event: 'Handover cancelled' };
        }
        case 'close': {
            if (!CLOSE_REASONS.includes(v.reason)) throw new InputError('Select a closure reason.');
            Object.assign(n, { status: 'closed', closeReason: v.reason, closedAt: ctx.today, pendingTo: null, pendingNote: null, urgent: false });
            return { next: n, event: `Closed · ${v.reason}` };
        }
        case 'reopen': {
            if (c.status !== 'closed') throw new InputError('This case is already active.');
            Object.assign(n, location(v), followup(v, ctx), { status: 'active', closeReason: null, closedAt: null, owner: actor });
            return { next: n, event: 'Case reopened' };
        }
        default:
            throw new InputError('Unknown action.');
    }
}

// Validates one row from the old pilot's CSV export (admin import).
export function importRow(row, ctx) {
    const loc = location({ location: (row.location || '').split(' · Bed ')[0], bed: (row.location || '').split(' · Bed ')[1] || '' });
    const risk = String(row.risk || '').toLowerCase().split(' ')[0];
    const next = NEXT_ACTIONS.includes(row.nextAction) ? row.nextAction : 'Routine follow-up';
    return {
        facility: ctx.facility,
        hospitalNo: hospitalNumber(row.hospitalNo),
        ...loc,
        risk: ['high', 'medium', 'low'].includes(risk) ? risk : 'medium',
        urgent: String(row.urgent || '').toLowerCase() === 'yes',
        due: isDate(row.due) ? row.due : ctx.today,
        nextAction: next,
        plan: plan({}),
        status: 'active',
        pendingTo: null,
        pendingNote: null,
        closeReason: null,
        closedAt: null
    };
}
