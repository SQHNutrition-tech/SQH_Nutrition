// Arabic dictionary: loads cleanly, has no empty entries, and its patterns
// translate the messages the server builds with names and numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../public/js/i18n-ar.js', import.meta.url), 'utf8'), { window });
const dict = window.I18N_AR;
const tr = (s) => {
    if (Object.hasOwn(dict, s)) return dict[s];
    for (const [re, fn] of window.I18N_AR_PATTERNS) {
        const m = s.match(re);
        if (m) return fn(m, tr);
    }
    return s;
};

test('every entry has Arabic text', () => {
    for (const [en, ar] of Object.entries(dict)) {
        assert.ok(ar && ar.trim(), `empty translation for "${en}"`);
        assert.equal(en, en.trim().replace(/\s+/g, ' '), `key must be trimmed: "${en}"`);
    }
});

test('config lists are translated', async () => {
    const config = await import('../src/config.js');
    const lists = [config.LOCATIONS.map(l => l.name), config.NEXT_ACTIONS, config.FEEDING_ROUTES, config.CLOSE_REASONS, config.DIRECTORY_CATEGORIES].flat();
    for (const s of lists) assert.ok(Object.hasOwn(dict, s), `missing Arabic for "${s}"`);
});

test('activity log and error patterns', () => {
    assert.equal(tr('Case added · Surgical'), 'أُضيفت الحالة · الجراحة');
    assert.equal(tr('Discharged to Nutrition clinic (from Surgical) · handover requested to a@b.om'),
        'خرج إلى عيادة التغذية (من الجراحة) · طُلب التسليم إلى a@b.om');
    assert.equal(tr('Transferred to Burns · Bed 4 (from ICU-1)'), 'نُقل إلى الحروق · سرير 4 (من العناية المركزة 1)');
    assert.equal(tr('Closed · Entered in error'), 'أُغلقت · أُدخلت بالخطأ');
    assert.equal(tr('Please complete: Hospital number.'), 'يرجى إكمال: رقم الملف.');
    assert.match(tr('Hospital number 00123 already has an open case. Search the Department view.'), /00123/);
});
