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

const TEXT_FIELDS = { name: 80, maker: 60, category: 60, age: 60, pack: 40, photo: 80, flags: 200, notes: 600, source: 120 };

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

export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Validates admin form values into a formula record (without id / verification). */
export function parseFormula(v) {
    v = v && typeof v === 'object' ? v : {};
    const f = {};
    for (const [k, max] of Object.entries(TEXT_FIELDS)) f[k] = str(v[k], max, k, k === 'name');
    if (!GROUPS.includes(v.grp)) throw new InputError('Choose a group: infant, paediatric, adult or module.');
    if (!FORMS.includes(v.form)) throw new InputError('Choose powder or liquid.');
    f.grp = v.grp;
    f.form = v.form;
    f.basis = v.basis === '100g' ? '100g' : '100ml';
    for (const [k, max] of Object.entries(NUTRIENTS)) f[k] = num(v[k], max, k);
    if (f.photo && !/^[a-z0-9-]+\.(webp|png|jpe?g)$/.test(f.photo)) throw new InputError('Photo must be a file name in img/formulas, e.g. my-feed.webp');
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
