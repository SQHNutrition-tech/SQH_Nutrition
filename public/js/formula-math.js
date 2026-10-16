// Feed calculations shared by the formulary page and the calculators.
// Pure functions; values are per 100 mL as prepared unless basis is '100g'.

/** Only verified products with energy per 100 mL may drive a calculation. */
export const usable = (f) => !!f.verified && f.basis === '100ml' && Number.isFinite(f.kcal) && f.kcal > 0;

export const kcalPerMl = (f) => f.kcal / 100;

/** What a daily volume of a feed delivers. */
export function delivers(f, volumeMl) {
    const per = (k) => (Number.isFinite(f[k]) ? (f[k] * volumeMl) / 100 : null);
    return {
        volume: volumeMl,
        kcal: per('kcal'),
        protein: per('protein'),
        water: per('water'),
        sodium: per('sodium'),
        potassium: per('potassium'),
        fibre: per('fibre')
    };
}

/**
 * Ranks usable feeds for a set of daily targets.
 * Volume is chosen to meet the energy target; the score is how far protein
 * (and fluid, if given) land from target, so the best match comes first.
 */
export function rankForTargets(formulas, { kcal, protein, fluid }) {
    if (!(kcal > 0)) return [];
    return formulas.filter(usable).map(f => {
        const volume = (kcal / f.kcal) * 100;
        const d = delivers(f, volume);
        const proteinPct = protein > 0 && d.protein !== null ? d.protein / protein : null;
        const fluidPct = fluid > 0 && d.water !== null ? d.water / fluid : null;
        let score = 0;
        if (proteinPct !== null) score += Math.abs(1 - proteinPct) * 2;
        else if (protein > 0) score += 1; // unknown protein ranks below known
        if (fluidPct !== null) score += Math.max(0, fluidPct - 1); // only penalise exceeding the fluid target
        return { formula: f, ...d, proteinPct, fluidPct, score };
    }).sort((a, b) => a.score - b.score || a.volume - b.volume);
}

/**
 * Powder made up stronger than standard: grams of powder per 100 mL of
 * finished feed to reach a target energy density. Assumes the label's
 * g_per_100ml means grams per 100 mL of made-up feed.
 */
export function concentrate(f, targetKcalPer100) {
    if (!usable(f) || f.form !== 'powder' || !(f.g_per_100ml > 0) || !(targetKcalPer100 > 0)) return null;
    const kcalPerGram = f.kcal / f.g_per_100ml;
    const grams = targetKcalPer100 / kcalPerGram;
    const factor = targetKcalPer100 / f.kcal;
    return {
        grams,
        scoops: f.scoop_g > 0 ? grams / f.scoop_g : null,
        factor,
        protein: Number.isFinite(f.protein) ? f.protein * factor : null
    };
}

/** Grams (and scoops) of a protein module needed to close a protein gap. */
export function moduleForGap(module, gapGrams) {
    if (!module || !(gapGrams > 0) || module.basis !== '100g' || !(module.protein > 0)) return null;
    const grams = (gapGrams / module.protein) * 100;
    return {
        grams,
        scoops: module.scoop_g > 0 ? grams / module.scoop_g : null,
        kcal: Number.isFinite(module.kcal) ? (module.kcal * grams) / 100 : null
    };
}

/** Fields shown in the side-by-side comparison, in display order. */
// The fourth item marks values that scale with volume (shown per bottle too);
// osmolality and osmolarity are concentrations, so they do not.
export const COMPARE_ROWS = [
    ['kcal', 'Energy', 'kcal', true],
    ['protein', 'Protein', 'g', true],
    ['cho', 'Carbohydrate', 'g', true],
    ['fat', 'Fat', 'g', true],
    ['fibre', 'Fibre', 'g', true],
    ['water', 'Free water', 'mL', true],
    ['sodium', 'Sodium', 'mg', true],
    ['potassium', 'Potassium', 'mg', true],
    ['chloride', 'Chloride', 'mg', true],
    ['calcium', 'Calcium', 'mg', true],
    ['magnesium', 'Magnesium', 'mg', true],
    ['phosphate', 'Phosphate', 'mg', true],
    ['osmolality', 'Osmolality', 'mOsm/kg', false],
    ['osmolarity', 'Osmolarity', 'mOsm/L', false],
    ['g_per_100ml', 'Powder per 100 mL', 'g', false]
];

// mg → mmol for the electrolytes dietitians usually prescribe in mmol.
// Phosphate labels give phosphorus in mg, so 1 mmol = 30.97 mg.
export const MMOL_MG = { sodium: 22.99, potassium: 39.1, chloride: 35.45, calcium: 40.08, magnesium: 24.31, phosphate: 30.97 };
export const toMmol = (k, mg) => (MMOL_MG[k] && Number.isFinite(mg) ? mg / MMOL_MG[k] : null);

/** A value for one bottle as sold (null when the bottle size or value is unknown). */
export function perServing(f, k) {
    if (f.basis !== '100ml' || !(f.serving_ml > 0) || !Number.isFinite(f[k])) return null;
    return (f[k] * f.serving_ml) / 100;
}
