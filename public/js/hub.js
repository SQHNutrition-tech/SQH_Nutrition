import { $, esc, api, initPage } from './common.js';

// One thought per day, the same for everyone. Unattributed on purpose.
const QUOTES = [
    ['Every plate you plan today is part of someone\'s recovery.', 'كل خطة غذائية تضعها اليوم هي جزء من رحلة تعافي مريض.'],
    ['Small, steady steps in nutrition make big differences in healing.', 'الخطوات الصغيرة الثابتة في التغذية تصنع فرقاً كبيراً في الشفاء.'],
    ['You are the voice of the patient who cannot eat.', 'أنت صوت المريض الذي لا يستطيع أن يأكل.'],
    ['Good handovers are good care.', 'التسليم الجيد رعاية جيدة.'],
    ['Measure, listen, adjust — then measure again.', 'قِس، استمع، عدّل… ثم قِس من جديد.'],
    ['Malnutrition is quiet. Your screening makes it visible.', 'سوء التغذية صامت، وفحصك هو ما يجعله مرئياً.'],
    ['Kindness is part of every nutrition plan.', 'اللطف جزء من كل خطة غذائية.'],
    ['Today\'s follow-up prevents tomorrow\'s complication.', 'متابعة اليوم تمنع مضاعفات الغد.'],
    ['Teamwork turns a busy ward into a safe ward.', 'العمل الجماعي يحوّل القسم المزدحم إلى قسم آمن.'],
    ['Food is care you can measure.', 'الغذاء رعاية يمكن قياسها.'],
    ['Ask one more question at the bedside; it is often the important one.', 'اسأل سؤالاً إضافياً عند سرير المريض؛ فغالباً ما يكون هو الأهم.'],
    ['Progress, not perfection — for patients and for us.', 'التقدم لا الكمال… للمرضى ولنا أيضاً.'],
    ['A clear plan today is a calmer discharge tomorrow.', 'خطة واضحة اليوم تعني خروجاً أهدأ غداً.'],
    ['Your expertise is a treatment, not an extra.', 'خبرتك علاج، وليست إضافة.'],
    ['Look after yourself too: rested dietitians give better care.', 'اعتنِ بنفسك أيضاً؛ فأخصائي التغذية المرتاح يقدّم رعاية أفضل.'],
    ['Every gram of protein counts when healing is the goal.', 'كل غرام من البروتين مهم حين يكون الشفاء هو الهدف.'],
    ['Listen to families; they know what the patient will really eat.', 'استمع إلى الأهل؛ فهم يعرفون ما سيأكله المريض فعلاً.'],
    ['Consistency builds trust — with patients and with colleagues.', 'الاستمرارية تبني الثقة مع المرضى ومع الزملاء.'],
    ['Begin with the patient most at risk.', 'ابدأ بالمريض الأكثر عرضة للخطر.'],
    ['Learning something new each week keeps practice safe.', 'تعلّم شيء جديد كل أسبوع يحافظ على أمان الممارسة.'],
    ['Thank you for the care no one sees.', 'شكراً على الرعاية التي لا يراها أحد.']
];

const FAV_KEY = 'hub_fav_ext';
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { /* storage unavailable */ }
let entries = [];

function greeting() {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Muscat', hour: 'numeric', hour12: false }).format(new Date()));
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function dayOfYear() {
    const d = new Date();
    return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

function initials(label) {
    return label.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function renderDirectory() {
    const q = $('#dir-search').value.trim().toLowerCase();
    const box = $('#directory');
    if (!entries.length) {
        box.innerHTML = '<p class="muted small">No numbers yet. An admin can add them under Admin → Phone directory.</p>';
        return;
    }
    const match = entries.filter(e => !q || [e.name, e.category, e.ext, e.notes].join(' ').toLowerCase().includes(q));
    if (!match.length) {
        box.innerHTML = '<p class="muted small">Nothing matches that search.</p>';
        return;
    }
    const groups = [];
    const starred = match.filter(e => favs.has(e.id));
    if (starred.length && !q) groups.push(['★ My numbers', starred]);
    const order = ['Urgent', 'Our department', 'Wards', 'Clinics', 'Support services', 'Other'];
    for (const cat of order) {
        const list = match.filter(e => e.category === cat);
        if (list.length) groups.push([cat, list]);
    }
    box.innerHTML = groups.map(([cat, list]) => `
        <div class="dir-cat ${cat === 'Urgent' ? 'dir-urgent' : ''}">
            <h3>${esc(cat)}</h3>
            ${list.map(e => `
                <div class="dir-row">
                    <button class="star" data-id="${e.id}" aria-pressed="${favs.has(e.id)}" aria-label="${favs.has(e.id) ? 'Unstar' : 'Star'} ${esc(e.name)}">${favs.has(e.id) ? '★' : '☆'}</button>
                    <div class="nm">${esc(e.name)}${e.notes ? `<small>${esc(e.notes)}</small>` : ''}</div>
                    <span class="ext">${esc(e.ext)}</span>
                </div>`).join('')}
        </div>`).join('');
}

async function main() {
    const me = await initPage('/');
    $('#greeting').textContent = `${greeting()}, ${me.me.name.split(' ')[0]}`;
    $('#today-label').textContent = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Muscat', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const [en, ar] = QUOTES[dayOfYear() % QUOTES.length];
    $('#q-en').textContent = en;
    $('#q-ar').textContent = ar;

    const [summary, links, dir] = await Promise.all([api('/api/summary'), api('/api/links'), api('/api/directory')]);

    const c = summary.counts;
    for (const k of ['overdue', 'today', 'incoming', 'department']) $('#m-' + k).textContent = c[k];
    const due = c.overdue + c.today;
    $('#day-summary').textContent = due
        ? `You have ${due} review${due === 1 ? '' : 's'} due${c.urgent ? `, ${c.urgent} flagged urgent` : ''}${c.incoming ? ` and ${c.incoming} handover${c.incoming === 1 ? '' : 's'} waiting for you` : ''}.`
        : c.incoming ? `No reviews due. ${c.incoming} handover${c.incoming === 1 ? ' is' : 's are'} waiting for you.` : 'Your list is clear for today.';

    $('#links').innerHTML = links.links.length
        ? links.links.map(l => `<a class="link-tile" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="ico">${esc(initials(l.label))}</span>${esc(l.label)}</a>`).join('')
        : '<p class="muted small">No links yet.</p>';
    if (!links.links.length && me.me.role === 'admin') $('#links-hint').innerHTML = 'Add the Ministry email, HR and other sites in <a href="/admin.html#links">Admin</a>.';

    entries = dir.entries;
    renderDirectory();
    $('#dir-search').addEventListener('input', renderDirectory);
    $('#directory').addEventListener('click', (e) => {
        const b = e.target.closest('.star');
        if (!b) return;
        const id = Number(b.dataset.id);
        favs.has(id) ? favs.delete(id) : favs.add(id);
        try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* ignore */ }
        renderDirectory();
    });
}

main().catch(e => {
    $('#day-summary').textContent = e.message;
});
