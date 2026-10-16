// Spreadsheet import planning: what would be added, changed or rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planImport } from '../src/formulary.js';

const existing = [
    { id: 1, slug: 'nutrison-energy', name: 'Nutrison Energy', maker: 'Nutricia', grp: 'adult', category: '', form: 'liquid', age: '', pack: '1000 mL', photo: 'nutrison-energy.webp', flags: '', notes: '', basis: '100ml', source: '', source_url: '', kcal: 150, protein: 6, cho: 18.5, fat: 5.8, fibre: null, water: null, sodium: 135, potassium: 201, chloride: 100, calcium: 120, magnesium: 31.2, phosphate: 90, osmolality: 510, osmolarity: 400, g_per_100ml: null, scoop_g: null, serving_ml: 1000, verified_on: '2026-10-16', verified_by: 'a@b.om' },
    { id: 2, slug: 'protifar', name: 'Protifar', maker: 'Nutricia', grp: 'module', category: '', form: 'powder', age: '', pack: '', photo: '', flags: '', notes: '', basis: '100g', source: '', source_url: '', kcal: 368, protein: 87.2, cho: 1.5, fat: 1.6, fibre: 0, water: null, sodium: 100, potassium: 140, chloride: 80, calcium: 1350, magnesium: null, phosphate: 700, osmolality: null, osmolarity: null, g_per_100ml: null, scoop_g: 2.5, serving_ml: null, verified_on: null, verified_by: null }
];

test('new product is added; unchanged row is reported as same', () => {
    const plan = planImport([
        { _row: 2, name: 'New Feed 1.5', grp: 'Adult', form: 'Liquid', basis: 'per 100 mL', kcal: 150, protein: 6, cho: 18.5, fat: 5.8, serving_ml: 200 },
        { _row: 3, id: 2, name: 'Protifar', kcal: 368, protein: 87.2 }
    ], existing);
    assert.equal(plan[0].action, 'add');
    assert.equal(plan[0].slug, 'new-feed-1-5');
    assert.equal(plan[0].values.grp, 'adult');
    assert.equal(plan[1].action, 'same');
});

test('changing a number on a verified product clears verification', () => {
    const [item] = planImport([{ _row: 2, id: 1, sodium: 140 }], existing);
    assert.equal(item.action, 'update');
    assert.deepEqual(item.changes, ['sodium']);
    assert.equal(item.clearsVerification, true);
});

test('a text-only change keeps verification; a blank cell clears that value', () => {
    const [a] = planImport([{ _row: 2, id: 1, notes: 'Store below 25 °C' }], existing);
    assert.equal(a.clearsVerification, false);
    const [b] = planImport([{ _row: 2, id: 1, osmolarity: '' }], existing);
    assert.deepEqual(b.changes, ['osmolarity']);
    assert.equal(b.values.osmolarity, null);
});

test('matches by name when ID is empty, and photo is kept', () => {
    const [item] = planImport([{ _row: 2, name: 'Nutrison Energy', kcal: 151 }], existing);
    assert.equal(item.action, 'update');
    assert.equal(item.id, 1);
    assert.equal(item.values.photo, 'nutrison-energy.webp');
});

test('bad rows are reported, not saved; empty rows are skipped', () => {
    const plan = planImport([
        { _row: 2, id: 99, name: 'Ghost' },
        { _row: 3, name: 'Bad energy', grp: 'adult', form: 'liquid', kcal: 300, protein: 1, cho: 1, fat: 1 },
        { _row: 4, name: '', kcal: '' },
        { _row: 5, name: 'Twice', grp: 'adult', form: 'liquid' },
        { _row: 6, name: 'Twice', grp: 'adult', form: 'liquid' },
        { _row: 7, name: 'No group', form: 'liquid' }
    ], existing);
    assert.deepEqual(plan.map(p => [p.row, p.action]), [[2, 'error'], [3, 'error'], [5, 'add'], [6, 'error'], [7, 'error']]);
    assert.match(plan[0].error, /No product has ID 99/);
    assert.match(plan[1].error, /does not match/);
});

test('Arabic-only names get an ID', () => {
    const [item] = planImport([{ _row: 2, name: 'حليب خاص', grp: 'infant', form: 'powder' }], existing);
    assert.equal(item.action, 'add');
    assert.match(item.slug, /^product-/);
});
