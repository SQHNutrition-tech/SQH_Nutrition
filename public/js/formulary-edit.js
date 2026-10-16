// Formulary editor (admins): spreadsheet-style grid, product dialog with
// photo upload, and Excel download / upload with a preview before saving.
import { $, $$, esc, api, toast, initPage, L, t } from './common.js';
import { writeXlsx, readXlsx } from './xlsx-lite.js';

let products = [];
let show = 'all';
const edits = new Map();      // product id → { column: new value } not yet saved
const rowErrors = new Map();  // product id → last save error
let editingId = null;
let pendingPhoto = null;      // { mime, data } chosen in the dialog, uploaded after save
let importRows = null;

// Numbers shown in the grid, in label order.
const NUM_COLS = [
    ['serving_ml', 'Bottle', 'mL'], ['kcal', 'Energy', 'kcal'], ['protein', 'Protein', 'g'], ['cho', 'Carbohydrate', 'g'],
    ['fat', 'Fat', 'g'], ['fibre', 'Fibre', 'g'], ['water', 'Free water', 'mL'], ['sodium', 'Sodium', 'mg'],
    ['potassium', 'Potassium', 'mg'], ['chloride', 'Chloride', 'mg'], ['calcium', 'Calcium', 'mg'], ['magnesium', 'Magnesium', 'mg'],
    ['phosphate', 'Phosphate', 'mg'], ['osmolality', 'Osmolality', 'mOsm/kg'], ['osmolarity', 'Osmolarity', 'mOsm/L'],
    ['g_per_100ml', 'Powder', 'g / 100 mL'], ['scoop_g', 'Scoop', 'g']
];

// Every field the API stores (matches FORMULA_COLUMNS on the server).
const FIELDS = ['name', 'maker', 'grp', 'category', 'form', 'age', 'pack', 'photo', 'flags', 'notes', 'basis', 'source', 'source_url',
    'kcal', 'protein', 'cho', 'fat', 'fibre', 'water', 'sodium', 'potassium', 'chloride', 'calcium', 'magnesium', 'phosphate',
    'osmolality', 'osmolarity', 'g_per_100ml', 'scoop_g', 'serving_ml'];

// Excel columns: [field, header]. Headers are matched loosely on upload.
const XL_COLS = [
    ['id', 'ID (leave empty for a new product)'], ['name', 'Name *'], ['maker', 'Maker'], ['grp', 'Group *'], ['form', 'Form *'],
    ['basis', 'Values per'], ['category', 'Type'], ['age', 'Age / weight'], ['pack', 'Pack'], ['serving_ml', 'Bottle size (mL)'],
    ['kcal', 'Energy (kcal)'], ['protein', 'Protein (g)'], ['cho', 'Carbohydrate (g)'], ['fat', 'Fat (g)'], ['fibre', 'Fibre (g)'],
    ['water', 'Free water (mL)'], ['sodium', 'Sodium (mg)'], ['potassium', 'Potassium (mg)'], ['chloride', 'Chloride (mg)'],
    ['calcium', 'Calcium (mg)'], ['magnesium', 'Magnesium (mg)'], ['phosphate', 'Phosphate (mg)'], ['osmolality', 'Osmolality (mOsm/kg)'],
    ['osmolarity', 'Osmolarity (mOsm/L)'], ['g_per_100ml', 'Powder per 100 mL (g)'], ['scoop_g', 'Scoop (g)'], ['flags', 'Tags'],
    ['source', 'Source'], ['source_url', 'Source link'], ['notes', 'Notes'], ['_status', 'Status (not imported)']
];
const XL_WIDTHS = [12, 34, 16, 12, 10, 11, 24, 18, 18, 10, 9, 9, 10, 8, 8, 10, 9, 10, 10, 9, 10, 10, 11, 11, 11, 9, 24, 30, 36, 50, 14];
const GROUP_LABEL = { infant: 'Infant', paediatric: 'Paediatric', adult: 'Adult', module: 'Module' };

const photoUrl = (f) => (f.photo === 'uploaded' ? `/api/formulas/${f.id}/photo?v=${encodeURIComponent(f.updated_at || '')}`
    : f.photo ? `/img/formulas/${esc(f.photo)}` : '/img/mark.png');
const fmtNum = (v) => (v === null || v === undefined ? '' : String(Math.round(v * 100) / 100));

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------
async function load() {
    ({ formulas: products } = await api('/api/formulas?all=1'));
    render();
}

function visible() {
    const q = $('#q').value.trim().toLowerCase();
    return products
        .filter(f => show === 'hidden' ? !f.active : show === 'all' ? true : f.active && (show === 'verified' ? f.verified : !f.verified))
        .filter(f => !q || [f.name, f.maker, f.category, f.flags].join(' ').toLowerCase().includes(q));
}

function render() {
    $('#g-head').innerHTML = `<tr><th class="first">${esc(t('Product'))}</th>${NUM_COLS.map(([, label, unit]) =>
        `<th>${esc(t(label))}<small>${esc(unit)}</small></th>`).join('')}<th>${esc(t('Status'))}</th><th></th></tr>`;
    const rows = visible();
    $('#g-body').innerHTML = rows.map(f => {
        const e = edits.get(f.id) || {};
        const err = rowErrors.get(f.id);
        const unitNote = f.basis === '100g' ? L('per 100 g', 'لكل 100 g') : '';
        return `<tr data-id="${f.id}" class="${f.active ? '' : 'off'} ${err ? 'bad' : ''}">
            <td class="first"><div class="pc"><img src="${photoUrl(f)}" alt="" loading="lazy"><span><b data-no-i18n>${esc(f.name)}</b><small>${esc(t(GROUP_LABEL[f.grp] || f.grp))} · ${esc(t(f.form))}${unitNote ? ' · ' + unitNote : ''}</small>${err ? `<span class="row-error">${esc(err)}</span>` : ''}</span></div></td>
            ${NUM_COLS.map(([k]) => {
                const changed = Object.prototype.hasOwnProperty.call(e, k);
                const v = changed ? e[k] : fmtNum(f[k]);
                return `<td><input class="cell ${changed ? 'changed' : ''}" type="text" inputmode="decimal" data-k="${k}" value="${esc(v)}" aria-label="${esc(f.name)} ${esc(k)}"></td>`;
            }).join('')}
            <td>${f.verified ? '<span class="badge b-verified">Verified</span>' : '<span class="badge b-needs">Needs label</span>'}</td>
            <td class="acts">
                <button class="small ghost" type="button" data-act="edit">Edit</button>
                <button class="small ${f.verified ? 'ghost' : 'primary'}" type="button" data-act="${f.verified ? 'unverify' : 'verify'}">${f.verified ? 'Unverify' : 'Verify'}</button>
                <button class="small ghost" type="button" data-act="${f.active ? 'archive' : 'restore'}">${f.active ? 'Hide' : 'Show'}</button>
            </td>
        </tr>`;
    }).join('') || `<tr><td class="muted" colspan="${NUM_COLS.length + 3}">${esc(t('Nothing matches.'))}</td></tr>`;
    $$('[data-show]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.show === show)));
    updateSaveBar();
}

function updateSaveBar() {
    const n = [...edits.values()].filter(e => Object.keys(e).length).length;
    $('#savebar').hidden = !n;
    $('#savebar-text').textContent = L(`${n} product${n === 1 ? '' : 's'} changed`, n === 1 ? 'تغيّر منتج واحد' : `تغيّرت ${n} منتجات`);
}

$('#g-body').addEventListener('input', (e) => {
    const input = e.target.closest('input.cell');
    if (!input) return;
    const id = Number(input.closest('tr').dataset.id);
    const f = products.find(x => x.id === id);
    const k = input.dataset.k;
    const e2 = edits.get(id) || {};
    const original = fmtNum(f[k]);
    if (input.value.trim() === original) delete e2[k]; else e2[k] = input.value.trim();
    input.classList.toggle('changed', k in e2);
    edits.set(id, e2);
    updateSaveBar();
});

// Enter moves down a row, like a spreadsheet.
$('#g-body').addEventListener('keydown', (e) => {
    const input = e.target.closest('input.cell');
    if (!input || e.key !== 'Enter') return;
    e.preventDefault();
    const tr = input.closest('tr').nextElementSibling || input.closest('tr').parentElement.firstElementChild;
    tr?.querySelector(`input[data-k="${input.dataset.k}"]`)?.focus();
});

const valuesOf = (f, overrides = {}) => {
    const v = {};
    for (const k of FIELDS) v[k] = f[k] ?? '';
    return { ...v, ...overrides };
};

async function saveAll() {
    const ids = [...edits.entries()].filter(([, e]) => Object.keys(e).length).map(([id]) => id);
    $('#save-all').disabled = true;
    let saved = 0, cleared = 0;
    for (const id of ids) {
        const f = products.find(x => x.id === id);
        try {
            const r = await api('/api/admin/formulas', { action: 'edit', id, values: valuesOf(f, edits.get(id)) });
            edits.delete(id);
            rowErrors.delete(id);
            saved++;
            if (r.verificationCleared) cleared++;
        } catch (err) {
            rowErrors.set(id, err.message);
        }
    }
    $('#save-all').disabled = false;
    await load();
    const failed = ids.length - saved;
    toast(failed
        ? L(`${saved} saved, ${failed} need fixing (see the red rows)`, `حُفظ ${saved}، ويحتاج ${failed} إلى تصحيح (انظر الصفوف الحمراء)`)
        : L(`${saved} saved${cleared ? `; ${cleared} need verifying again` : ''}`, `حُفظ ${saved}${cleared ? `؛ ويحتاج ${cleared} إلى توثيق من جديد` : ''}`));
}

$('#save-all').onclick = saveAll;
$('#discard').onclick = () => { edits.clear(); rowErrors.clear(); render(); };
$('#q').addEventListener('input', render);
$$('[data-show]').forEach(b => b.addEventListener('click', () => { show = b.dataset.show; render(); }));

$('#g-body').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const f = products.find(x => x.id === Number(b.closest('tr').dataset.id));
    const action = b.dataset.act;
    if (action === 'edit') return openProduct(f);
    if (action === 'verify' && !confirm(L(`Confirm you have checked every value for ${f.name} against the pack label in your hand?`, `هل تؤكد أنك راجعت كل قيم ${f.name} مقابل الملصق على العبوة التي بين يديك؟`))) return;
    if (edits.get(f.id) && Object.keys(edits.get(f.id)).length && action === 'verify') return toast(L('Save the changed values first', 'احفظ القيم المعدّلة أولاً'));
    try {
        await api('/api/admin/formulas', { action, id: f.id });
        toast({ verify: 'Marked as verified', unverify: 'Verification removed', archive: 'Hidden from the formulary', restore: 'Shown in the formulary' }[action]);
        await load();
    } catch (err) {
        toast(err.message);
    }
});

// ---------------------------------------------------------------------------
// Product dialog (all details + photo)
// ---------------------------------------------------------------------------
function openProduct(f) {
    editingId = f ? f.id : null;
    pendingPhoto = null;
    $('#f-title').textContent = f ? f.name : t('Add product');
    $('#f-error').textContent = '';
    const form = $('#f-form');
    form.reset();
    if (f) for (const k of FIELDS) if (form.elements[k] && f[k] !== null && f[k] !== undefined) form.elements[k].value = f[k];
    $('#f-photo').src = f ? photoUrl(f) : '/img/mark.png';
    $('#f-dlg').showModal();
}

/** Resizes a photo to at most 600 px and returns { mime, data (base64) }. */
async function preparePhoto(file) {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 600 / Math.max(img.width, img.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const toBlob = (type) => new Promise(res => canvas.toBlob(res, type, 0.85));
    let blob = await toBlob('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg'); // older Safari
    const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    return { mime: blob.type, data: String(dataUrl).split(',')[1], preview: dataUrl };
}

$('#f-photo-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
        pendingPhoto = await preparePhoto(file);
        $('#f-photo').src = pendingPhoto.preview;
    } catch {
        toast(L('That file could not be opened as a photo', 'تعذّر فتح هذا الملف كصورة'));
    }
});

$('#f-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target).entries());
    $('#f-save').disabled = true;
    try {
        const r = await api('/api/admin/formulas', editingId ? { action: 'edit', id: editingId, values } : { action: 'add', values });
        const id = editingId || r.id;
        if (pendingPhoto) await api('/api/admin/formulas/photo', { id, mime: pendingPhoto.mime, data: pendingPhoto.data });
        $('#f-dlg').close();
        edits.delete(id);
        rowErrors.delete(id);
        toast(r.verificationCleared ? t('Saved. Values changed, so the product needs verifying again.') : t('Product saved'));
        await load();
    } catch (err) {
        $('#f-error').textContent = err.message;
    } finally {
        $('#f-save').disabled = false;
    }
});

$('#f-add').onclick = () => openProduct(null);
$$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
const HOW_TO = [
    ['How to fill in the formulary spreadsheet'],
    [''],
    ['1. One row per product. Keep the header row exactly as it is.'],
    ['2. To change a product, edit its row. Keep its ID: that is how the hub knows which product it is.'],
    ['3. To add a product, use an empty row and leave the ID empty. Name, Group and Form are required.'],
    ['4. Group: infant, paediatric, adult or module. Form: liquid or powder. Values per: 100 mL, or 100 g for modules.'],
    ['5. Enter the label\'s per 100 mL column (as prepared for powders). For modules, enter per 100 g.'],
    ['6. Numbers only in number columns: 6.3, not "6.3 g". An empty cell clears that value.'],
    ['7. Bottle size is one bottle or pack as sold, in mL. The hub works out values per bottle from it.'],
    ['8. Energy must roughly match protein, carbohydrate and fat (4/4/9 kcal per g); the hub flags typos.'],
    ['9. The Status column is for information. Verifying is done in the hub, against the pack in hand.'],
    ['10. Changing any number removes that product\'s verification, so it must be checked again.'],
    ['11. Photos are added in the hub: Formulary editor, then Edit, then Choose photo.'],
    [''],
    ['Save the file as Excel (.xlsx), then upload it in the Formulary editor. You will see every change before it is saved.']
];

function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function sheetFor(list) {
    const rows = [XL_COLS.map(([, h]) => h)];
    for (const f of list) {
        rows.push(XL_COLS.map(([k]) => {
            if (k === 'id') return f.id;
            if (k === 'basis') return f.basis === '100g' ? '100 g' : '100 mL';
            if (k === '_status') return f.verified ? `Verified ${f.verified_on}` : 'Needs label';
            const v = f[k];
            return v === null || v === undefined ? null : v;
        }));
    }
    const col = (k) => XL_COLS.findIndex(([x]) => x === k);
    return [
        { name: 'Formulary', rows, header: true, freeze: { rows: 1, cols: 2 }, widths: XL_WIDTHS,
          lists: [{ col: col('grp'), values: ['infant', 'paediatric', 'adult', 'module'] }, { col: col('form'), values: ['liquid', 'powder'] }, { col: col('basis'), values: ['100 mL', '100 g'] }] },
        { name: 'How to fill', rows: HOW_TO, widths: [110] }
    ];
}

const stamp = () => new Date().toISOString().slice(0, 10);
$('#xl-all').onclick = () => download(writeXlsx(sheetFor(products)), `SQH-formulary-${stamp()}.xlsx`);
$('#xl-blank').onclick = () => download(writeXlsx(sheetFor([])), 'SQH-formulary-new-products.xlsx');

const norm = (s) => String(s ?? '').toLowerCase().replace(/\(.*?\)|\*/g, '').replace(/[^a-z0-9]/g, '');
const HEADER_KEYS = new Map(XL_COLS.flatMap(([k, h]) => [[norm(h), k], [norm(k), k]]));
HEADER_KEYS.set('id', 'id');

$('#xl-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
        const table = await readXlsx(await file.arrayBuffer(), { sheet: 'Formulary' });
        const header = (table[0] || []).map(h => HEADER_KEYS.get(norm(h)) || null);
        if (!header.includes('name')) throw new Error(L('This does not look like the formulary spreadsheet: there is no "Name" column.', 'لا يبدو هذا ملف دليل التركيبات: لا يوجد عمود "Name".'));
        importRows = table.slice(1).map((r, i) => {
            const row = { _row: i + 2 };
            header.forEach((k, ci) => { if (k && k !== '_status') row[k] = r[ci] ?? ''; });
            return row;
        });
        $('#imp-file').textContent = file.name;
        await preview();
    } catch (err) {
        toast(err.message);
    }
});

const ACTION_BADGE = { add: ['b-add', 'New'], update: ['b-update', 'Changes'], same: ['b-plain', 'No change'], error: ['b-error', 'Problem'] };
const fieldLabel = (k) => (XL_COLS.find(([x]) => x === k)?.[1] || k).replace(' *', '');

async function preview() {
    $('#imp-error').textContent = '';
    const r = await api('/api/admin/formulas/bulk', { rows: importRows });
    const s = r.summary;
    $('#imp-sum').innerHTML = [
        s.add && `<span class="badge b-add">${esc(L(`${s.add} new`, `${s.add} جديد`))}</span>`,
        s.update && `<span class="badge b-update">${esc(L(`${s.update} changed`, `${s.update} معدّل`))}</span>`,
        s.same && `<span class="badge b-plain">${esc(L(`${s.same} unchanged`, `${s.same} دون تغيير`))}</span>`,
        s.error && `<span class="badge b-error">${esc(L(`${s.error} with problems (will be skipped)`, `${s.error} بها مشكلات (ستُتخطّى)`))}</span>`,
        s.clearsVerification && `<span class="badge b-needs">${esc(L(`${s.clearsVerification} will need verifying again`, `${s.clearsVerification} ستحتاج إلى توثيق من جديد`))}</span>`
    ].filter(Boolean).join('') || `<span class="muted">${esc(t('Nothing to import.'))}</span>`;
    const order = { error: 0, add: 1, update: 2, same: 3 };
    // Unchanged rows are only counted, so the real changes stand out.
    $('#imp-body').innerHTML = r.items.filter(i => i.action !== 'same').sort((a, b) => order[a.action] - order[b.action] || a.row - b.row).map(i => {
        const [cls, label] = ACTION_BADGE[i.action];
        const detail = i.action === 'error' ? `<span style="color:var(--coral)">${esc(i.error)}</span>`
            : i.action === 'update' ? esc(i.changes.map(fieldLabel).join(', ')) + (i.clearsVerification ? ` · <b>${esc(t('verification removed'))}</b>` : '')
            : '';
        return `<tr><td class="muted">${esc(L('Row', 'صف'))} ${i.row}</td><td><span class="badge ${cls}">${esc(t(label))}</span></td><td data-no-i18n><b>${esc(i.name || '—')}</b></td><td>${detail}</td></tr>`;
    }).join('');
    const n = s.add + s.update;
    $('#imp-apply').disabled = !n;
    $('#imp-apply').textContent = n ? L(`Save ${n} product${n === 1 ? '' : 's'}`, `حفظ ${n} من المنتجات`) : t('Nothing to save');
    if (!$('#imp-dlg').open) $('#imp-dlg').showModal();
}

$('#imp-apply').onclick = async () => {
    $('#imp-apply').disabled = true;
    try {
        const r = await api('/api/admin/formulas/bulk', { rows: importRows, apply: true });
        $('#imp-dlg').close();
        importRows = null;
        toast(L(`Saved: ${r.summary.add} new, ${r.summary.update} changed`, `حُفظ: ${r.summary.add} جديد، ${r.summary.update} معدّل`));
        await load();
    } catch (err) {
        $('#imp-error').textContent = err.message;
        $('#imp-apply').disabled = false;
    }
};

// ---------------------------------------------------------------------------
window.addEventListener('beforeunload', (e) => {
    if ([...edits.values()].some(x => Object.keys(x).length)) e.preventDefault();
});

(async () => {
    try {
        const { me } = await initPage('/formulas.html');
        if (me.role !== 'admin') {
            $('#denied').hidden = false;
            $$('section').forEach(s => { s.hidden = true; });
            return;
        }
        await load();
        // /formulary-edit.html#p12 opens product 12 (from the formulary page).
        const m = location.hash.match(/^#p(\d+)$/);
        if (m) {
            const f = products.find(x => x.id === Number(m[1]));
            if (f) openProduct(f);
        } else if (location.hash === '#new') openProduct(null);
    } catch (e) {
        toast(e.message);
    }
})();
