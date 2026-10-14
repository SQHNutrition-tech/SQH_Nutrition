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
                <span class="brand-mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></span>
                <span><strong>Nutrition Hub</strong><small>SQH · Clinical Nutrition</small></span>
            </a>
            <nav class="mainnav" aria-label="Main"></nav>
            <div class="who"><span id="me-name">Signing in…</span><button class="small" id="theme-btn" type="button">Theme</button></div>
        </div>`;
    document.body.prepend(header);
    $('#theme-btn').onclick = toggleTheme;

    const me = await api('/api/me');
    $('.mainnav').innerHTML = NAV
        .filter(n => !n.admin || me.me.role === 'admin')
        .map(n => `<a href="${n.href}" ${n.href === current ? 'aria-current="page"' : ''}>${n.label}</a>`).join('');
    $('#me-name').textContent = me.me.name;
    return me;
}

/** Display name for a member email. */
export function nameOf(members, email) {
    const m = members.find(x => x.email === email);
    return m ? m.name : (email || '—');
}
