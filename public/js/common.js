// Shared helpers for every page: API calls, escaping, toast, header, theme.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function api(path, body) {
    const opts = body === undefined
        ? { cache: 'no-store' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    let res;
    try {
        res = await fetch(path, opts);
    } catch {
        throw new Error('No connection. Check the network and try again.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `Request failed (${res.status}).`);
        err.status = res.status;
        throw err;
    }
    return data;
}

let toastTimer;
export function toast(msg) {
    let t = $('#toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.setAttribute('role', 'status');
        document.body.append(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

export const fmtDate = (s) => s ? new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Muscat', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function initTheme() {
    try {
        const saved = localStorage.getItem('cn_theme');
        if (saved) document.documentElement.dataset.theme = saved;
    } catch { /* storage unavailable */ }
}

export function toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('cn_theme', root.dataset.theme); } catch { /* ignore */ }
}

const NAV = [
    { href: '/', label: 'Home' },
    { href: '/followup.html', label: 'Follow-ups' },
    { href: '/tools.html', label: 'Calculators' },
    { href: '/admin.html', label: 'Admin', admin: true }
];

/** Renders the shared top bar and returns /api/me data. */
export async function initPage(current) {
    initTheme();
    const header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML = `
        <div class="wrap">
            <a class="brand" href="/">
                <img src="/img/mark.png" alt="" width="36" height="36">
                <span><strong>Nutrition Hub</strong><small>SQH · Clinical Nutrition</small></span>
            </a>
            <nav class="mainnav" aria-label="Main"></nav>
            <div class="who">
                <button class="icon-btn" id="theme-btn" type="button" aria-label="Switch light or dark mode" title="Light / dark">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
                </button>
                <span class="avatar" id="me-avatar" title="Signing in…">·</span>
            </div>
        </div>`;
    document.body.prepend(header);
    $('#theme-btn').onclick = toggleTheme;

    const me = await api('/api/me');
    $('.mainnav').innerHTML = NAV
        .filter(n => !n.admin || me.me.role === 'admin')
        .map(n => `<a href="${n.href}" ${n.href === current ? 'aria-current="page"' : ''}>${n.label}</a>`).join('');
    const avatar = $('#me-avatar');
    avatar.textContent = me.me.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    avatar.title = `${me.me.name} · ${me.me.email}`;
    return me;
}

/** Display name for a member email. */
export function nameOf(members, email) {
    const m = members.find(x => x.email === email);
    return m ? m.name : (email || '—');
}
