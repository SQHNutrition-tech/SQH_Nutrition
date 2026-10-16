import { $, esc, api, toast, initPage, L } from './common.js';

let me, config, members = [];

async function run(fn, okMsg) {
    try {
        await fn();
        if (okMsg) toast(okMsg);
    } catch (e) {
        toast(e.message);
    }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
async function loadMembers() {
    ({ members } = await api('/api/admin/members'));
    const active = members.filter(m => m.active);
    $('#members').innerHTML = members.map(m => `
        <tr class="${m.active ? '' : 'off'}" data-email="${esc(m.email)}">
            <td><input type="text" value="${esc(m.name)}" data-act="name" aria-label="${L('Name for', 'اسم')} ${esc(m.email)}"></td>
            <td class="small">${esc(m.email)}</td>
            <td><select data-act="role" aria-label="Role">${['dietitian', 'admin'].map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${r === 'admin' ? 'Admin' : 'Dietitian'}</option>`).join('')}</select></td>
            <td>${m.open_cases}</td>
            <td><button class="small" data-act="active">${m.active ? 'Turn off' : 'Turn on'}</button></td>
            <td>${m.open_cases ? `<select data-act="to" aria-label="Move cases to"><option value="">Choose…</option>${active.filter(a => a.email !== m.email).map(a => `<option value="${esc(a.email)}">${esc(a.name)}</option>`).join('')}</select> <button class="small" data-act="reassign">Move</button>` : '<span class="muted small">—</span>'}</td>
        </tr>`).join('');
}

$('#members').addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    const email = row.dataset.email;
    if (e.target.dataset.act === 'name') run(() => api('/api/admin/members', { action: 'name', email, name: e.target.value }), 'Name saved');
    if (e.target.dataset.act === 'role') run(async () => { await api('/api/admin/members', { action: 'role', email, role: e.target.value }); await loadMembers(); }, 'Role updated');
});

$('#members').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const row = b.closest('tr');
    const email = row.dataset.email;
    const m = members.find(x => x.email === email);
    if (b.dataset.act === 'active') {
        if (m.active && !confirm(L(`Turn off access for ${m.name}? Handovers waiting for them go back to the sender. Move their open cases first.`, `إيقاف وصول ${m.name}؟ تعود الحالات المُسلَّمة إليه إلى المُرسِل. انقل حالاته المفتوحة أولاً.`))) return;
        run(async () => { await api('/api/admin/members', { action: 'active', email, active: !m.active }); await loadMembers(); }, 'Access updated');
    }
    if (b.dataset.act === 'reassign') {
        const to = row.querySelector('[data-act="to"]').value;
        if (!to) return toast('Choose who should receive the cases');
        run(async () => {
            const r = await api('/api/admin/members', { action: 'reassign', email, to });
            await loadMembers();
            toast(L(`${r.moved} case${r.moved === 1 ? '' : 's'} moved`, `نُقلت ${r.moved} ${r.moved === 1 ? 'حالة' : 'حالات'}`));
        });
    }
});

// ---------------------------------------------------------------------------
// Links & directory (same pattern)
// ---------------------------------------------------------------------------
async function loadLinks() {
    const { links } = await api('/api/links');
    $('#links-body').innerHTML = links.map(l => `
        <tr data-id="${l.id}">
            <td>${esc(l.label)}</td>
            <td class="small"><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.url)}</a></td>
            <td><button class="small danger" data-del="links">Delete</button></td>
        </tr>`).join('') || '<tr><td colspan="3" class="muted small">No links yet. Add the Ministry email, HR site, Al Shifa and protocols below.</td></tr>';
}

async function loadDirectory() {
    const { entries } = await api('/api/directory');
    $('#dir-body').innerHTML = entries.map(d => `
        <tr data-id="${d.id}">
            <td>${esc(d.category)}</td><td>${esc(d.name)}</td><td><b>${esc(d.ext)}</b></td><td class="small">${esc(d.notes)}</td>
            <td><button class="small danger" data-del="directory">Delete</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="muted small">No numbers yet.</td></tr>';
}

function formToObject(form) {
    return Object.fromEntries(new FormData(form).entries());
}

$('#link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    run(async () => { await api('/api/admin/links', { action: 'add', values: formToObject(e.target) }); e.target.reset(); await loadLinks(); }, 'Link added');
});

$('#dir-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const keepCat = e.target.category.value;
    run(async () => {
        await api('/api/admin/directory', { action: 'add', values: formToObject(e.target) });
        e.target.reset();
        e.target.category.value = keepCat;
        e.target.name.focus();
        await loadDirectory();
    }, 'Number added');
});

document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const table = b.dataset.del;
    if (!confirm('Delete this entry?')) return;
    run(async () => {
        await api(`/api/admin/${table}`, { action: 'delete', id: Number(b.closest('tr').dataset.id) });
        table === 'links' ? await loadLinks() : await loadDirectory();
    }, 'Deleted');
});

// ---------------------------------------------------------------------------
// CSV import from the pilot app
// ---------------------------------------------------------------------------
function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
}

// Undo the CSV-injection guard (a leading apostrophe) the exporters add.
const unguard = (s) => String(s || '').replace(/^'(?=[=+@\-\t\r])/, '').trim();

let importRows = [];
$('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    importRows = [];
    $('#import-btn').disabled = true;
    $('#import-report').textContent = '';
    if (!file) return;
    const table = parseCsv(await file.text());
    const header = (table.shift() || []).map(h => h.trim().toLowerCase());
    const col = (...names) => header.findIndex(h => names.includes(h));
    const idx = {
        hospitalNo: col('hospital number'), location: col('location'), owner: col('dietitian'), due: col('review due'),
        nextAction: col('next action'), risk: col('nutrition risk', 'risk'), urgent: col('urgent review', 'urgent'), status: col('status')
    };
    if (idx.hospitalNo < 0 || idx.location < 0) {
        $('#import-preview').textContent = 'This does not look like the pilot export (missing "Hospital number" or "Location" columns).';
        return;
    }
    importRows = table.map(r => {
        const get = (k) => idx[k] >= 0 ? unguard(r[idx[k]]) : '';
        const owner = get('owner');
        const email = (owner.match(/\(([^()\s]+@[^()\s]+)\)/) || [])[1] || (owner.includes('@') ? owner : '');
        return { hospitalNo: get('hospitalNo'), location: get('location'), owner: email, due: get('due'), nextAction: get('nextAction'), risk: get('risk'), urgent: get('urgent'), status: get('status') || 'active' };
    });
    const active = importRows.filter(r => r.status.toLowerCase() === 'active').length;
    $('#import-preview').textContent = L(`${importRows.length} rows found, ${active} active.`, `عُثر على ${importRows.length} صفاً، منها ${active} نشطة.`);
    $('#import-btn').disabled = !active;
});

$('#import-btn').addEventListener('click', () => {
    if (!importRows.length) return;
    $('#import-btn').disabled = true;
    run(async () => {
        const r = await api('/api/admin/import', { rows: importRows });
        $('#import-report').textContent = L(`Imported ${r.added} case${r.added === 1 ? '' : 's'}.`, `استُورد ${r.added} من الحالات.`) + (r.skipped.length ? L(`\nSkipped ${r.skipped.length}:\n`, `\nتُخطّي ${r.skipped.length}:\n`) + r.skipped.join('\n') : '');
        await loadMembers();
    });
});


// ---------------------------------------------------------------------------
// Formulary
// ---------------------------------------------------------------------------
let products = [];
let editingId = null;
const FIELDS = ['name', 'maker', 'grp', 'form', 'basis', 'category', 'age', 'pack', 'photo', 'flags', 'kcal', 'protein', 'cho', 'fat', 'fibre', 'water', 'sodium', 'potassium', 'chloride', 'calcium', 'magnesium', 'phosphate', 'osmolality', 'osmolarity', 'serving_ml', 'g_per_100ml', 'scoop_g', 'source', 'source_url', 'notes'];

async function loadFormulary() {
    ({ formulas: products } = await api('/api/formulas?all=1'));
    $('#f-body').innerHTML = products.map(f => `
        <tr data-id="${f.id}" class="${f.active ? '' : 'off'}">
            <td>${f.photo ? `<img class="thumb" src="/img/formulas/${esc(f.photo)}" alt="">` : ''}</td>
            <td><b data-no-i18n>${esc(f.name)}</b><br><span class="small muted">${esc([f.maker, f.pack].filter(Boolean).join(' · '))}</span></td>
            <td class="small">${esc({ infant: 'Infant', paediatric: 'Paediatric', adult: 'Adult', module: 'Module' }[f.grp] || f.grp)}</td>
            <td>${f.kcal ?? '—'}</td>
            <td>${f.protein ?? '—'}</td>
            <td class="small">${f.verified ? `<span class="badge b-low">Verified</span><br><span class="muted">${esc(f.verified_by_name || f.verified_by)} · ${esc(f.verified_on)}</span>` : '<span class="badge b-medium">Needs label</span>'}</td>
            <td style="white-space:nowrap">
                <button class="small" data-f="edit">Edit</button>
                <button class="small ${f.verified ? 'ghost' : 'primary'}" data-f="${f.verified ? 'unverify' : 'verify'}">${f.verified ? 'Unverify' : 'Verify'}</button>
                <button class="small ghost" data-f="${f.active ? 'archive' : 'restore'}">${f.active ? 'Hide' : 'Show'}</button>
            </td>
        </tr>`).join('') || '<tr><td colspan="7" class="muted small">No products yet.</td></tr>';
}

function openProduct(f) {
    editingId = f ? f.id : null;
    $('#f-title').textContent = f ? f.name : 'Add product';
    $('#f-error').textContent = '';
    const form = $('#f-form');
    form.reset();
    for (const k of FIELDS) if (f && f[k] !== null && f[k] !== undefined) form.elements[k].value = f[k];
    $('#f-dlg').showModal();
}

$('#f-add').onclick = () => openProduct(null);
$('#f-cancel').onclick = $('#f-x').onclick = () => $('#f-dlg').close();

$('#f-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target).entries());
    try {
        const r = await api('/api/admin/formulas', editingId ? { action: 'edit', id: editingId, values } : { action: 'add', values });
        $('#f-dlg').close();
        toast(r.verificationCleared ? 'Saved. Values changed, so the product needs verifying again.' : 'Product saved');
        await loadFormulary();
    } catch (err) {
        $('#f-error').textContent = err.message;
    }
});

$('#f-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const f = products.find(x => x.id === Number(b.closest('tr').dataset.id));
    const action = b.dataset.f;
    if (action === 'edit') return openProduct(f);
    if (action === 'verify' && !confirm(L(`Confirm you have checked every value for ${f.name} against the pack label in your hand?`, `هل تؤكد أنك راجعت كل قيم ${f.name} مقابل الملصق على العبوة التي بين يديك؟`))) return;
    run(async () => { await api('/api/admin/formulas', { action, id: f.id }); await loadFormulary(); },
        { verify: 'Marked as verified', unverify: 'Verification removed', archive: 'Hidden from the formulary', restore: 'Shown in the formulary' }[action]);
});

// ---------------------------------------------------------------------------
(async () => {
    try {
        ({ me, config } = await initPage('/admin.html'));
        if (me.role !== 'admin') {
            $('#denied').hidden = false;
            document.querySelectorAll('section').forEach(s => { s.hidden = true; });
            return;
        }
        $('#dir-cat').innerHTML = config.directoryCategories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        await Promise.all([loadMembers(), loadLinks(), loadDirectory(), loadFormulary()]);
        if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    } catch (e) {
        toast(e.message);
    }
})();
