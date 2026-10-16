import { $, $$, esc, api, initPage, toast, L, t } from './common.js';
import { usable, rankForTargets, concentrate, moduleForGap, COMPARE_ROWS } from './formula-math.js';

let formulas = [];
let grp = '';
const picked = new Set();

const GROUP_LABEL = { infant: 'Infant', paediatric: 'Paediatric', adult: 'Adult', module: 'Module' };
const fmt = (v, d = 1) => (v === null || v === undefined ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toString());
const photo = (f) => f.photo ? `/img/formulas/${esc(f.photo)}` : '/img/mark.png';
const unit = (f) => (f.basis === '100g' ? 'per 100 g' : 'per 100 mL');

function statusBadge(f) {
    return f.verified ? '<span class="badge b-verified">Verified</span>' : '<span class="badge b-needs">Needs label</span>';
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------
function visible() {
    const q = $('#search').value.trim().toLowerCase();
    const onlyVerified = $('#verified-only').checked;
    return formulas
        .filter(f => !grp || f.grp === grp)
        .filter(f => !onlyVerified || f.verified)
        .filter(f => !q || [f.name, f.maker, f.category, f.flags, f.age].join(' ').toLowerCase().includes(q));
}

function card(f) {
    return `<article class="product" data-id="${f.id}" tabindex="0" aria-label="${esc(f.name)}">
        <label class="cmp" title="Add to comparison"><input type="checkbox" data-cmp="${f.id}" ${picked.has(f.id) ? 'checked' : ''}> Compare</label>
        <div class="ph"><img src="${photo(f)}" alt="" loading="lazy"></div>
        <div class="body">
            <h3 data-no-i18n>${esc(f.name)}</h3>
            <div class="sub" data-no-i18n>${esc([f.maker, f.pack].filter(Boolean).join(' · '))}</div>
            <div class="tags">${statusBadge(f)}<span class="badge b-plain">${esc(f.category || GROUP_LABEL[f.grp])}</span></div>
            <div class="sub">${esc(f.age || GROUP_LABEL[f.grp])}</div>
            <div class="mini" aria-label="${unit(f)}">
                <div><b>${fmt(f.kcal, 0)}</b><span>kcal</span></div>
                <div><b>${fmt(f.protein)}</b><span>g protein</span></div>
                ${f.basis === '100g'
                    ? `<div><b>${fmt(f.scoop_g)}</b><span>g scoop</span></div>`
                    : `<div><b>${fmt(f.water, 0)}</b><span>mL water</span></div>`}
            </div>
            <div class="sub" style="font-size:.7rem;text-align:center">${unit(f)}</div>
        </div>
    </article>`;
}

function render() {
    $$('[data-grp]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.grp === grp)));
    const rows = visible();
    $('#grid').innerHTML = rows.map(card).join('') || `<div class="empty">${grp === 'module' ? 'No modules added yet. Admins can add protein, energy and fibre modules in Admin → Formulary.' : 'Nothing matches.'}</div>`;
    renderTray();
}

function renderTray() {
    const n = picked.size;
    $('#tray').hidden = n === 0;
    const names = formulas.filter(f => picked.has(f.id)).map(f => f.name);
    $('#tray-text').textContent = n === 1 ? `${names[0]} · ${L('pick one or two more', 'اختر منتجاً أو اثنين آخرين')}` : names.join(' · ');
    $('#tray-go').disabled = n < 2;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------
function openDetail(f) {
    $('#d-eyebrow').textContent = [f.maker, t(GROUP_LABEL[f.grp] || ''), t(f.form || '')].filter(Boolean).join(' · ');
    $('#d-title').textContent = f.name;
    const rows = COMPARE_ROWS
        .filter(([k]) => k !== 'g_per_100ml')
        .map(([k, label, u]) => `<tr class="${f[k] === null ? 'missing' : ''}"><td>${label}</td><td>${f[k] === null ? 'not entered' : `${fmt(f[k], k === 'kcal' || k === 'water' ? 0 : 1)} ${u}`}</td></tr>`).join('');
    const prep = f.form === 'powder'
        ? `<tr class="${f.g_per_100ml === null ? 'missing' : ''}"><td>Standard dilution</td><td>${f.g_per_100ml === null ? 'not entered' : L(`${fmt(f.g_per_100ml)} g powder per 100 mL`, `${fmt(f.g_per_100ml)} g مسحوق لكل 100 mL`)}</td></tr>
           <tr class="${f.scoop_g === null ? 'missing' : ''}"><td>Scoop size</td><td>${f.scoop_g === null ? 'not entered' : `${fmt(f.scoop_g)} g`}</td></tr>` : '';
    const verify = f.verified
        ? `<p class="verify-line">${L(`✓ Checked against the label by <b>${esc(f.verified_by_name || f.verified_by)}</b> on ${esc(f.verified_on)}.`, `✓ روجعت مقابل الملصق بواسطة <b>${esc(f.verified_by_name || f.verified_by)}</b> بتاريخ ${esc(f.verified_on)}.`)}</p>`
        : `<p class="verify-line notice warn" style="margin-top:12px">Not verified yet: the nutrition panel still needs to be entered and checked. This product can't be used in calculators until then.</p>`;
    const flags = f.flags ? `<div class="tags" style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">${f.flags.split(',').map(t => `<span class="badge b-plain">${esc(t.trim())}</span>`).join('')}</div>` : '';
    const canUse = usable(f);
    const conc = canUse && f.form === 'powder' ? `<div class="conc">
            <b>Concentrate this feed</b>
            <p class="small muted" style="margin:4px 0 0">${L(`Standard is ${fmt(f.kcal, 0)} kcal per 100 mL. Follow your unit's protocol for concentrating feeds and check osmolality.`, `التركيز القياسي ${fmt(f.kcal, 0)} kcal لكل 100 mL. اتبع بروتوكول وحدتك لتركيز الحليب وتحقق من الأسمولية.`)}</p>
            <div class="row"><label class="field" style="flex-direction:row;align-items:center;gap:10px">Target<input type="number" id="conc-target" min="1" max="200" value="${Math.round(f.kcal * 1.25)}"> kcal / 100 mL</label></div>
            <p id="conc-out" style="margin-top:8px"></p>
        </div>` : '';

    $('#d-body').innerHTML = `<div class="detail">
        <div class="ph"><img src="${photo(f)}" alt="${esc(f.name)} pack"></div>
        <div>
            <p class="muted small">${esc([f.category, f.age, f.pack].filter(Boolean).join(' · '))}</p>
            ${flags}
            <table class="nut"><tbody><tr><td colspan="2" class="eyebrow" style="padding-top:12px;text-align:start">${t(unit(f))}${f.form === 'powder' && f.basis === '100ml' ? L(' as prepared', ' بعد التحضير') : ''}</td></tr>${rows}${prep}</tbody></table>
            ${f.notes ? `<p class="small" style="margin-top:12px" data-no-i18n>${esc(f.notes)}</p>` : ''}
            ${f.source ? `<p class="small muted">${L('Source:', 'المصدر:')} <span data-no-i18n>${esc(f.source)}</span></p>` : ''}
            ${verify}
            ${conc}
            <div class="row" style="margin-top:18px">
                ${canUse ? `<a class="btn primary" href="/tools.html?formula=${encodeURIComponent(f.slug)}#enteral">Use in enteral calculator</a>` : '<button class="primary" disabled title="Verify the label values first">Use in enteral calculator</button>'}
                <button type="button" class="ghost" data-pick="${f.id}">${picked.has(f.id) ? 'Remove from comparison' : 'Add to comparison'}</button>
            </div>
        </div>
    </div>`;

    const target = $('#conc-target');
    if (target) {
        const update = () => {
            const r = concentrate(f, Number(target.value));
            $('#conc-out').innerHTML = r
                ? L(`<b>${fmt(r.grams)} g</b> powder per 100 mL of made-up feed${r.scoops !== null ? ` (≈ ${fmt(r.scoops)} scoops)` : ''} · ${fmt(r.factor, 2)}× standard · protein ≈ ${fmt(r.protein)} g / 100 mL`,
                    `<b>${fmt(r.grams)} g</b> مسحوق لكل 100 mL من الحليب المحضّر${r.scoops !== null ? ` (≈ ${fmt(r.scoops)} مكيال)` : ''} · ${fmt(r.factor, 2)}× القياسي · البروتين ≈ ${fmt(r.protein)} g / 100 mL`)
                : '';
        };
        target.addEventListener('input', update);
        update();
    }
    $('#detail').showModal();
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------
function openCompare() {
    const list = formulas.filter(f => picked.has(f.id));
    const head = `<thead><tr><th></th>${list.map(f => `<th><img src="${photo(f)}" alt="">${esc(f.name)}<br><span class="small muted">${f.verified ? 'Verified' : 'Needs label'}</span></th>`).join('')}</tr></thead>`;
    // Always show the core rows; hide others that are empty for every product.
    const rows = COMPARE_ROWS.filter(([k]) => ['kcal', 'protein', 'water'].includes(k) || list.some(f => f[k] !== null));
    const body = rows.map(([k, label, u]) => {
        const vals = list.map(f => f[k]);
        const known = vals.filter(v => v !== null);
        const max = known.length > 1 ? Math.max(...known) : null;
        return `<tr><td>${label} <span class="small muted">${u}</span></td>${vals.map(v => `<td class="${v !== null && v === max && known.some(x => x !== max) ? 'hi' : ''}">${fmt(v, k === 'kcal' || k === 'water' || k === 'osmolality' ? 0 : 1)}</td>`).join('')}</tr>`;
    }).join('');
    const extra = `<tr><td>Form</td>${list.map(f => `<td>${esc(t(f.form))}</td>`).join('')}</tr><tr><td>Age / weight</td>${list.map(f => `<td>${esc(f.age || '—')}</td>`).join('')}</tr>`;
    $('#c-body').innerHTML = `<table class="compare">${head}<tbody>${body}${extra}</tbody></table>`;
    $('#compare').showModal();
}

function togglePick(id) {
    if (picked.has(id)) picked.delete(id);
    else if (picked.size >= 3) { toast('Compare up to three products at a time'); return false; }
    else picked.add(id);
    render();
    return true;
}

// ---------------------------------------------------------------------------
// Which formula fits?
// ---------------------------------------------------------------------------
$('#fit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    const targets = { kcal: Number(v.kcal), protein: Number(v.protein) || 0, fluid: Number(v.fluid) || 0 };
    const pool = formulas.filter(f => !v.grp || f.grp === v.grp);
    const box = $('#fit-results');
    if (!(targets.kcal > 0)) { box.innerHTML = '<p class="empty-note">Enter the energy target first.</p>'; return; }
    const ranked = rankForTargets(pool, targets).slice(0, 5);
    if (!ranked.length) {
        box.innerHTML = `<p class="empty-note">${L(`No verified products${v.grp ? ' in this group' : ''} yet. Once nutrition panels are entered and checked, matches appear here.`, `لا توجد منتجات موثّقة${v.grp ? ' في هذه المجموعة' : ''} بعد. ستظهر النتائج هنا بعد إدخال الجداول الغذائية ومراجعتها.`)}</p>`;
        return;
    }
    // Verified protein modules can close a protein shortfall.
    const proteinModule = formulas.find(f => f.grp === 'module' && f.verified && f.basis === '100g' && f.protein > 50);
    const topUp = (r) => {
        const gap = targets.protein - (r.protein ?? 0);
        if (!proteinModule || !(targets.protein > 0) || r.protein === null || gap < 3) return '';
        const m = moduleForGap(proteinModule, gap);
        return m ? `<div class="small muted" style="grid-column:2 / -1">${L(`+ ${fmt(m.grams)} g ${esc(proteinModule.name)}${m.scoops !== null ? ` (≈ ${fmt(m.scoops)} scoops)` : ''} closes the ${Math.round(gap)} g protein gap`, `إضافة ${fmt(m.grams)} g من ${esc(proteinModule.name)}${m.scoops !== null ? ` (≈ ${fmt(m.scoops)} مكيال)` : ''} تسد نقص البروتين البالغ ${Math.round(gap)} g`)}</div>` : '';
    };
    box.innerHTML = ranked.map(r => `<div class="fit-row">
        <img src="${photo(r.formula)}" alt="">
        <div class="nm">${esc(r.formula.name)}<small>${esc(r.formula.category)}</small></div>
        <div class="v">${Math.round(r.volume)} mL<small>per day</small></div>
        <div class="v">${r.protein === null ? '—' : `${Math.round(r.protein)} g`}<small>${r.proteinPct === null ? L('protein', 'بروتين') : L(`${Math.round(r.proteinPct * 100)}% of protein`, `${Math.round(r.proteinPct * 100)}% من البروتين`)}</small></div>
        <div class="v water">${r.water === null ? '—' : `${Math.round(r.water)} mL`}<small>free water</small></div>
        ${topUp(r)}
    </div>`).join('');
});

// ---------------------------------------------------------------------------
// Events & start
// ---------------------------------------------------------------------------
$('#grid').addEventListener('click', (e) => {
    const cb = e.target.closest('[data-cmp]');
    if (cb) {
        e.stopPropagation();
        if (e.target.matches('input') && !togglePick(Number(cb.dataset.cmp))) e.target.checked = false;
        return;
    }
    if (e.target.closest('.cmp')) return;
    const card = e.target.closest('.product');
    if (card) openDetail(formulas.find(f => f.id === Number(card.dataset.id)));
});
$('#grid').addEventListener('keydown', (e) => {
    const card = e.target.closest('.product');
    if (card && (e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); openDetail(formulas.find(f => f.id === Number(card.dataset.id))); }
});
$('#d-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    togglePick(Number(b.dataset.pick));
    b.textContent = picked.has(Number(b.dataset.pick)) ? 'Remove from comparison' : 'Add to comparison';
});
$$('[data-grp]').forEach(b => b.addEventListener('click', () => { grp = b.dataset.grp; render(); }));
['#search', '#verified-only'].forEach(s => $(s).addEventListener('input', render));
$('#tray-go').onclick = openCompare;
$('#tray-clear').onclick = () => { picked.clear(); render(); };
$$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

(async () => {
    try {
        await initPage('/formulas.html');
        ({ formulas } = await api('/api/formulas'));
        const pending = formulas.filter(f => !f.verified).length;
        if (pending) {
            $('#pending-note').hidden = false;
            $('#pending-note').textContent = L(`${pending} of ${formulas.length} products still need their nutrition panel entered and checked before they can be used in calculators.`, `${pending} من ${formulas.length} منتجاً ما زالت تحتاج إلى إدخال الجدول الغذائي ومراجعته قبل استخدامها في الحاسبات.`);
        }
        render();
    } catch (e) {
        $('#grid').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
})();
