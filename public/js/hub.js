import { $, esc, api, initPage } from './common.js';
import { mountDirectory } from './directory-view.js';

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

async function main() {
    const me = await initPage('/');
    const first = document.createElement('b');
    first.textContent = me.me.name.split(' ')[0];
    $('#greeting').replaceChildren(`${greeting()}, `, first);
    $('#today-label').textContent = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Muscat', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const [en, ar] = QUOTES[dayOfYear() % QUOTES.length];
    $('#q-en').textContent = en;
    $('#q-ar').textContent = ar;

    const [summary, links, dir] = await Promise.all([api('/api/summary'), api('/api/links'), api('/api/directory')]);

    const c = summary.counts;
    for (const k of ['overdue', 'today', 'incoming', 'department']) $('#m-' + k).textContent = c[k];
    const due = c.overdue + c.today;
    $('#day-summary').textContent = due
        ? `${due} review${due === 1 ? '' : 's'} due today${c.urgent ? `, ${c.urgent} marked urgent` : ''}${c.incoming ? `, and ${c.incoming} handover${c.incoming === 1 ? '' : 's'} waiting for you` : ''}.`
        : c.incoming ? `No reviews due. ${c.incoming} handover${c.incoming === 1 ? ' is' : 's are'} waiting for you.` : 'Your list is clear today. Have a good shift.';

    // Built-in pages first, then the admin-managed external links.
    const internal = [['/directory.html', 'Phone directory', '☎']];
    $('#links').innerHTML =
        internal.map(([href, label, ico]) => `<a class="linkrow" href="${href}"><span class="ico">${ico}</span><span class="lbl">${label}</span><span class="arr" aria-hidden="true">→</span></a>`).join('') +
        links.links.map(l => `<a class="linkrow" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="ico">${esc(initials(l.label))}</span><span class="lbl">${esc(l.label)}</span><span class="arr" aria-hidden="true">↗</span></a>`).join('');
    if (!links.links.length && me.me.role === 'admin') $('#links-hint').innerHTML = 'Add the Ministry email, HR and other sites in <a href="/admin.html#links">Admin</a>.';

    mountDirectory({ search: $('#dir-search'), box: $('#directory'), entries: dir.entries, compact: true });
}

main().catch(e => {
    $('#day-summary').textContent = e.message;
});
