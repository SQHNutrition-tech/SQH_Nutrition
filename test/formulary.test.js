import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFormula, nutrientsChanged, canVerify } from '../src/formulary.js';
import { usable, rankForTargets, concentrate, moduleForGap, delivers } from '../public/js/formula-math.js';

const base = { name: 'Test feed', grp: 'adult', form: 'liquid' };

test('parseFormula keeps numbers, rejects nonsense and macro mismatches', () => {
    const f = parseFormula({ ...base, kcal: '100', protein: '4', cho: '12.3', fat: '3.9', water: '84' });
    assert.equal(f.kcal, 100);
    assert.equal(f.basis, '100ml');
    assert.throws(() => parseFormula({ ...base, grp: 'cats' }));
    assert.throws(() => parseFormula({ ...base, kcal: '-1' }));
    // 4*4 + 12*4 + 4*9 = 100 → fine; 150 kcal with the same macros is a typo.
    assert.throws(() => parseFormula({ ...base, kcal: '150', protein: '4', cho: '12', fat: '4' }), /does not match/);
    assert.throws(() => parseFormula({ ...base, photo: '../../etc/passwd' }));
});

test('changing a nutrient clears verification; text edits do not', () => {
    const a = parseFormula({ ...base, kcal: '100', protein: '4' });
    assert.equal(nutrientsChanged(a, { ...a, notes: 'new note' }), false);
    assert.equal(nutrientsChanged(a, { ...a, protein: 4.5 }), true);
});

test('canVerify needs energy, protein and (for powders) the dilution', () => {
    assert.throws(() => canVerify({ form: 'liquid', basis: '100ml', kcal: 100, protein: null }));
    assert.throws(() => canVerify({ form: 'powder', basis: '100ml', kcal: 67, protein: 1.3, g_per_100ml: null }), /dilution/);
    assert.doesNotThrow(() => canVerify({ form: 'powder', basis: '100ml', kcal: 67, protein: 1.3, g_per_100ml: 13.5 }));
});

const std = { name: 'Std 1.0', verified: true, basis: '100ml', form: 'liquid', kcal: 100, protein: 4, water: 84 };
const hp = { name: 'HP 1.25', verified: true, basis: '100ml', form: 'liquid', kcal: 125, protein: 6.3, water: 81 };
const unverified = { ...hp, name: 'Unverified', verified: false };

test('only verified products are used, and ranking follows the protein target', () => {
    assert.equal(usable(unverified), false);
    const r = rankForTargets([std, hp, unverified], { kcal: 1500, protein: 75 });
    assert.equal(r.length, 2);
    assert.equal(r[0].formula.name, 'HP 1.25'); // 1200 mL → 75.6 g protein
    assert.equal(Math.round(r[0].volume), 1200);
    assert.equal(Math.round(r[1].protein), 60);  // 1500 mL of standard → 60 g
});

test('delivers scales per-100 mL values', () => {
    const d = delivers(std, 1500);
    assert.equal(d.kcal, 1500);
    assert.equal(d.water, 1260);
});

test('concentrating a powder and closing a protein gap', () => {
    const powder = { verified: true, basis: '100ml', form: 'powder', kcal: 67, protein: 1.3, g_per_100ml: 13.4, scoop_g: 4.5 };
    const c = concentrate(powder, 100);
    assert.equal(Math.round(c.grams * 10) / 10, 20);   // 100 / (67/13.4) = 20 g per 100 mL
    assert.equal(Math.round(c.factor * 100) / 100, 1.49);
    const mod = { basis: '100g', protein: 90, kcal: 370, scoop_g: 5 };
    const m = moduleForGap(mod, 18);
    assert.equal(m.grams, 20);
    assert.equal(m.scoops, 4);
});

test('per-bottle values scale with bottle size; concentrations do not apply', async () => {
    const { perServing, toMmol } = await import('../public/js/formula-math.js');
    const bottle = { basis: '100ml', serving_ml: 200, kcal: 150, protein: 6, sodium: null };
    assert.equal(perServing(bottle, 'kcal'), 300);
    assert.equal(perServing(bottle, 'protein'), 12);
    assert.equal(perServing(bottle, 'sodium'), null);
    assert.equal(perServing({ ...bottle, serving_ml: null }, 'kcal'), null);
    assert.equal(perServing({ ...bottle, basis: '100g' }, 'kcal'), null);
    assert.equal(Math.round(toMmol('sodium', 230) * 10) / 10, 10);
    assert.equal(Math.round(toMmol('potassium', 391) * 10) / 10, 10);
    assert.equal(toMmol('kcal', 100), null);
});
