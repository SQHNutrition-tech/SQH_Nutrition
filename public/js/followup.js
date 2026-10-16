import { $, $$, esc, api, toast, initPage, nameOf, fmtDate, fmtDateTime } from './common.js';

let me, members = [], config, today = '';
let cases = [];
let view = 'mine', filter = '';
let mode = '', selected = null, busy = false;

const params = new URLSearchParams(location.search);
if (['mine', 'handovers', 'team', 'closed'].includes(params.get('view'))) view = params.get('view');
if (['overdue', 'today', 'upcoming'].includes(params.get('filter'))) filter = params.get('filter');

const RISK = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' };
const timing = (c) => c.status === 'closed' ? 'closed' : c.due < today ? 'overdue' : c.due === today ? 'today' : 'upcoming';
const TIMING_LABEL = { overdue: 'Overdue', today: 'Due today', upcoming: 'Upcoming', closed: 'Closed' };
const where = (c) => c.location + (c.bed ? ' · Bed ' + c.bed : '');

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function load() {
    try {
        const data = await api('/api/cases');
        cases = data.cases;
        today = data.today;
        render();
        $('#sync').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Muscat', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        $('#sync').textContent = e.message;
    }
}

async function save(action, values, c = selected) {
    const body = { action, values };
    if (c) Object.assign(body, { id: c.id, revision: c.revision });
    const { case: updated } = await api('/api/cases', body);
    const i = cases.findIndex(x => x.id === updated.id);
    if (i >= 0) cases[i] = updated; else cases.push(updated);
    render();
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
function inView(c) {
    if (view === 'closed') return c.status === 'closed';
    if (c.status !== 'active') return false;
    if (view === 'mine') return c.owner === me.email;
    if (view === 'handovers') return !!c.pendingTo && (c.pendingTo === me.email || c.owner === me.email);
    return true;
}

function compare(a, b) {
    const t = { overdue: 0, today: 1, upcoming: 2, closed: 3 };
    const r = { high: 0, medium: 1, low: 2 };
    return (b.urgent - a.urgent) || (t[timing(a)] - t[timing(b)]) || ((r[a.risk] ?? 3) - (r[b.risk] ?? 3)) || String(a.due).localeCompare(String(b.due));
}

function visible() {
    const q = $('#search').value.trim().toLowerCase();
    const loc = $('#loc-filter').value;
    const setting = $('#setting-filter').value;
    return cases.filter(inView)
        .filter(c => !filter || timing(c) === filter)
        .filter(c => !loc || c.location === loc)
        .filter(c => !setting || c.setting === setting)
        .filter(c => !q || [c.hospitalNo, c.location, c.bed, nameOf(members, c.owner), c.nextAction, RISK[c.risk], c.urgent ? 'urgent' : ''].join(' ').toLowerCase().includes(q))
        .sort(compare);
}

function planSummary(p) {
    if (!p || (!p.route && !p.kcal && !p.protein && !p.notes && !p.diet)) return '';
    const head = [p.route ? `<b>${esc(p.route)}</b>` : '', p.diet ? esc(p.diet) : ''].filter(Boolean).join(' · ');
    const targets = [p.kcal ? `${p.kcal} kcal` : '', p.protein ? `${p.protein} g protein` : '', p.fluid ? `${p.fluid} mL` : ''].filter(Boolean).join(' · ');
    return `<div class="plan">${[head, targets, p.notes ? esc(p.notes) : ''].filter(Boolean).join('<br>')}</div>`;
}

const initialsOf = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function card(c) {
    const st = timing(c);
    const mine = c.owner === me.email;
    const canManage = (mine || me.role === 'admin') && c.status === 'active';
    const incoming = c.pendingTo === me.email && c.status === 'active';
    const btn = (action, label, cls = '') => `<button class="small ${cls}" data-action="${action}" data-id="${c.id}">${label}</button>`;
    const item = (action, label, cls = '') => `<button class="${cls}" data-action="${action}" data-id="${c.id}">${label}</button>`;

    // One clear main action, one secondary, everything else in the menu.
    let main = '';
    const menu = [];
    if (incoming) main += btn('accept', 'Accept handover', 'primary') + btn('decline', 'Decline', 'ghost');
    if (canManage) {
        if (!incoming) main += btn('review', 'Reviewed', 'primary') + btn('transfer', c.setting === 'inpatient' ? 'Move' : 'Move / admit', 'ghost');
        else menu.push(item('review', 'Record review'), item('transfer', 'Move ward / discharge'));
        menu.push(c.pendingTo ? item('withdraw', 'Cancel handover') : item('handover', 'Hand over to a colleague'));
        menu.push(item('edit', 'Edit details'));
        menu.push('<hr>', item('close', 'Close case', 'danger'));
    }
    if (c.status === 'closed' && (mine || me.role === 'admin')) main += btn('reopen', 'Reopen', 'ghost');
    if (!main && !menu.length) main = `<span class="small muted">Assigned to ${esc(nameOf(members, c.owner))}</span>`;
    menu.push(menu.length ? '<hr>' : '', item('activity', 'Activity log'));

    const owner = nameOf(members, c.owner);
    return `<article class="case ${c.urgent && c.status === 'active' ? 'urgent' : ''}" data-case="${c.id}">
        <div class="case-body">
            <div class="case-top">
                <div>
                    <div class="hn">${esc(c.hospitalNo)}</div>
                    <div class="loc">${esc(where(c))}${c.setting === 'outpatient' ? ' · Outpatient' : ''}</div>
                </div>
                <span class="badge b-${st}">${TIMING_LABEL[st]}</span>
            </div>
            <div class="tags">
                ${c.urgent && c.status === 'active' ? '<span class="badge b-urgent">Urgent</span>' : ''}
                <span class="badge b-${c.risk || 'plain'}">${RISK[c.risk] || 'Risk not set'}</span>
            </div>
            <div class="next">
                <span class="what">${esc(c.status === 'closed' ? c.closeReason : c.nextAction)}</span>
                <span class="when">${c.status === 'closed' ? 'Closed ' + fmtDate(c.closedAt) : fmtDate(c.due)}</span>
            </div>
            ${planSummary(c.plan)}
            ${c.pendingTo ? `<div class="pending">${incoming ? `<b>${esc(owner)}</b> is handing this case to you.` : `Waiting for <b>${esc(nameOf(members, c.pendingTo))}</b> to accept.`}${c.pendingNote ? `<q>${esc(c.pendingNote)}</q>` : ''}</div>` : ''}
            <div class="owner"><span class="avatar" aria-hidden="true">${esc(initialsOf(owner))}</span>${esc(owner)}</div>
        </div>
        <div class="actions">
            ${main}
            <span class="spacer"></span>
            <details class="menu"><summary aria-label="More actions for ${esc(c.hospitalNo)}">···</summary><div class="menu-pop">${menu.join('')}</div></details>
        </div>
        <div class="activity" hidden></div>
    </article>`;
}

function render() {
    const scoped = cases.filter(inView);
    for (const k of ['overdue', 'today', 'upcoming']) $('#c-' + k).textContent = scoped.filter(c => timing(c) === k).length;
    $$('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    $$('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));

    const incoming = cases.filter(c => c.status === 'active' && c.pendingTo === me.email).length;
    $('#ho-count').hidden = !incoming;
    $('#ho-count').textContent = incoming;

    const locSel = $('#loc-filter');
    const keep = locSel.value;
    const locs = [...new Set(scoped.map(c => c.location))].sort();
    locSel.innerHTML = '<option value="">All wards &amp; clinics</option>' + locs.map(l => `<option ${l === keep ? 'selected' : ''}>${esc(l)}</option>`).join('');

    const dueMine = cases.filter(c => c.owner === me.email && c.status === 'active' && c.due <= today).length;
    $('#lede').textContent =
        view === 'handovers' ? 'The sending dietitian stays responsible until the receiver accepts. Declining returns the case.'
        : view === 'team' ? 'Every open case in the department. Only the responsible dietitian or an admin can change a case.'
        : view === 'closed' ? 'Cases closed in the last 30 days. You can reopen your own.'
        : dueMine ? `${dueMine} review${dueMine === 1 ? '' : 's'} due or overdue. Urgent cases come first.`
        : 'Your due list is clear.';
    $('#notice').hidden = !(incoming && view !== 'handovers');
    $('#notice').textContent = `${incoming} handover${incoming === 1 ? ' is' : 's are'} waiting for you in Handovers.`;

    const rows = visible();
    $('#list-count').textContent = `${rows.length} case${rows.length === 1 ? '' : 's'}`;
    $('#list').innerHTML = rows.map(card).join('') || '<div class="empty"><strong>Nothing here</strong>Try another tab or filter, or add a patient.</div>';
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
const opt = (v, cur, label = v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;

function locationPicker(cur, { exclude } = {}) {
    const group = (setting, title) => {
        const list = config.locations.filter(l => l.setting === setting && l.name !== exclude);
        return `<div class="loc-group"><p class="small muted">${title}</p><div class="chips">${list.map(l =>
            `<label class="chip"><input type="radio" name="location" value="${esc(l.name)}" ${l.name === cur ? 'checked' : ''} required><span>${esc(l.name)}</span></label>`).join('')}</div></div>`;
    };
    return `<fieldset><legend>Ward / clinic</legend>${group('inpatient', 'Wards')}${group('outpatient', 'Clinics')}</fieldset>`;
}

function followupFields(c) {
    const due = c && c.due >= today ? c.due : today;
    return `
        <fieldset><legend>Nutrition risk</legend><div class="chips">${['high', 'medium', 'low'].map(r =>
            `<label class="chip r-${r}"><input type="radio" name="risk" value="${r}" ${c?.risk === r ? 'checked' : ''} required><span>${r[0].toUpperCase() + r.slice(1)}</span></label>`).join('')}</div></fieldset>
        <label class="check"><input type="checkbox" name="urgent" ${c?.urgent ? 'checked' : ''}> Urgent review (shows first in everyone's list)</label>
        <div class="two">
            <label class="field">Next review date<input type="date" name="due" value="${due}" min="${today}" required></label>
            <label class="field">Next action<select name="nextAction" required><option value="">Choose…</option>${config.nextActions.map(n => opt(n, c?.nextAction)).join('')}</select></label>
        </div>`;
}

function planFields(p = {}, { required = false, open = false } = {}) {
    return `<details class="plan-box" ${open || required ? 'open' : ''}>
        <summary>Nutrition plan ${required ? '(required for discharge handover)' : '(optional, travels with the case)'}</summary>
        <div class="form-grid" style="margin-top:10px">
            <div class="two">
                <label class="field">Feeding route<select name="route" ${required ? 'required' : ''}><option value="">—</option>${config.feedingRoutes.map(r => opt(r, p.route)).join('')}</select></label>
                <label class="field">Diet / formula<input type="text" name="diet" maxlength="120" list="formula-list" value="${esc(p.diet || '')}" placeholder="Pick from the formulary or type"></label>
            </div>
            <div class="three">
                <label class="field">kcal/day<input type="number" name="kcal" min="0" max="6000" inputmode="numeric" value="${p.kcal ?? ''}"></label>
                <label class="field">Protein g/day<input type="number" name="protein" min="0" max="400" inputmode="numeric" value="${p.protein ?? ''}"></label>
                <label class="field">Fluid mL/day<input type="number" name="fluid" min="0" max="6000" inputmode="numeric" value="${p.fluid ?? ''}"></label>
            </div>
            <label class="field">Goals / handover notes<textarea name="notes" rows="2" maxlength="400" ${required ? 'required' : ''} placeholder="e.g. Target wt 60 kg; ONS BID; recheck PO4">${esc(p.notes || '')}</textarea></label>
            <p class="small muted" style="margin:0">No patient names or diagnoses — those stay in Al Shifa.</p>
        </div>
    </details>`;
}

function recipientSelect(c, { optional }) {
    const others = members.filter(m => m.email !== (c?.owner || me.email));
    return `<label class="field">${optional ? 'Hand over to (optional)' : 'Receiving dietitian'}
        <select name="recipient" ${optional ? '' : 'required'}>
            ${optional ? '<option value="">Keep with current dietitian</option>' : '<option value="">Choose…</option>'}
            ${others.map(m => `<option value="${esc(m.email)}">${esc(m.name)}</option>`).join('')}
        </select></label>
        <label class="field">Handover note (optional)<textarea name="note" rows="2" maxlength="400" placeholder="What the next dietitian needs to know"></textarea></label>`;
}

function openForm(action, c = null) {
    mode = action;
    selected = c;
    const title = {
        add: 'Add patient', edit: 'Edit details', review: 'Record review', handover: 'Hand over to a colleague',
        transfer: c?.setting === 'outpatient' ? 'Move or admit' : 'Move ward or discharge to clinic', close: 'Close case', reopen: 'Reopen case'
    }[action];
    $('#dlg-title').textContent = title;
    $('#dlg-eyebrow').textContent = c ? `${c.hospitalNo} · ${where(c)}` : config.facility;
    $('#dlg-submit').textContent = { add: 'Add patient', review: 'Save review', handover: 'Request handover', transfer: 'Save move', close: 'Close case', reopen: 'Reopen' }[action] || 'Save';
    $('#form-error').textContent = '';

    let html = '';
    if (action === 'add') {
        html += `<label class="field">Hospital number<input type="text" name="hospitalNo" maxlength="30" autocomplete="off" required placeholder="Exactly as in Al Shifa, including leading zeros"></label>`;
    }
    if (action === 'add' || action === 'edit' || action === 'reopen') {
        html += locationPicker(c?.location) + `<label class="field">Bed (optional)<input type="text" name="bed" maxlength="20" value="${esc(c?.bed || '')}"></label>`;
    }
    if (['add', 'edit', 'review', 'reopen'].includes(action)) html += followupFields(c);
    if (['add', 'edit', 'review'].includes(action)) html += planFields(c?.plan || {}, { open: action === 'review' && !!c?.plan?.route });
    if (action === 'handover') html += recipientSelect(c, { optional: false });
    if (action === 'transfer') {
        html += locationPicker(null) + `<label class="field">Bed (optional)<input type="text" name="bed" maxlength="20"></label>`;
        html += `<div id="discharge-extra" hidden>
            <p class="notice warn small" style="margin:0 0 10px">Discharge to clinic: set the clinic date and confirm the plan the clinic dietitian will follow.</p>
            <label class="field">Clinic appointment / review date<input type="date" name="due" min="${today}" value="${c?.due >= today ? c.due : today}"></label>
            ${planFields(c?.plan || {}, { required: true })}
        </div>`;
        html += recipientSelect(c, { optional: true });
    }
    if (action === 'close') {
        html += `<label class="field">Reason<select name="reason" required><option value="">Choose…</option>${config.closeReasons.map(r => opt(r, '')).join('')}</select></label>
            <p class="small muted" style="margin:0">Closing removes the case from active lists and cancels any pending handover. Closed cases are deleted after ${config.retentionDays} days.</p>`;
    }
    $('#fields').innerHTML = html;

    if (action === 'transfer') {
        const extra = $('#discharge-extra');
        const sync = () => {
            const chosen = $('#fields input[name="location"]:checked')?.value;
            const dest = config.locations.find(l => l.name === chosen);
            const discharge = c.setting === 'inpatient' && dest?.setting === 'outpatient';
            extra.hidden = !discharge;
            $$('#discharge-extra [name]').forEach(el => { el.disabled = !discharge; });
        };
        $('#fields').addEventListener('change', sync);
        sync();
    }
    $('#dlg').showModal();
}

function formValues(form) {
    const v = {};
    for (const el of form.elements) {
        if (!el.name || el.disabled) continue;
        if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; continue; }
        if (el.type === 'checkbox') { v[el.name] = el.checked; continue; }
        v[el.name] = el.value;
    }
    return v;
}

$('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const form = e.target;
    // Use the browser's own required-field messages first.
    const firstInvalid = Array.from(form.elements).find(el => !el.disabled && el.willValidate && !el.checkValidity());
    if (firstInvalid) {
        const box = firstInvalid.closest('details');
        if (box) box.open = true;
        firstInvalid.reportValidity();
        return;
    }
    busy = true;
    $('#dlg-submit').disabled = true;
    try {
        await save(mode, formValues(form));
        $('#dlg').close();
        toast({ handover: 'Handover sent — waiting for acceptance', transfer: 'Move saved', close: 'Case closed', add: 'Patient added' }[mode] || 'Saved');
    } catch (err) {
        $('#form-error').textContent = err.message;
        if (err.status === 409) load();
    } finally {
        busy = false;
        $('#dlg-submit').disabled = false;
    }
});

$('#dlg-cancel').onclick = $('#dlg-x').onclick = () => $('#dlg').close();

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
$('#list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || busy) return;
    const c = cases.find(x => x.id === Number(b.dataset.id));
    const action = b.dataset.action;
    b.closest('details.menu')?.removeAttribute('open');
    if (action === 'activity') return toggleActivity(c);
    if (['accept', 'decline', 'withdraw'].includes(action)) {
        busy = true;
        b.disabled = true;
        try {
            await save(action, {}, c);
            toast({ accept: 'Handover accepted — the case is now yours', decline: 'Handover declined', withdraw: 'Handover cancelled' }[action]);
        } catch (err) {
            toast(err.message);
            if (err.status === 409) load();
        } finally {
            busy = false;
            b.disabled = false;
        }
        return;
    }
    openForm(action, c);
});

async function toggleActivity(c) {
    const box = $(`article[data-case="${c.id}"] .activity`);
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = 'Loading…';
    try {
        const { events } = await api(`/api/cases/${c.id}/events`);
        box.innerHTML = events.map(ev => `<p>${esc(ev.text)}<br><small>${esc(nameOf(members, ev.actor))} · ${fmtDateTime(ev.at)}</small></p>`).join('') || 'No activity yet.';
    } catch (err) {
        box.textContent = err.message;
    }
}

// Close any open "More" menu when clicking elsewhere.
document.addEventListener('click', (e) => {
    $$('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
});

$$('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; filter = ''; render(); }));
$$('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = filter === b.dataset.filter ? '' : b.dataset.filter; render(); }));
['#search', '#loc-filter', '#setting-filter'].forEach(s => $(s).addEventListener('input', render));
$('#refresh-btn').onclick = load;
$('#add-btn').onclick = () => openForm('add');

const csvCell = (v) => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
$('#export-btn').onclick = () => {
    const rows = visible();
    if (!rows.length) return toast('Nothing to export in this view');
    if (!confirm('This file will contain hospital numbers. Save it only on a hospital computer and delete it when you are done. Continue?')) return;
    const header = ['Hospital number', 'Setting', 'Location', 'Dietitian', 'Review due', 'Next action', 'Risk', 'Urgent', 'Status', 'Pending handover to', 'Feeding route', 'kcal', 'Protein g', 'Closure reason'];
    const lines = rows.map(c => [c.hospitalNo, c.setting, where(c), nameOf(members, c.owner), c.due, c.nextAction, c.risk, c.urgent ? 'Yes' : 'No', c.status,
        c.pendingTo ? nameOf(members, c.pendingTo) : '', c.plan?.route, c.plan?.kcal, c.plan?.protein, c.closeReason]);
    const csv = '﻿' + [header, ...lines].map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `follow-ups-${today}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};

// Keep the list fresh while the page is open, but never while a form is open.
setInterval(() => { if (!document.hidden && !busy && !$('#dlg').open) load(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#dlg').open) load(); });

(async () => {
    try {
        const data = await initPage('/followup.html');
        me = data.me;
        members = data.members;
        config = data.config;
        $('#retention').textContent = `${config.retentionDays} days`;
        $('#date').textContent = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Muscat', weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
        $('#add-btn').disabled = false;
        await load();
        // Product names from the formulary, suggested in the plan's diet/formula field.
        api('/api/formulas').then(({ formulas }) => {
            const list = document.createElement('datalist');
            list.id = 'formula-list';
            list.innerHTML = formulas.map(f => `<option value="${esc(f.name)}">`).join('');
            document.body.append(list);
        }).catch(() => { /* suggestions are optional */ });
    } catch (e) {
        $('#notice').textContent = e.message;
    }
})();
