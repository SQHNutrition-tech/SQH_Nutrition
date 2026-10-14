// Phone directory list, shared by the home page (compact) and /directory.html (full).
import { esc } from './common.js';

const FAV_KEY = 'hub_fav_ext';
const CATEGORIES = ['Our department', 'Wards', 'Clinics', 'Support services', 'Other'];

function loadFavs() {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch { return new Set(); }
}

/**
 * @param {{ search: HTMLInputElement, box: HTMLElement, entries: object[], compact?: boolean }} opts
 * compact: with no search text, show only urgent and starred numbers (home page).
 */
export function mountDirectory({ search, box, entries, compact = false }) {
    const favs = loadFavs();

    const row = (e) => `<div class="dir-row">
        <button class="star" data-id="${e.id}" aria-pressed="${favs.has(e.id)}" aria-label="${favs.has(e.id) ? 'Unstar' : 'Star'} ${esc(e.name)}">${favs.has(e.id) ? '★' : '☆'}</button>
        <div class="nm">${esc(e.name)}${e.notes ? `<small>${esc(e.notes)}</small>` : ''}</div>
        <span class="ext">${esc(e.ext)}</span>
    </div>`;

    function render() {
        const q = search.value.trim().toLowerCase();
        if (!entries.length) {
            box.innerHTML = '<p class="empty-note">No numbers yet. An admin can add them under Admin → Phone directory.</p>';
            return;
        }
        const match = entries.filter(e => !q || [e.name, e.category, e.ext, e.notes].join(' ').toLowerCase().includes(q));
        if (!match.length) {
            box.innerHTML = '<p class="empty-note">Nothing matches that search.</p>';
            return;
        }
        let html = '';
        // Urgent numbers sit at the top as a strip so they are never scrolled past.
        const urgent = match.filter(e => e.category === 'Urgent');
        if (urgent.length) {
            html += `<div class="urgent-strip" aria-label="Urgent numbers">${urgent.map(e =>
                `<div class="urgent-pill"><b>${esc(e.ext)}</b><span>${esc(e.name)}</span></div>`).join('')}</div>`;
        }
        const rest = match.filter(e => e.category !== 'Urgent');
        const starred = rest.filter(e => favs.has(e.id));

        if (compact && !q) {
            html += starred.length
                ? `<div class="dir-cat"><h3>★ My numbers</h3>${starred.map(row).join('')}</div>`
                : '<p class="empty-note">Star the numbers you call most in the full directory and they will appear here.</p>';
        } else if (compact) {
            html += rest.slice(0, 6).map(row).join('');
            if (rest.length > 6) html += `<p class="empty-note">${rest.length - 6} more in the full directory.</p>`;
        } else {
            const groups = [];
            if (starred.length && !q) groups.push(['★ My numbers', starred]);
            for (const cat of CATEGORIES) {
                const list = rest.filter(e => e.category === cat && (q || !favs.has(e.id)));
                if (list.length) groups.push([cat, list]);
            }
            html += groups.map(([cat, list]) => `<div class="dir-cat"><h3>${esc(cat)}</h3>${list.map(row).join('')}</div>`).join('');
        }
        box.innerHTML = html;
    }

    search.addEventListener('input', render);
    box.addEventListener('click', (e) => {
        const b = e.target.closest('.star');
        if (!b) return;
        const id = Number(b.dataset.id);
        favs.has(id) ? favs.delete(id) : favs.add(id);
        try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch { /* storage unavailable */ }
        render();
    });
    render();
}
