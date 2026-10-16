// Excel reader/writer round trip (the formulary spreadsheet).
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeXlsx, readXlsx, colName } from '../public/js/xlsx-lite.js';

test('column letters', () => {
    assert.deepEqual([0, 25, 26, 27, 701, 702].map(colName), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
});

test('writes and reads back text, numbers, blanks, Arabic and XML characters', async () => {
    const rows = [['ID', 'Name *', 'Energy (kcal)', 'Notes'], [12, 'Ensure & "Plus" <vanilla>', 150.5, null], [null, 'حليب خاص', 100, 'line 1\nline 2']];
    const blob = writeXlsx([
        { name: 'How to fill', rows: [['Read me']] },
        { name: 'Formulary', rows, header: true, freeze: { rows: 1, cols: 2 }, lists: [{ col: 2, values: ['a', 'b'] }] }
    ]);
    const back = await readXlsx(await blob.arrayBuffer(), { sheet: 'Formulary' });
    assert.deepEqual(back, [rows[0], [12, 'Ensure & "Plus" <vanilla>', 150.5], [null, 'حليب خاص', 100, 'line 1\nline 2']]);
    const first = await readXlsx(await blob.arrayBuffer());
    assert.deepEqual(first, [['Read me']]);
});

test('rejects a file that is not .xlsx', async () => {
    await assert.rejects(readXlsx(new TextEncoder().encode('name,kcal\nx,1').buffer), /not an Excel/);
});
