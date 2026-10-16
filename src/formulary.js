// Formulary entries: validation and the verification rule. Pure functions so
// they can be unit-tested without a database.

import { InputError } from './model.js';

export const GROUPS = ['infant', 'paediatric', 'adult', 'module'];
export const FORMS = ['powder', 'liquid'];

// Numeric fields and their sane upper limits (per 100 mL or per 100 g).
export const NUTRIENTS = {
    kcal: 1000, protein: 100, cho: 100, fat: 100, fibre: 50, water: 100,
    sodium: 2000, potassium: 3000, chloride: 3000, calcium: 3000, magnesium: 1000, phosphate: 2000,
    osmolality: 2000, osmolarity: 2000,
    g_per_100ml: 60, scoop_g: 50,
    // Volume of one bottle or pack as sold; per-bottle values are worked out from it.
    serving_ml: 2000
};

// Every column an admin can set, in the order the API stores them.
export const TEXT_FIELDS = { name: 80, maker: 60, category: 60, age: 60, pack: 40, photo: 80, flags: 200, notes: 600, source: 120, source_url: 300 };

// Names used in error messages (the same as the spreadsheet headers).
export const LABELS = {
    name: 'Name', maker: 'Maker', category: 'Type', age: 'Age / weight', pack: 'Pack', photo: 'Photo', flags: 'Tags', notes: 'Notes',
    source: 'Source', source_url: 'Source link', kcal: 'Energy (kcal)', protein: 'Protein (g)', cho: 'Carbohydrate (g)', fat: 'Fat (g)',
    fibre: 'Fibre (g)', water: 'Free water (mL)', sodium: 'Sodium (mg)', potassium: 'Potassium (mg)', chloride: 'Chloride (mg)',
    calcium: 'Calcium (mg)', magnesium: 'Magnesium (mg)', phosphate: 'Phosphate (mg)', osmolality: 'Osmolality (mOsm/kg)',
    osmolarity: 'Osmolarity (mOsm/L)', g_per_100ml: 'Powder per 100 mL (g)', scoop_g: 'Scoop (g)', serving_ml: 'Bottle size (mL)'
};

function str(v, max, label, required = false) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s && required) throw new InputError(`Please complete: ${label}.`);
    if (s.length > max) throw new InputError(`${label} is too long (max ${max} characters).`);
    return s;
}

function num(v, max, label) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new InputError(`${label} must be a number between 0 and ${max}.`);
    return Math.round(n * 100) / 100;
}

/** A stable ID for a new product; names with no Latin letters (e.g. Arabic) get one from a hash. */
export function productSlug(name) {
    const s = slugify(name);
    if (s) return s;
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return 'product-' + h.toString(36);
}

export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Validates admin form values into a formula record (without id / verification). */
export function parseFormula(v) {
    v = v && typeof v === 'object' ? v : {};
    const f = {};
    for (const [k, max] of Object.entries(TEXT_FIELDS)) f[k] = str(v[k], max, LABELS[k], k === 'name');
    if (!GROUPS.includes(v.grp)) throw new InputError('Choose a group: infant, paediatric, adult or module.');
    if (!FORMS.includes(v.form)) throw new InputError('Choose powder or liquid.');
    f.grp = v.grp;
    f.form = v.form;
    f.basis = v.basis === '100g' ? '100g' : '100ml';
    for (const [k, max] of Object.entries(NUTRIENTS)) f[k] = num(v[k], max, LABELS[k]);
    // 'uploaded' means the photo was uploaded in the app (stored in the database).
    if (f.photo && f.photo !== 'uploaded' && !/^[a-z0-9-]+\.(webp|png|jpe?g)$/.test(f.photo)) throw new InputError('Photo must be a file name in img/formulas, e.g. my-feed.webp');
    if (f.source_url && !/^https:\/\/[^\s]+$/.test(f.source_url)) throw new InputError('Source link must start with https://');
    // Sanity check: energy should roughly match the macronutrients (4/4/9 kcal per g).
    if (f.kcal !== null && f.protein !== null && f.cho !== null && f.fat !== null) {
        const est = f.protein * 4 + f.cho * 4 + f.fat * 9 + (f.fibre || 0) * 2;
        if (est > 0 && Math.abs(est - f.kcal) / f.kcal > 0.15) {
            throw new InputError(`Energy (${f.kcal} kcal) does not match protein, carbohydrate and fat (≈ ${Math.round(est)} kcal). Check the label for a typo.`);
        }
    }
    return f;
}

/** True if any nutrient value differs, which means the entry must be re-verified. */
export function nutrientsChanged(before, after) {
    return Object.keys(NUTRIENTS).some(k => (before[k] ?? null) !== (after[k] ?? null)) || before.basis !== after.basis;
}

/** A product may be marked verified only once its core values are filled in. */
export function canVerify(f) {
    const missing = ['kcal', 'protein'].filter(k => f[k] === null || f[k] === undefined);
    if (f.form === 'powder' && f.basis === '100ml' && (f.g_per_100ml === null || f.g_per_100ml === undefined)) missing.push('standard dilution (g per 100 mL)');
    if (missing.length) throw new InputError(`Fill in ${missing.join(', ')} from the label before verifying.`);
}

export const FORMULA_COLUMNS = [...Object.keys(TEXT_FIELDS), 'grp', 'form', 'basis', ...Object.keys(NUTRIENTS)];

// Friendly spellings accepted from a spreadsheet.
const GROUP_WORDS = { infant: 'infant', infants: 'infant', paediatric: 'paediatric', pediatric: 'paediatric', paediatrics: 'paediatric', child: 'paediatric', children: 'paediatric', adult: 'adult', adults: 'adult', module: 'module', modules: 'module' };
const BASIS_WORDS = { '100ml': '100ml', 'per100ml': '100ml', '100g': '100g', 'per100g': '100g' };

const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const same = (a, b) => (blank(a) && blank(b)) || (typeof a === 'number' || typeof b === 'number' ? Number(a) === Number(b) : String(a ?? '') === String(b ?? ''));

/**
 * Plans a spreadsheet import without touching the database.
 * rows: [{ _row, id?, ...columns }]. A column present in the sheet but empty
 * clears that value; a column missing from the sheet keeps the stored value.
 * Verification is never set by an import, and changing any number clears it.
 * @returns {{ row, name, action: 'add'|'update'|'same'|'error', id?, slug?, values?, changes?, clearsVerification?, error? }[]}
 */
export function planImport(rows, existing) {
    const byId = new Map(existing.map(f => [Number(f.id), f]));
    const bySlug = new Map(existing.map(f => [f.slug, f]));
    const seen = new Set();
    const plan = [];
    for (const r of rows) {
        const cells = Object.entries(r).filter(([k]) => k !== '_row' && k !== 'id');
        if (cells.every(([, v]) => blank(v)) && blank(r.id)) continue;
        const item = { row: r._row, name: String(r.name ?? '').trim() };
        try {
            let target = null;
            if (!blank(r.id)) {
                target = byId.get(Number(r.id));
                if (!target) throw new InputError(`No product has ID ${r.id}. Leave ID empty to add a new product.`);
            } else if (item.name) {
                target = bySlug.get(slugify(item.name)) || null;
            }
            const base = target ? Object.fromEntries(FORMULA_COLUMNS.map(k => [k, target[k] ?? ''])) : {};
            const v = { ...base };
            for (const [k, val] of cells) if (FORMULA_COLUMNS.includes(k)) v[k] = blank(val) ? '' : (typeof val === 'number' ? val : String(val).trim());
            if (typeof v.grp === 'string') v.grp = GROUP_WORDS[v.grp.toLowerCase()] || v.grp.toLowerCase();
            if (typeof v.form === 'string') v.form = v.form.toLowerCase();
            if (typeof v.basis === 'string') v.basis = BASIS_WORDS[v.basis.toLowerCase().replace(/[^0-9a-z]/g, '')] || '100ml';
            const f = parseFormula(v);
            item.name = f.name;
            const slug = target ? target.slug : productSlug(f.name);
            if (seen.has(slug)) throw new InputError('This product appears more than once in the sheet.');
            seen.add(slug);
            if (!target) {
                Object.assign(item, { action: 'add', slug, values: f });
            } else {
                const changes = FORMULA_COLUMNS.filter(k => !same(f[k], target[k]));
                Object.assign(item, {
                    action: changes.length ? 'update' : 'same', id: Number(target.id), values: f, changes,
                    clearsVerification: !!target.verified_on && nutrientsChanged(target, f)
                });
            }
        } catch (e) {
            if (!(e instanceof InputError)) throw e;
            Object.assign(item, { action: 'error', error: e.message });
        }
        plan.push(item);
    }
    return plan;
}
