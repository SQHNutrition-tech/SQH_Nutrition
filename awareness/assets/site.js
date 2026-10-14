/* Nutrition Awareness (الوعي التغذوي) – public site
   Built on the Claude Design file "Nutrition Journey.html". No build step, no external requests
   except the OpenStreetMap tiles (the map still works offline, without the base map). */

/* ---------- Settings: edit these ---------- */
const CONFIG = {
  // Address the QR codes point to. Change this once the hosting address is confirmed.
  siteUrl: 'https://sqhnutrition-tech.github.io/SQH_Nutrition/awareness/',
  // Launch ceremony (Oman time, UTC+4). After `end`, the hero shows "launched on" wording.
  launchEnd: '2026-10-15T14:00:00+04:00',
  // Approved department logo, e.g. 'assets/img/logo-department.png'. Leave null until supplied.
  deptLogo: null,
  // Touchscreen kiosk (open the site with ?kiosk): reset to the start after this many idle seconds.
  idleResetSeconds: 120,
  // Presentation mode auto-scroll speed in pixels per second.
  presentSpeed: 70,
};

/* Approved handouts. Add { ar, en, url } entries once each handout is approved (PDFs can go in assets/handouts/). */
const HANDOUTS = [];

const RESOURCES = [
  { ic: '🏛️', url: 'https://www.moh.gov.om', ar: 'وزارة الصحة – سلطنة عُمان', en: 'Ministry of Health – Sultanate of Oman', dar: 'الموقع الرسمي للمعلومات والخدمات الصحية الوطنية.', den: 'Official site for national health information and services.' },
  { ic: '🌍', url: { ar: 'https://www.who.int/ar/news-room/fact-sheets/detail/healthy-diet', en: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet' }, ar: 'النظام الغذائي الصحي – منظمة الصحة العالمية', en: 'Healthy diet – World Health Organization', dar: 'صحيفة وقائع موثوقة عن أسس الغذاء الصحي.', den: 'A trusted fact sheet on the basics of a healthy diet.' },
];

/* ---------- Helpers ---------- */
const C = { teal: '#055F62', green: '#7FA050', lime: '#B5D98A', coral: '#F26B4F', saffron: '#F2B33D', berry: '#C2416B', sky: '#3BA7C9', plum: '#6C4FA3', deep: '#06393B' };
const L2 = (ar, en) => `<span class="ar">${ar}</span><span class="en">${en}</span>`;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const isEn = () => document.body.classList.contains('en');
const params = new URLSearchParams(location.search);

/* ---------- Language ---------- */
function setLang(en) {
  document.body.classList.toggle('en', en);
  document.documentElement.dir = en ? 'ltr' : 'rtl';
  document.documentElement.lang = en ? 'en' : 'ar';
  document.title = en ? 'Nutrition Awareness · The Patient Nutrition Journey in Dhofar' : 'الوعي التغذوي · رحلة المريض التغذوية في ظفار';
  if (window.refreshMapLabels) refreshMapLabels();
  onScroll();
  setTimeout(() => map && map.invalidateSize(), 50);
}
$('#lang').onclick = () => setLang(!isEn());
if (params.get('lang') === 'en') setLang(true);

/* ---------- Hero ---------- */
$$('[data-split]').forEach(h => { h.innerHTML = h.textContent.trim().split(/\s+/).map((w, i) => `<span class="w"><i style="animation-delay:${.25 + i * .14}s">${w}</i></span>`).join(''); });
const tilt = $('#tilt');
[[1, C.lime, 40], [.82, C.coral, 28], [.64, C.saffron, 22], [.46, C.sky, 16], [.3, C.berry, 12], [.16, C.green, 9]].forEach(([s, c, d], i) => {
  const r = document.createElement('div'); r.className = 'ring';
  r.style.cssText = `width:${s * 100}%;height:${s * 100}%;color:${c};opacity:${.25 + .12 * i};animation:${i % 2 ? 'spinr' : 'spin'} ${d}s linear infinite`;
  r.innerHTML = '<span class="dot"></span>' + (i % 2 ? '' : '<span class="dot" style="top:auto;bottom:-9px"></span>');
  tilt.appendChild(r);
});
$('#hero').addEventListener('pointermove', e => { const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; tilt.style.transform = `rotateX(${62 - y * 14}deg) rotateY(${x * 14}deg)`; });
const heroVideo = $('#heroVideo');
heroVideo.querySelector('source').addEventListener('error', () => heroVideo.remove());
if (matchMedia('(prefers-reduced-motion: reduce)').matches) heroVideo.removeAttribute('autoplay'), heroVideo.pause();

const launched = Date.now() > Date.parse(CONFIG.launchEnd);
$('#eventLine').innerHTML = launched
  ? L2('<em><b>انطلقت المبادرة</b></em><em>الخميس ١٥ أكتوبر ٢٠٢٦</em><em>بهو مستشفى السلطان قابوس</em>', '<em><b>Launched</b></em><em>Thursday 15 October 2026</em><em>Sultan Qaboos Hospital lobby</em>')
  : L2('<em><b>حفل التدشين</b></em><em>الخميس ١٥ أكتوبر ٢٠٢٦</em><em>١٠:٠٠ صباحًا</em><em>بهو مستشفى السلطان قابوس</em>', '<em><b>Launch ceremony</b></em><em>Thursday 15 October 2026</em><em>10:00 a.m.</em><em>Sultan Qaboos Hospital lobby</em>');

/* ---------- Journey data (also feeds the marquee) ---------- */
const stages = [
  { c: C.coral, ar: 'الكشف التغذوي', en: 'Nutrition screening', w: [['كل المرافق', 'All facilities']], li: [['أداة MUST لكل بالغ عند أول زيارة أو خلال ٢٤ ساعة من التنويم', 'MUST for every adult at first visit or within 24 h of admission'], ['منحنيات النمو لكل طفل', 'Growth charts for every child'], ['إعادة الكشف أسبوعيًا للمنومين', 'Weekly re-screening for inpatients']] },
  { c: C.saffron, ar: 'الإحالة', en: 'Referral', w: [['المراكز الصحية', 'Health centres'], ['المستشفيات', 'Hospitals']], li: [['يحيل الطبيب المريض متوسط أو عالي الخطر (MUST ≥ ١) إلى أخصائي التغذية', 'The doctor refers medium- or high-risk patients (MUST ≥ 1) to a dietitian'], ['إحالة منسقة بين المراكز الصحية والعيادات التخصصية والمستشفى', 'Coordinated referral between health centres, specialist clinics and the hospital']] },
  { c: C.sky, ar: 'تقييم أخصائي التغذية', en: 'Dietitian assessment', w: [['عيادة التغذية', 'Nutrition clinic'], ['الأجنحة', 'Wards']], li: [['القياسات الجسمية والفحوصات المخبرية والعلامات السريرية والتاريخ الغذائي', 'Body measurements, lab results, clinical signs and diet history'], ['تحديد الاحتياجات من الطاقة والبروتين والسوائل', 'Energy, protein and fluid requirements'], ['تشخيص تغذوي واضح يوجّه الخطة', 'A clear nutrition diagnosis that guides the plan']] },
  { c: C.teal, ar: 'العلاج التغذوي', en: 'Nutrition treatment', w: [['خطة فردية', 'Individual plan']], li: [['نظام غذائي علاجي حسب الحالة', 'A therapeutic diet tailored to the condition'], ['مكملات غذائية فموية عند الحاجة', 'Oral nutritional supplements when needed'], ['تغذية أنبوبية للمنومين عند الحاجة', 'Tube feeding for inpatients when needed'], ['استشارة وتثقيف للمريض والأسرة', 'Counselling and education for the patient and family']] },
  { c: C.berry, ar: 'المتابعة', en: 'Follow-up', w: [['زيارات دورية', 'Regular reviews']], li: [['متابعة الوزن والمدخول الغذائي والمؤشرات المخبرية', 'Tracking weight, food intake and lab markers'], ['قياس التقدم نحو الأهداف وتعديل الخطة', 'Measuring progress against goals and adjusting the plan']] },
  { c: C.plum, ar: 'التخطيط للخروج', en: 'Discharge planning', w: [['مستشفى السلطان قابوس', 'Sultan Qaboos Hospital']], li: [['إرشادات غذائية مكتوبة للمنزل', 'Written nutrition guidance for home'], ['تدريب على التغذية الأنبوبية المنزلية عند الحاجة', 'Home tube-feeding training when needed'], ['ترتيب المتابعة في العيادة أو المركز الصحي المناسب', 'Follow-up arranged at the right clinic or health centre']] },
  { c: C.green, ar: 'المتابعة في المركز الصحي', en: 'Health-centre follow-up', w: [['الرعاية الصحية الأولية', 'Primary health care'], ['العيادات التخصصية', 'Specialist clinics']], li: [['متابعة التغذية في أقرب مركز صحي إلى المريض', 'Nutrition follow-up at the health centre nearest the patient'], ['إعادة الكشف الدوري لمنع الانتكاس', 'Regular re-screening to prevent relapse'], ['إحالة جديدة إلى المستشفى عند الحاجة', 'A new hospital referral when needed']] },
];
$('#mq').innerHTML = [0, 1].map(() => stages.map(s => `<span>${L2(s.ar, s.en)}</span>`).join('')).join('');

/* ---------- Team ---------- */
const pal = [C.teal, C.coral, C.saffron, C.lime, C.sky, C.berry, C.green, C.plum];
$('#people').innerHTML = Array.from({ length: 21 }, (_, i) => `<div class="person" style="background:${pal[(i * 3) % pal.length]};transition-delay:${i * 60}ms"></div>`).join('');

/* ---------- Integration tiers ---------- */
const tiers = [
  [C.green, 'المستوى الأول', 'Level 1', 'المراكز الصحية', 'Health centres', 'عيادات التغذية في الرعاية الصحية الأولية: تقييم واستشارة ومتابعة تغذوية قريبًا من مجتمع المريض.', 'Primary health care nutrition clinics: nutrition assessment, counselling and follow-up close to patients’ communities.'],
  [C.sky, 'المستوى الثاني', 'Level 2', 'العيادات التخصصية', 'Specialist clinics', 'رعاية تغذوية لحالات السكري والسمنة والحمل والأطفال وأمراض الكلى.', 'Nutrition care for diabetes, obesity, pregnancy, children and kidney conditions.'],
  [C.teal, 'المستوى الثالث', 'Level 3', 'مستشفى السلطان قابوس', 'Sultan Qaboos Hospital', 'رعاية تغذوية فردية أثناء التنويم، ودعم تغذوي بالمكملات أو التغذية الأنبوبية، وتخطيط للخروج.', 'Individual nutrition care during admission, nutrition support with supplements or tube feeding, and discharge planning.'],
];
$('#tiers').innerHTML = tiers.map(([c, la, le, a, e, pa, pe], i) => `<div class="tier reveal" style="background:${c};transition-delay:${i * 90}ms"><span class="rings"></span><span class="lv">${L2(la, le)}</span><h3>${L2(a, e)}</h3><p>${L2(pa, pe)}</p></div>`).join('');

/* ---------- Journey ---------- */
const track = $('#track'), jSec = $('#journey');
track.innerHTML = stages.map((s, i) => `<article class="stage" style="background:${s.c}"><div class="orb"></div><div class="num">${i + 1}</div>
 <div><div class="where">${s.w.map(w => `<span>${L2(...w)}</span>`).join('')}</div><h3>${L2(s.ar, s.en)}</h3></div>
 <ul>${s.li.map(l => `<li>${L2(...l)}</li>`).join('')}</ul></article>`).join('') +
  `<article class="stage end"><img src="assets/img/mark.png" style="width:90px" alt=""><h3>${L2('ثم تستمر الرعاية', 'And care continues')}</h3><p style="font-size:19px;line-height:1.7;max-width:400px;opacity:.85">${L2('الرحلة دائرة وليست خطًا مستقيمًا: تعود الرعاية إلى الكشف والمتابعة في أقرب مرفق كلما احتاج المريض.', 'The journey is a loop, not a straight line: care returns to screening and follow-up at the nearest facility whenever the patient needs it.')}</p></article>`;
$('#rail').innerHTML = stages.map((s, i) => (i ? `<div class="seg"><i></i></div>` : '') + `<button type="button" class="node" data-i="${i}" data-c="${s.c}" aria-label="${i + 1}">${i + 1}</button>`).join('');
$('#rail').addEventListener('click', e => {
  const n = e.target.closest('.node'); if (!n) return;
  const dist = jSec.offsetHeight - innerHeight, p = (+n.dataset.i + .15) / (stages.length - 1 + .6);
  scrollTo({ top: jSec.offsetTop + p * dist, behavior: 'smooth' });
});
function sizeJourney() { if (!innerHeight || !track.scrollWidth) return; const t = Math.round(Math.max(innerHeight * 2, track.scrollWidth - innerWidth + innerHeight * 1.2)); if (Math.abs(t - parseFloat(jSec.style.height || 0)) > 2) jSec.style.height = t + 'px'; }
if (window.ResizeObserver) new ResizeObserver(() => { sizeJourney(); onScroll(); }).observe(track);
addEventListener('load', () => { sizeJourney(); onScroll(); });
document.fonts && document.fonts.ready.then(() => { sizeJourney(); onScroll(); });

/* ---------- Service explorer ---------- */
const SETTINGS = { phc: ['المراكز الصحية', 'Health centres'], clinic: ['العيادات التخصصية', 'Specialist clinics'], hosp: ['المستشفى', 'Hospital'] };
const services = [
  { c: C.green, img: 'svc-phc', set: ['phc'], ar: 'عيادات التغذية في الرعاية الصحية الأولية', en: 'Primary health care nutrition clinics', dar: 'تقييم تغذوي واستشارة ومتابعة قريبًا من مجتمع المريض.', den: 'Nutrition assessment, counselling and follow-up close to patients’ communities.',
    ex: [['الرغبة في نظام غذائي صحي أو التحكم بالوزن', 'Wanting a healthier diet or help with weight'], ['السكري أو ارتفاع ضغط الدم أو الكوليسترول', 'Diabetes, high blood pressure or high cholesterol'], ['فقر الدم أو مخاوف حول نمو الطفل', 'Anaemia or worries about a child’s growth']],
    how: ['اسأل طبيبك أو الممرض في المركز الصحي عن موعد مع أخصائي التغذية.', 'Ask your doctor or nurse at the health centre about an appointment with the dietitian.'] },
  { c: C.teal, img: 'svc-inpatient', set: ['hosp'], ar: 'الرعاية التغذوية للمرضى المنومين', en: 'Hospital inpatient nutrition care', dar: 'رعاية تغذوية فردية أثناء التنويم، تشمل التقييم والعلاج والمراقبة.', den: 'Individual nutrition care during admission, including assessment, treatment and monitoring.',
    ex: [['المرضى المعرّضون لسوء التغذية أثناء التنويم', 'Patients at risk of malnutrition during admission'], ['من يحتاج نظامًا غذائيًا علاجيًا خاصًا', 'Anyone who needs a special therapeutic diet'], ['من لا يستطيع تناول ما يكفي من الطعام', 'Patients who cannot eat enough']],
    how: ['يُجرى الكشف التغذوي عند التنويم، ويحيل الفريق الطبي المريض إلى أخصائي التغذية عند الحاجة.', 'Nutrition screening happens on admission, and the medical team refers patients to the dietitian when needed.'] },
  { c: C.sky, img: 'svc-specialist', set: ['clinic'], ar: 'عيادات التغذية التخصصية', en: 'Specialist nutrition clinics', dar: 'رعاية تغذوية لحالات السكري والسمنة والحمل والأطفال وأمراض الكلى.', den: 'Nutrition care for diabetes, obesity, pregnancy, children and kidney conditions.',
    ex: [['السكري وسكري الحمل', 'Diabetes and gestational diabetes'], ['السمنة والتحكم بالوزن', 'Obesity and weight management'], ['تغذية الحمل والرضاعة', 'Nutrition in pregnancy and breastfeeding'], ['نمو الأطفال وتغذيتهم', 'Children’s growth and nutrition'], ['أمراض الكلى والغسيل الكلوي', 'Kidney disease and dialysis']],
    how: ['بإحالة من الطبيب أو المركز الصحي.', 'By referral from your doctor or health centre.'] },
  { c: C.coral, img: 'svc-support', set: ['hosp'], ar: 'المكملات الغذائية الفموية والتغذية الأنبوبية', en: 'Oral supplements and tube feeding', dar: 'تقييم الدعم التغذوي والتخطيط له عندما لا يكفي الطعام المعتاد لتلبية احتياجات المريض.', den: 'Assessment and planning of nutrition support when usual food intake does not meet a patient’s needs.',
    ex: [['ضعف الشهية أو صعوبة البلع', 'Poor appetite or difficulty swallowing'], ['فقدان الوزن غير المقصود', 'Unplanned weight loss'], ['عدم القدرة على الأكل بالفم بشكل كافٍ', 'Being unable to eat enough by mouth']],
    how: ['يقيّم أخصائي التغذية الاحتياج ويضع الخطة بالتنسيق مع الفريق الطبي. لا تبدأ المكملات الطبية دون استشارة الفريق الصحي.', 'The dietitian assesses needs and plans support with the medical team. Do not start medical supplements without advice from your care team.'] },
  { c: C.saffron, fg: C.deep, img: 'svc-catering', set: ['hosp'], ar: 'التموين الغذائي وسلامة الأغذية', en: 'Food catering and food safety', dar: 'تنسيق وجبات المستشفى المناسبة، ودعم جودة الغذاء وسلامته.', den: 'Coordinating appropriate hospital meals and supporting food quality and safety.',
    ex: [['وجبات المرضى المنومين اليومية', 'Daily meals for inpatients'], ['الوجبات العلاجية، مثل الوجبات قليلة الملح أو المناسبة لمرضى السكري', 'Therapeutic meals, such as low-salt or diabetes-friendly meals'], ['جودة الطعام وسلامته من المطبخ إلى سرير المريض', 'Food quality and safety from the kitchen to the bedside']],
    how: ['جزء من رعاية كل مريض منوم.', 'Part of the care of every inpatient.'] },
  { c: C.berry, img: 'svc-education', set: ['phc', 'clinic', 'hosp'], ar: 'التثقيف والتوعية التغذوية', en: 'Nutrition education and awareness', dar: 'إرشادات عملية تساعد الناس على فهم التغذية واتخاذ قرارات واعية.', den: 'Practical guidance that helps people understand nutrition and make informed choices.',
    ex: [['جلسات توعوية فردية وجماعية', 'Individual and group education sessions'], ['فعاليات في المجتمع والمدارس', 'Community and school events'], ['مبادرة «الوعي التغذوي»', 'The Nutrition Awareness initiative']],
    how: ['تابع فعاليات المبادرة، واسأل أخصائي التغذية في أي زيارة.', 'Follow the initiative’s events, and ask the dietitian at any visit.'] },
  { c: C.plum, img: 'svc-discharge', set: ['hosp', 'phc'], ar: 'التخطيط للخروج واستمرارية الرعاية', en: 'Discharge planning and continued care', dar: 'إرشادات تغذوية قبل الخروج، ومتابعة في العيادة أو المركز الصحي المناسب.', den: 'Nutrition guidance before discharge and follow-up through the appropriate clinic or health centre.',
    ex: [['إرشادات غذائية مكتوبة قبل الخروج', 'Written nutrition guidance before discharge'], ['تدريب الأسرة على التغذية المنزلية عند الحاجة', 'Family training for feeding at home when needed'], ['موعد متابعة في العيادة أو المركز الصحي المناسب', 'A follow-up at the appropriate clinic or health centre']],
    how: ['قبل الخروج، اسأل الفريق عن موعد متابعتك التغذوية.', 'Before you go home, ask the team about your nutrition follow-up.'] },
];
let svcFilter = 'all';
function renderSvcFilters() {
  const opts = [['all', 'كل الخدمات', 'All services'], ...Object.entries(SETTINGS).map(([k, [a, e]]) => [k, a, e])];
  $('#svcFilters').innerHTML = opts.map(([k, a, e]) => `<button type="button" class="fchip ${svcFilter === k ? 'on' : ''}" data-f="${k}" aria-pressed="${svcFilter === k}">${L2(a, e)}</button>`).join('');
}
$('#svcFilters').onclick = e => { const b = e.target.closest('.fchip'); if (!b) return; svcFilter = b.dataset.f; renderSvcFilters(); $$('.svc').forEach(el => el.classList.toggle('hide', svcFilter !== 'all' && !services[el.dataset.i].set.includes(svcFilter))); };
renderSvcFilters();
const img = s => `assets/img/${s}.jpg`;
$('#svc').innerHTML = services.map((s, i) => `<button type="button" class="svc reveal" data-i="${i}" style="background:${s.c};color:${s.fg || '#fff'};transition-delay:${(i % 3) * 80}ms;justify-content:flex-start">
  <span class="blob"></span><span class="ph"><img src="${img(s.img)}" alt="" loading="lazy" onerror="this.parentNode.style.display='none'"></span>
  <span class="k">0${i + 1}</span><span style="display:block"><h3>${L2(s.ar, s.en)}</h3><p style="margin-top:8px">${L2(s.dar, s.den)}</p><span class="more">${L2('اعرف المزيد', 'Learn more')} <span aria-hidden="true">+</span></span></span></button>`).join('');
const sheet = $('#sheet');
$('#svc').onclick = e => {
  const b = e.target.closest('.svc'); if (!b) return; const s = services[b.dataset.i];
  sheet.innerHTML = `<div class="top" style="background:${s.c};color:${s.fg || '#fff'}"><img src="${img(s.img)}" alt="" onerror="this.remove()"><h3 id="sheetTitle">${L2(s.ar, s.en)}</h3><button type="button" class="x" aria-label="إغلاق" style="color:${s.fg || '#fff'}">×</button></div>
   <div class="body"><p>${L2(s.dar, s.den)}</p>
   <div class="lbl">${L2('أين تُقدَّم', 'Where')}</div><div class="tags">${s.set.map(k => `<span>${L2(...SETTINGS[k])}</span>`).join('')}</div>
   <div class="lbl">${L2('أمثلة', 'Examples')}</div><ul>${s.ex.map(x => `<li>${L2(...x)}</li>`).join('')}</ul>
   <div class="lbl">${L2('كيف تصل إليها', 'How to access it')}</div><p>${L2(...s.how)}</p></div>`;
  sheet.querySelector('.x').onclick = () => sheet.close();
  sheet.showModal();
};
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

/* ---------- Specialist clinics ---------- */
const clinics = [
  [C.coral, 'عيادة السكري', 'Diabetes clinic', 'حساب الكربوهيدرات وضبط السكر والوقاية من المضاعفات.', 'Carb counting, glucose control and preventing complications.'],
  [C.sky, 'عيادة السمنة', 'Obesity clinic', 'خطة لإنقاص الوزن بأمان ومتابعة السلوك الغذائي.', 'Safe weight-loss plans and eating-behaviour follow-up.', ['مجمع صلالة الصحي · الأحد والأربعاء', 'Salalah Health Complex · Sun & Wed']],
  [C.berry, 'عيادة النساء والحوامل', 'Women & pregnancy clinic', 'تغذية الحمل وسكري الحمل وفقر الدم والرضاعة.', 'Pregnancy nutrition, gestational diabetes, anaemia and breastfeeding.'],
  [C.saffron, 'عيادة الأطفال', 'Children’s clinic', 'متابعة النمو وسوء التغذية والحساسية الغذائية.', 'Growth monitoring, malnutrition and food allergy.'],
  [C.teal, 'عيادة الكلى', 'Kidney clinic', 'البروتين والبوتاسيوم والفوسفور والسوائل لمرضى الكلى والغسيل.', 'Protein, potassium, phosphorus and fluids for kidney disease and dialysis.'],
];
$('#clinicRow').innerHTML = clinics.map(([c, a, e, pa, pe, loc], i) => `<div class="clinic reveal" style="background:${c};${c === C.saffron ? 'color:' + C.deep : ''};transition-delay:${i * 90}ms"><span class="rings"></span><div class="ix">0${i + 1}</div><div><h3>${L2(a, e)}</h3><p>${L2(pa, pe)}</p>${loc ? `<span class="loc">${L2(...loc)}</span>` : ''}</div></div>`).join('');
$$('.clinic').forEach(el => {
  el.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg) translateZ(10px)`; });
  el.addEventListener('pointerleave', () => el.style.transform = '');
});

/* ---------- Map ---------- */
const TYPES = { hub: { c: C.coral, ar: 'المستشفى المرجعي', en: 'Referral hospital' }, cx: { c: C.sky, ar: 'مجمع صحي / عيادات تخصصية', en: 'Health complex / polyclinic' }, hosp: { c: C.saffron, ar: 'مستشفى ولاية', en: 'Wilayat hospital' }, phc: { c: C.lime, ar: 'رعاية صحية أولية', en: 'Primary health care' } };
const ALL = [0, 1, 2, 3, 4];
const F = [
  { id: 'sqh', t: 'hub', ll: [17.0125, 54.0670], ar: 'مستشفى السلطان قابوس', en: 'Sultan Qaboos Hospital', d: [0, 1, 2, 3, 4, 5, 6], s: [['المرضى المنومين', 'Inpatients'], ['المكملات والتغذية الأنبوبية', 'Supplements & tube feeding'], ['التخطيط للخروج', 'Discharge planning']] },
  { id: 'shc', t: 'cx', ll: [17.0185, 54.0905], ar: 'مجمع صلالة الصحي', en: 'Salalah Health Complex', d: [0, 3], s: [['عيادة السمنة', 'Obesity clinic']] },
  { id: 'pa', t: 'cx', ll: [17.0225, 54.0760], ar: 'مجمع العيادات التخصصية أ', en: 'Specialty Polyclinic A', d: [1, 2, 4], s: [['عيادات التغذية التخصصية', 'Specialist nutrition clinics']] },
  { id: 'pb', t: 'cx', ll: [17.0060, 54.0985], ar: 'مجمع العيادات التخصصية ب', en: 'Specialty Polyclinic B', d: [0, 3], s: [['عيادات التغذية التخصصية', 'Specialist nutrition clinics']] },
  { id: 'wsl', t: 'phc', ll: [17.0050, 54.0420], ar: 'مركز صلالة الغربية الصحي', en: 'West Salalah Health Centre', d: ALL, s: [['عيادة التغذية · دوام رسمي', 'Nutrition clinic · official hours']], cov: ['awq', 'nsl'] },
  { id: 'dhz', t: 'phc', ll: [17.0215, 54.1420], ar: 'مركز الدهاريز الصحي', en: 'Al Dahariz Health Centre', d: ALL, s: [['عيادة التغذية · دوام رسمي', 'Nutrition clinic · official hours']], cov: ['sad'] },
  { id: 'awq', t: 'sub', ll: [17.0270, 54.0230], ar: 'مركز عوقد الصحي', en: 'Awqad Health Centre', by: 'wsl' },
  { id: 'nsl', t: 'sub', ll: [17.0420, 54.1000], ar: 'مركز صلالة الجديدة الصحي', en: 'New Salalah Health Centre', by: 'wsl' },
  { id: 'sad', t: 'sub', ll: [17.0500, 54.1320], ar: 'مركز السعادة الصحي', en: 'Al Saada Health Centre', by: 'dhz' },
  { id: 'taq', t: 'hosp', ll: [17.0395, 54.3985], ar: 'مستشفى طاقة', en: 'Taqah Hospital', d: null, s: [['عيادة التغذية', 'Nutrition clinic']] },
  { id: 'haq', t: 'hosp', ll: [17.1520, 54.3900], ar: 'مستشفى مدينة الحق', en: 'Madinat Al Haq Hospital', d: [0, 1], s: [['عيادة التغذية', 'Nutrition clinic'], ['خدمة غسيل الكلى', 'Dialysis service']] },
  { id: 'mrb', t: 'hosp', ll: [16.9935, 54.6930], ar: 'مستشفى مرباط', en: 'Mirbat Hospital', d: [0, 1, 4], s: [['عيادة التغذية', 'Nutrition clinic']] },
];
const byId = Object.fromEntries(F.map(f => [f.id, f]));
let map, markers = {}, filter = 'all', active = null;
const DAYS = [['ح', 'Su'], ['ن', 'Mo'], ['ث', 'Tu'], ['ر', 'We'], ['خ', 'Th'], ['ج', 'Fr'], ['س', 'Sa']];
function icon(f, act) {
  const t = f.t === 'sub' ? TYPES.phc : TYPES[f.t]; const cls = f.t === 'hub' ? 'hub' : f.t === 'sub' ? 'sm' : ''; const sz = f.t === 'hub' ? 54 : f.t === 'sub' ? 16 : 28;
  return L.divIcon({ className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2], html: `<div class="pin-ic ${cls} ${act ? 'act' : ''}"><span class="p" style="background:${t.c}"></span><span class="c" style="background:${t.c}">${f.t === 'hub' ? '<img src="assets/img/mark-white.png" style="width:20px" alt="">' : ''}</span></div>` });
}
function initMap() {
  if (!window.L) return;
  map = L.map('map', { zoomControl: false, scrollWheelZoom: false, tap: true }).setView([17.05, 54.3], 10);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const goOffline = () => { $('#mapbox').classList.add('offline'); if (tiles && map.hasLayer(tiles)) map.removeLayer(tiles); };
  let tiles = null, tileErrors = 0;
  if (navigator.onLine === false) goOffline();
  else {
    tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 18 }).addTo(map);
    tiles.on('tileerror', () => { if (++tileErrors > 3) goOffline(); });
  }
  const hub = byId.sqh.ll;
  F.forEach(f => {
    if (f.id !== 'sqh') {
      const from = f.t === 'sub' ? byId[f.by].ll : hub;
      const mid = [(f.ll[0] + from[0]) / 2 + (f.t === 'sub' ? 0 : .03), (f.ll[1] + from[1]) / 2];
      L.polyline([f.ll, mid, from], { color: f.t === 'sub' ? '#fff' : TYPES[f.t].c, weight: f.t === 'sub' ? 1.5 : 2.5, opacity: .9, className: 'flow' + (f.t === 'sub' ? ' thin' : ''), smoothFactor: 1 }).addTo(map);
    }
    const m = L.marker(f.ll, { icon: icon(f), keyboard: true, title: f.ar }).addTo(map).on('click', () => select(f.id));
    if (f.t !== 'sub') m.bindTooltip(isEn() ? f.en : f.ar, { permanent: f.t === 'hub' || f.t === 'hosp', direction: 'top', offset: [0, -14], className: 'plabel' });
    markers[f.id] = m;
  });
  setTimeout(() => { map.invalidateSize(); fitAll(); }, 450);
}
window.refreshMapLabels = () => { if (!map) return; F.forEach(f => { const t = markers[f.id].getTooltip(); if (t) t.setContent(isEn() ? f.en : f.ar); }); };
function fitAll() { map.flyToBounds(L.latLngBounds(F.map(f => f.ll)).pad(.12), { duration: 1.2 }); }
function renderFilters() {
  const opts = [['all', 'الكل', 'All', null], ['hub', TYPES.hub.ar, TYPES.hub.en, TYPES.hub.c], ['cx', 'المجمعات', 'Complexes', TYPES.cx.c], ['hosp', 'المستشفيات', 'Hospitals', TYPES.hosp.c], ['phc', 'الرعاية الأولية', 'Primary care', TYPES.phc.c]];
  $('#filters').innerHTML = opts.map(([k, a, e, c]) => `<button type="button" class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${c ? `<i style="background:${c}"></i>` : ''}${L2(a, e)}</button>`).join('');
  $('#filters').onclick = ev => { const b = ev.target.closest('.chip'); if (!b) return; filter = b.dataset.f; renderFilters(); renderList(); applyFilter(); };
}
const vis = f => filter === 'all' || f.t === filter || (filter === 'phc' && f.t === 'sub');
function renderList() {
  $('#flist').innerHTML = F.filter(vis).map(f => { const t = f.t === 'sub' ? TYPES.phc : TYPES[f.t]; return `<button type="button" class="fitem ${f.t === 'sub' ? 'sub' : ''} ${active === f.id ? 'on' : ''}" data-id="${f.id}"><span class="sw" style="background:${t.c}"></span><span><span class="nm" style="display:block">${L2(f.ar, f.en)}</span>${f.t !== 'sub' ? `<span class="tp" style="display:block">${L2(t.ar, t.en)}</span>` : ''}</span></button>`; }).join('');
}
$('#flist').onclick = e => { const b = e.target.closest('.fitem'); if (b && map) select(b.dataset.id); };
function applyFilter() { F.forEach(f => { const el = markers[f.id].getElement(); if (el) el.style.opacity = vis(f) ? 1 : .15; }); const sel = F.filter(vis); if (sel.length > 1) map.flyToBounds(L.latLngBounds(sel.map(f => f.ll)).pad(.25), { duration: 1 }); else if (sel[0]) map.flyTo(sel[0].ll, 13); }
function select(id) {
  if (active && markers[active]) markers[active].setIcon(icon(byId[active]));
  active = id; const f = byId[id]; markers[id].setIcon(icon(f, true));
  map.flyTo(f.ll, f.t === 'sub' ? 14 : 13, { duration: 1.1 }); renderList();
  const host = f.t === 'sub' ? byId[f.by] : f, t = f.t === 'sub' ? TYPES.phc : TYPES[f.t];
  const days = host.d ? `<div class="days">${DAYS.map((d, i) => `<span class="${host.d.includes(i) ? 'on' : ''}" style="${host.d.includes(i) ? 'background:' + C.teal : ''}">${L2(...d)}</span>`).join('')}</div>` : `<p style="font-size:14px;color:#6B7F78">${L2('يرجى التواصل مع المستشفى لمعرفة الأيام', 'Please contact the hospital for clinic days')}</p>`;
  $('#card').innerHTML = `<button type="button" class="x" aria-label="إغلاق" onclick="closeCard()">×</button><span class="tp" style="background:${t.c};color:${f.t === 'phc' || f.t === 'sub' || f.t === 'hosp' ? C.deep : '#fff'}">${L2(t.ar, t.en)}</span><h3>${L2(f.ar, f.en)}</h3>
   ${f.t === 'sub' ? `<p style="margin-top:10px;font-size:15px;line-height:1.6">${L2('خدمات التغذية لهذا المركز تُقدَّم في ' + host.ar, 'Nutrition services for this centre are provided at ' + host.en)}</p>` : ''}
   <div class="lbl">${L2(f.id === 'sqh' ? 'الخدمة' : 'أيام العيادة', f.id === 'sqh' ? 'Service' : 'Clinic days')}</div>${f.id === 'sqh' ? `<p style="font-size:15px">${L2('خدمة يومية للمرضى المنومين', 'Daily inpatient service')}</p>` : days}
   <div class="lbl">${L2('الخدمات', 'Services')}</div><div class="tags">${host.s.map(s => `<span>${L2(...s)}</span>`).join('')}</div>
   ${host.cov ? `<div class="lbl">${L2('يغطي أيضًا', 'Also covers')}</div><div class="tags">${host.cov.map(c => `<span>${L2(byId[c].ar, byId[c].en)}</span>`).join('')}</div>` : ''}`;
  $('#card').classList.add('show');
}
window.closeCard = () => { $('#card').classList.remove('show'); if (active) markers[active].setIcon(icon(byId[active])); active = null; renderList(); if (map) fitAll(); };

/* ---------- Quiz: صحّح وعيك التغذوي ---------- */
const QUIZ = [
  { a: false, ar: 'التمر سكر طبيعي، لذلك يمكن لمريض السكري أن يأكل منه بلا حد.', en: 'Dates are natural sugar, so people with diabetes can eat as many as they like.',
    xar: 'التمر مفيد وغني بالألياف والمعادن، لكنه يرفع سكر الدم مثل باقي النشويات والسكريات. يمكن لمريض السكري تناوله بكمية محددة ضمن خطته الغذائية يتفق عليها مع أخصائي التغذية.', xen: 'Dates are nutritious and rich in fibre and minerals, but they raise blood sugar like other carbohydrates. People with diabetes can include a set portion within their meal plan, agreed with their dietitian.' },
  { a: false, ar: 'شرب الشاي مع الوجبة يساعد الجسم على امتصاص الحديد.', en: 'Drinking tea with meals helps your body absorb iron.',
    xar: 'الشاي يقلل امتصاص الحديد من الطعام، خاصة من البقول والحبوب. الأفضل شربه بعد الوجبة بساعة على الأقل، وتناول مصدر لفيتامين C مثل البرتقال مع الوجبة لزيادة الامتصاص.', xen: 'Tea reduces iron absorption from food, especially from pulses and grains. Drink it at least an hour after meals, and have a vitamin C source such as an orange with the meal to boost absorption.' },
  { a: false, ar: 'كوب عصير الفاكهة الطازج يعادل تناول الفاكهة الكاملة.', en: 'A glass of fresh fruit juice is the same as eating whole fruit.',
    xar: 'الفاكهة الكاملة تحتفظ بأليافها وتمنح شعورًا أطول بالشبع، أما العصير فيُركّز السكر ويُشرب بسرعة. اختر الفاكهة الكاملة في أغلب الأوقات.', xen: 'Whole fruit keeps its fibre and keeps you full for longer; juice concentrates the sugar and is drunk quickly. Choose whole fruit most of the time.' },
  { a: true, ar: 'يُنصح البالغون بألا يزيد الملح عن ٥ غرامات يوميًا، أي ملعقة صغيرة تقريبًا.', en: 'Adults should have no more than 5 g of salt a day, about one teaspoon.',
    xar: 'توصي منظمة الصحة العالمية بأقل من ٥ غرامات ملح يوميًا للبالغين. معظم الملح يأتي من الأطعمة المصنعة والخبز والمخللات، فاقرأ الملصق الغذائي وقلّل الملح تدريجيًا.', xen: 'The WHO recommends less than 5 g of salt a day for adults. Most salt comes from processed foods, bread and pickles, so read food labels and cut down gradually.' },
  { a: false, ar: 'الأكل بعد الساعة الثامنة مساءً هو سبب زيادة الوزن.', en: 'Eating after 8 p.m. is what causes weight gain.',
    xar: 'زيادة الوزن ترتبط بمجموع ما نأكله خلال اليوم مقارنة بما نحرقه، وليس بالساعة وحدها. لكن الوجبات الخفيفة الليلية عالية السعرات قد تضيف الكثير دون أن نشعر.', xen: 'Weight gain depends on how much we eat across the whole day compared with what we use, not on the clock alone. Late-night high-calorie snacks can still add up without us noticing.' },
  { a: true, ar: 'حليب الأم وحده يكفي الرضيع في الأشهر الستة الأولى.', en: 'Breast milk alone is enough for a baby in the first six months.',
    xar: 'توصي منظمة الصحة العالمية بالرضاعة الطبيعية المطلقة في الأشهر الستة الأولى، ثم إدخال الأطعمة التكميلية مع الاستمرار في الرضاعة حتى عمر سنتين أو أكثر.', xen: 'The WHO recommends exclusive breastfeeding for the first six months, then adding complementary foods while continuing to breastfeed up to two years or beyond.' },
  { a: false, ar: 'النظام الغذائي الخالي من الجلوتين صحي أكثر لكل الناس.', en: 'A gluten-free diet is healthier for everyone.',
    xar: 'النظام الخالي من الجلوتين ضروري لمرضى السيلياك ومن لديهم حساسية من القمح، لكنه ليس أفضل تلقائيًا لغيرهم، وقد يقل فيه الألياف إذا لم يُخطَّط جيدًا.', xen: 'A gluten-free diet is essential for people with coeliac disease or wheat allergy, but it is not automatically healthier for others and can be low in fibre if not well planned.' },
  { a: true, ar: 'الماء هو أفضل مشروب لإرواء العطش.', en: 'Water is the best drink to quench your thirst.',
    xar: 'الماء يروي العطش دون سعرات أو سكر. قلّل المشروبات الغازية والعصائر المحلّاة، وزد شرب الماء في الأجواء الحارة وعند النشاط البدني.', xen: 'Water hydrates you with no calories or sugar. Cut down on fizzy drinks and sweetened juices, and drink more water in hot weather and when you are active.' },
];
let qi = 0, qres = [];
function renderQuiz() {
  const card = $('#quizCard');
  const bar = `<div class="qbar">${QUIZ.map((_, i) => `<i class="${qres[i] === true ? 'ok' : qres[i] === false ? 'no' : i === qi ? 'cur' : ''}"></i>`).join('')}</div>`;
  if (qi >= QUIZ.length) {
    const n = qres.filter(Boolean).length;
    const msg = n === QUIZ.length ? ['ممتاز! وعيك التغذوي في أفضل حالاته.', 'Excellent! Your nutrition knowledge is spot on.'] : n >= 5 ? ['أحسنت! معلوماتك جيدة، وتعلّمت اليوم شيئًا جديدًا.', 'Well done! You know a lot, and learned something new today.'] : ['بداية جيدة! شارك ما تعلّمته مع أسرتك.', 'A good start! Share what you learned with your family.'];
    card.innerHTML = bar + `<div class="qdone"><div class="big">${n}/${QUIZ.length}</div><p class="qtext" style="font-size:clamp(20px,2.4vw,28px)">${L2(...msg)}</p><button type="button" class="qnext show" id="qagain">${L2('أعد الاختبار', 'Try again')}</button></div>`;
    $('#qagain').onclick = () => { qi = 0; qres = []; renderQuiz(); };
    return;
  }
  const q = QUIZ[qi];
  card.innerHTML = bar + `<div class="qnum">${qi + 1} / ${QUIZ.length}</div><p class="qtext">${L2(q.ar, q.en)}</p>
    <div class="qbtns"><button type="button" class="qbtn" data-v="1">${L2('حقيقة', 'Fact')}</button><button type="button" class="qbtn" data-v="0">${L2('خرافة', 'Myth')}</button></div>
    <div class="qfb" id="qfb"></div><button type="button" class="qnext" id="qnext">${L2(qi < QUIZ.length - 1 ? 'السؤال التالي' : 'النتيجة', qi < QUIZ.length - 1 ? 'Next question' : 'See my score')}</button>`;
  card.querySelector('.qbtns').onclick = e => {
    const b = e.target.closest('.qbtn'); if (!b || qres[qi] !== undefined) return;
    const right = (b.dataset.v === '1') === q.a; qres[qi] = right;
    card.querySelectorAll('.qbtn').forEach(x => { x.disabled = true; x.classList.toggle('picked', x === b); });
    const fb = $('#qfb'); fb.className = 'qfb show ' + (right ? 'ok' : 'no');
    fb.innerHTML = `<b>${right ? L2('إجابة صحيحة', 'Correct') : L2('ليس تمامًا', 'Not quite')} · ${q.a ? L2('حقيقة', 'Fact') : L2('خرافة', 'Myth')}</b>${L2(q.xar, q.xen)}`;
    card.querySelectorAll('.qbar i')[qi].className = right ? 'ok' : 'no';
    $('#qnext').classList.add('show'); $('#qnext').focus({ preventScroll: true });
  };
  $('#qnext').onclick = () => { qi++; renderQuiz(); };
}
renderQuiz();

/* ---------- Build your healthy plate ---------- */
const ZONES = {
  veg: { ar: 'خضار', en: 'Vegetables', mid: 67.5, r: 27 },
  fruit: { ar: 'فواكه', en: 'Fruit', mid: 157.5, r: 32 },
  grain: { ar: 'حبوب كاملة', en: 'Whole grains', mid: 225, r: 27 },
  protein: { ar: 'بروتين', en: 'Protein', mid: 315, r: 27 },
};
const FOODS = [
  ['veg', 'سلطة خضراء', 'Green salad', '🥗'], ['veg', 'خيار', 'Cucumber', '🥒'], ['veg', 'جزر', 'Carrots', '🥕'], ['veg', 'بروكلي', 'Broccoli', '🥦'], ['veg', 'طماطم', 'Tomatoes', '🍅'],
  ['fruit', 'موز', 'Banana', '🍌'], ['fruit', 'مانجو', 'Mango', '🥭'], ['fruit', 'برتقال', 'Orange', '🍊'], ['fruit', 'بطيخ', 'Watermelon', '🍉'],
  ['grain', 'أرز بني', 'Brown rice', '🍚'], ['grain', 'خبز أسمر', 'Wholemeal bread', '🍞'], ['grain', 'شوفان', 'Oats', '🥣'],
  ['protein', 'سمك', 'Fish', '🐟'], ['protein', 'دجاج مشوي', 'Grilled chicken', '🍗'], ['protein', 'عدس وبقول', 'Lentils & beans', '🫘'], ['protein', 'بيض', 'Eggs', '🥚'],
  ['drink', 'ماء', 'Water', '💧'], ['drink', 'لبن قليل الدسم', 'Low-fat laban', '🥛'],
  ['treat', 'مشروب غازي', 'Fizzy drink', '🥤'], ['treat', 'بطاطس مقلية', 'Fries', '🍟'], ['treat', 'حلويات', 'Sweets', '🍰'],
].map(([z, ar, en, e], i) => ({ i, z, ar, en, e }));
const GROUPS = [['veg', 'الخضار', 'Vegetables'], ['fruit', 'الفواكه', 'Fruit'], ['grain', 'الحبوب الكاملة', 'Whole grains'], ['protein', 'البروتين', 'Protein'], ['drink', 'المشروبات', 'Drinks'], ['treat', 'أحيانًا فقط', 'Only sometimes']];
const chosen = new Set();
$('#plateEl').innerHTML = Object.entries(ZONES).map(([k, z]) => { const a = z.mid * Math.PI / 180; return `<div class="zone" style="left:${50 + z.r * Math.sin(a)}%;top:${50 - z.r * Math.cos(a)}%"><span class="zl">${L2(z.ar, z.en)}</span><span class="zi" data-z="${k}"></span></div>`; }).join('') +
  `<div class="zone" style="left:50%;top:50%;width:auto"><span class="zi" data-z="treat"></span></div>`;
$('#foods').innerHTML = GROUPS.map(([g, a, e]) => `<h3>${L2(a, e)}</h3><div class="frow">${FOODS.filter(f => f.z === g).map(f => `<button type="button" class="food ${g === 'treat' ? 'treat' : ''}" data-i="${f.i}" aria-pressed="false"><span class="e" aria-hidden="true">${f.e}</span>${L2(f.ar, f.en)}</button>`).join('')}</div>`).join('');
$('#foods').onclick = e => { const b = e.target.closest('.food'); if (!b) return; const i = +b.dataset.i; chosen.has(i) ? chosen.delete(i) : chosen.add(i); b.classList.toggle('sel', chosen.has(i)); b.setAttribute('aria-pressed', chosen.has(i)); renderPlate(); };
$('#plateReset').onclick = () => resetPlate();
function resetPlate() { chosen.clear(); $$('.food').forEach(b => { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); }); renderPlate(); }
function renderPlate() {
  const by = z => FOODS.filter(f => f.z === z && chosen.has(f.i));
  $$('#plateEl .zi').forEach(el => { el.innerHTML = by(el.dataset.z).map(f => `<span title="${f.ar}">${f.e}</span>`).join(''); });
  $('#cupItems').innerHTML = by('drink').map(f => f.e).join('');
  const n = Object.fromEntries(['veg', 'fruit', 'grain', 'protein', 'drink', 'treat'].map(z => [z, by(z).length]));
  if (!chosen.size) { $('#verdict').innerHTML = `<div class="score">${L2('ابدأ باختيار الأطعمة من القائمة', 'Start by picking foods from the list')}</div>`; return; }
  const fizzy = FOODS.find(f => f.e === '🥤'), hasFizzy = chosen.has(fizzy.i);
  const checks = [
    [n.veg >= 2, ['الخضار متنوعة، وتملأ أكبر جزء من الطبق.', 'Plenty of vegetables, filling the biggest part of the plate.'], n.veg === 1 ? ['أضف نوعًا آخر من الخضار، فهي أكبر جزء في الطبق الصحي.', 'Add another vegetable: they are the biggest part of a healthy plate.'] : ['أضف الخضار، فهي أكبر جزء في الطبق الصحي.', 'Add vegetables: they are the biggest part of a healthy plate.']],
    [n.fruit >= 1, ['أضفت الفاكهة، مصدرًا للفيتامينات والألياف.', 'Fruit added: a source of vitamins and fibre.'], ['أضف حصة من الفاكهة الكاملة.', 'Add a portion of whole fruit.']],
    [n.grain >= 1, ['الحبوب الكاملة تمنح طاقة وأليافًا.', 'Whole grains give energy and fibre.'], ['أضف حبوبًا كاملة مثل الأرز البني أو الخبز الأسمر.', 'Add a whole grain such as brown rice or wholemeal bread.']],
    [n.protein >= 1, ['البروتين يبني العضلات ويشعرك بالشبع.', 'Protein builds muscle and keeps you full.'], ['أضف بروتينًا مثل السمك أو العدس أو الدجاج.', 'Add a protein such as fish, lentils or chicken.']],
    [n.drink >= 1 && !hasFizzy, ['اخترت مشروبًا صحيًا.', 'You chose a healthy drink.'], hasFizzy ? ['استبدل المشروب الغازي بالماء.', 'Swap the fizzy drink for water.'] : ['لا تنسَ الماء مع وجبتك.', 'Don’t forget water with your meal.']],
  ];
  let stars = checks.filter(c => c[0]).length;
  const extra = [];
  if (n.treat) { stars = Math.max(0, stars - 1); extra.push(['no', ['الأطعمة المقلية والحلويات والمشروبات الغازية أحيانًا فقط، وبكمية صغيرة.', 'Fried food, sweets and fizzy drinks are for sometimes only, in small amounts.']]); }
  if (n.grain + n.protein > n.veg + n.fruit && n.veg + n.fruit > 0) extra.push(['', ['اجعل الخضار والفواكه نصف الطبق.', 'Make vegetables and fruit half of the plate.']]);
  const head = stars === 5 && !n.treat ? ['طبق متوازن! أحسنت.', 'A balanced plate! Well done.'] : stars >= 3 ? ['قريب جدًا من الطبق المتوازن.', 'Very close to a balanced plate.'] : ['لنُكمل الطبق معًا.', 'Let’s complete the plate together.'];
  $('#verdict').innerHTML = `<div class="score"><span class="stars" aria-label="${stars}/5">${[0, 1, 2, 3, 4].map(i => `<i class="${i < stars ? 'on' : ''}"></i>`).join('')}</span>${L2(...head)}</div>
    <ul>${checks.map(([ok, good, bad]) => `<li class="${ok ? 'ok' : 'no'}">${L2(...(ok ? good : bad))}</li>`).join('')}${extra.map(([c, t]) => `<li class="${c}">${L2(...t)}</li>`).join('')}</ul>`;
}
renderPlate();

/* ---------- MUST demo ---------- */
const must = { bmi: 0, wl: 0, ad: 0 };
$$('.opts').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; g.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o === b)); must[g.dataset.q] = +b.dataset.v; renderMust(); }));
function renderMust() {
  const s = must.bmi + must.wl + must.ad, lv = s === 0 ? 0 : s === 1 ? 1 : 2;
  const R = [[C.lime, 'خطر منخفض', 'Low risk', 'رعاية روتينية وإعادة الكشف دوريًا', 'Routine care, repeat screening'], [C.saffron, 'خطر متوسط', 'Medium risk', 'مراقبة المدخول الغذائي وإحالة لأخصائي التغذية', 'Observe intake and refer to a dietitian'], [C.coral, 'خطر مرتفع', 'High risk', 'إحالة عاجلة لأخصائي التغذية وبدء العلاج', 'Urgent dietitian referral and treatment']][lv];
  $('#gscore').textContent = s; $('#grisk').innerHTML = L2(R[1], R[2]); $('#grisk').style.background = R[0]; $('#grisk').style.color = C.deep; $('#gact').innerHTML = L2(R[3], R[4]);
  const a = $('#garc'); a.style.stroke = R[0]; a.style.strokeDashoffset = 540 - 540 * Math.max(.06, s / 6);
}
function resetMust() { Object.keys(must).forEach(k => must[k] = 0); $$('.opts').forEach(g => g.querySelectorAll('.opt').forEach((o, i) => o.classList.toggle('sel', i === 0))); renderMust(); }

/* ---------- Future plans ---------- */
const futs = [
  [C.saffron, 'التغذية عن بُعد', 'Telenutrition', 'استشارات ومتابعة بالفيديو للمرضى في الولايات البعيدة وبعد الخروج من المستشفى.', 'Video consultations and follow-up for patients in remote wilayats and after discharge.'],
  [C.lime, 'برنامج التغذية المنزلية', 'Home nutrition support', 'متابعة مرضى التغذية الأنبوبية في المنزل بالتنسيق مع الرعاية الصحية الأولية.', 'Following up patients on home tube feeding in coordination with primary health care.'],
  [C.sky, 'منصة تثقيف رقمية', 'Digital education platform', 'محتوى تغذوي موثوق باللغتين يصل إليه المريض عبر رمز QR.', 'Trusted bilingual nutrition content that patients reach through a QR code.'],
  [C.coral, 'لوحة بيانات التغذية', 'Nutrition data dashboard', 'مؤشرات الكشف والإحالة والنتائج لكل مرفق في ظفار.', 'Screening, referral and outcome indicators for every facility in Dhofar.'],
];
$('#futList').innerHTML = futs.map(([c, a, e, pa, pe], i) => `<div class="fut reveal" style="transition-delay:${i * 90}ms"><div class="n" style="background:${c}">0${i + 1}</div><div><span class="soon">${L2('قيد التخطيط', 'In planning')}</span><h3>${L2(a, e)}</h3><p>${L2(pa, pe)}</p></div></div>`).join('');

/* ---------- Resources + QR ---------- */
function qrSvg(text) {
  if (!window.qrcode) return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
$('#qrMain').innerHTML = qrSvg(CONFIG.siteUrl);
$('#qrFloat').innerHTML = qrSvg(CONFIG.siteUrl);
$('#qrUrl').textContent = CONFIG.siteUrl.replace(/^https?:\/\//, '');
const resRow = r => {
  const urlAr = typeof r.url === 'object' ? r.url.ar : r.url, urlEn = typeof r.url === 'object' ? r.url.en : r.url;
  const inner = `<span class="ic" aria-hidden="true">${r.ic}</span><span><h4>${L2(r.ar, r.en)}</h4><p>${L2(r.dar, r.den)}</p></span>`;
  return r.url ? `<a class="res" target="_blank" rel="noopener" href="${urlAr}" data-ar="${urlAr}" data-en="${urlEn}">${inner}</a>` : `<div class="res">${inner}<span class="soon">${L2('قريبًا', 'Coming soon')}</span></div>`;
};
$('#resList').innerHTML = (HANDOUTS.length
  ? HANDOUTS.map(h => resRow({ ic: '📄', url: h.url, ar: h.ar, en: h.en, dar: 'مطوية معتمدة من قسم التغذية العلاجية', den: 'Approved handout from the Department of Clinical Nutrition' }))
  : [resRow({ ic: '📄', ar: 'مطويات القسم التثقيفية', en: 'Department education handouts', dar: 'ستُتاح هنا للتحميل بعد اعتمادها.', den: 'Will be available to download here once approved.' })]
).join('') + RESOURCES.map(resRow).join('');
$('#resList').addEventListener('click', e => { const a = e.target.closest('a.res'); if (a) a.href = isEn() ? a.dataset.en : a.dataset.ar; });
if (CONFIG.deptLogo) $('#deptLogo').innerHTML = `<img class="dept-logo" src="${CONFIG.deptLogo}" alt="قسم التغذية العلاجية">`;

/* ---------- Scroll engine ---------- */
const prog = $('#progress'), fbg = $('#fbg'), nodes = $$('#rail .node'), segs = $$('#rail .seg i'), navLinks = $$('nav.top .links a');
function onScroll() {
  sizeJourney();
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight; prog.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  const r = jSec.getBoundingClientRect(), dist = jSec.offsetHeight - innerHeight, p = Math.min(1, Math.max(0, -r.top / dist));
  const max = track.scrollWidth - innerWidth; track.style.transform = `translateX(${(isEn() ? -1 : 1) * p * max}px)`;
  const f = p * (stages.length - 1 + .6);
  nodes.forEach((n, i) => { const on = f >= i - .3; n.classList.toggle('on', on); n.style.background = on ? n.dataset.c : '#fff'; });
  segs.forEach((s, i) => s.style.transform = `scaleX(${Math.min(1, Math.max(0, f - i))})`);
  track.querySelectorAll('.stage').forEach((s, i) => { const d = f - i; s.style.transform = `rotateY(${Math.max(-18, Math.min(18, d * -12)) * (isEn() ? -1 : 1)}deg) scale(${1 - Math.min(.08, Math.abs(d) * .04)})`; });
  const fr = fbg.parentElement.getBoundingClientRect(); fbg.style.transform = `translateY(${fr.top * -.15}px) scale(1.05)`;
  navLinks.forEach(a => { const s = $(a.getAttribute('href')); const b = s.getBoundingClientRect(); a.classList.toggle('on', b.top < innerHeight * .4 && b.bottom > innerHeight * .4); });
}
addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
addEventListener('resize', () => { sizeJourney(); onScroll(); });

/* ---------- Reveal + counter + lazy map ---------- */
let counted = false;
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; e.target.classList.add('in');
  if (e.target.id === 'people' && !counted) { counted = true; let n = 0; const t = setInterval(() => { $('#count').textContent = ++n; if (n >= 21) clearInterval(t); }, 60); }
  if (e.target.classList.contains('mapbox') && !map) { initMap(); renderFilters(); renderList(); }
}), { threshold: .15 });
$$('.reveal,#people,.mapbox').forEach(el => io.observe(el));

/* ---------- Presentation mode (large screen) and kiosk reset (touchscreen) ---------- */
let presenting = false, pausedUntil = 0, lastT = 0, carry = 0, endHold = 0;
const pauseBtn = $('#__pause');
function setPresent(on) {
  presenting = on; document.body.classList.toggle('present', on);
  document.documentElement.style.scrollBehavior = on ? 'auto' : '';
  pausedUntil = 0; lastT = 0; updatePauseBtn();
  if (on) requestAnimationFrame(tick);
}
function updatePauseBtn() { pauseBtn.innerHTML = Date.now() < pausedUntil ? L2('▶ استئناف العرض', '▶ Resume') : L2('❚❚ إيقاف مؤقت', '❚❚ Pause'); }
pauseBtn.onclick = e => { e.stopPropagation(); pausedUntil = Date.now() < pausedUntil ? 0 : Date.now() + 10 * 60e3; updatePauseBtn(); };
function tick(t) {
  if (!presenting) return;
  const dt = lastT ? Math.min(100, t - lastT) : 0; lastT = t;
  if (Date.now() >= pausedUntil) {
    const bottom = document.documentElement.scrollHeight - innerHeight;
    if (scrollY >= bottom - 2) {
      if (!endHold) endHold = t;
      if (t - endHold > 6000) { endHold = 0; scrollTo(0, 0); pausedUntil = Date.now() + 4000; }
    } else {
      carry += CONFIG.presentSpeed * dt / 1000;
      if (carry >= 1) { const px = Math.floor(carry); carry -= px; scrollBy(0, px); }
    }
  }
  requestAnimationFrame(tick);
}
$('#presentBtn').onclick = () => setPresent(!presenting);
if (params.has('present')) setPresent(true);

const kiosk = params.has('kiosk') || params.has('present');
let idleTimer;
function resetAll() {
  if (sheet.open) sheet.close();
  if (active) closeCard();
  qi = 0; qres = []; renderQuiz(); resetPlate(); resetMust();
  svcFilter = 'all'; renderSvcFilters(); $$('.svc').forEach(el => el.classList.remove('hide'));
  if (isEn()) setLang(false);
  scrollTo(0, 0);
}
function activity() {
  if (presenting) { pausedUntil = Math.max(pausedUntil, Date.now() + 30e3); updatePauseBtn(); }
  if (!kiosk) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { resetAll(); if (params.has('present')) setPresent(true); }, CONFIG.idleResetSeconds * 1e3);
}
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, e => { if (e.target === pauseBtn || e.target.closest?.('#presentBtn')) return; activity(); }, { passive: true }));

renderMust(); sizeJourney(); onScroll();
