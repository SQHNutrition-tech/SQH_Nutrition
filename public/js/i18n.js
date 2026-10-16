// English / Arabic interface. Loaded as a plain script in <head> on every page
// so the language and text direction are set before anything is drawn.
//
// How it works: pages are written in English. In Arabic mode every visible
// text node, placeholder, title and aria-label whose text appears in the
// dictionary (window.I18N_AR, from i18n-ar.js) is swapped for its Arabic,
// including content added later by scripts (a MutationObserver watches the
// page). Stored data never changes; only what is displayed. Text inside
// [data-no-i18n], [lang] blocks (handouts), textareas and code is left alone.
// Strings built with numbers in scripts use I18N.L(english, arabic).
(function () {
    'use strict';
    const KEY = 'hub_lang';
    let lang = 'en';
    try { lang = localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; } catch (e) { /* storage blocked */ }

    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';

    const missing = new Set();
    const dict = () => window.I18N_AR || {};
    const patterns = () => window.I18N_AR_PATTERNS || [];

    function tr(text) {
        if (lang !== 'ar' || typeof text !== 'string') return text;
        const key = text.trim().replace(/\s+/g, ' ');
        // Nothing to do for empty text, numbers, or text that is already Arabic.
        if (!key || !/[A-Za-z]/.test(key) || /[\u0600-\u06FF]/.test(key)) return text;
        const d = dict();
        if (Object.prototype.hasOwnProperty.call(d, key)) return text.replace(text.trim(), d[key]);
        for (const [re, fn] of patterns()) {
            const m = key.match(re);
            if (m) return text.replace(text.trim(), fn(m, tr));
        }
        missing.add(key);
        return text;
    }

    const SKIP = 'script,style,textarea,code,pre,[data-no-i18n],[lang]:not(html)';
    const ATTRS = ['placeholder', 'title', 'aria-label', 'label'];

    function translateElementAttrs(el) {
        if (el.closest && el.closest('[data-no-i18n],[lang]:not(html)')) return;
        for (const a of ATTRS) {
            const v = el.getAttribute && el.getAttribute(a);
            if (v) {
                const t = tr(v);
                if (t !== v) el.setAttribute(a, t);
            }
        }
    }

    // Swaps one text node. An <option> keeps its English as its value (and in
    // data-en) so forms and the ADIME note still receive the English text.
    // In right-to-left text a range such as 25–30 or 1.2 × 45 would display
    // reversed (30–25). Left-to-right marks around it keep the order; unlike
    // isolates they also work inside <select> options.
    const LRM = '\u200E';
    const NUM_RUN = /\d[\d.,]*(?:\s?[–\-×\/]\s?\d[\d.,]*)+/g;
    const isolateNumbers = (s) => (s.includes(LRM) ? s : s.replace(NUM_RUN, (m) => LRM + m + LRM));

    function swapText(n) {
        const t = isolateNumbers(tr(n.data));
        if (t === n.data) return;
        const p = n.parentElement;
        if (p && p.tagName === 'OPTION') {
            if (!p.hasAttribute('value')) p.setAttribute('value', p.value);
            if (!p.dataset.en) p.dataset.en = p.textContent.trim();
            // A closed <select> ignores direction marks, so spell ranges out: 1.2 إلى 1.5.
            if (/[\u0600-\u06FF]/.test(t)) {
                n.data = t.replace(/\u200E?(\d[\d.]*)\s?–\s?(\d[\d.]*)\u200E?/g, '$1 إلى $2');
                return;
            }
        }
        n.data = t;
    }

    function translate(node) {
        if (lang !== 'ar' || !node) return;
        if (node.nodeType === 3) {
            const p = node.parentElement;
            if (!p || p.closest(SKIP)) return;
            swapText(node);
            return;
        }
        if (node.nodeType !== 1) return;
        translateElementAttrs(node);
        if (node.matches(SKIP)) return;
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                if (n.nodeType === 1 && n.matches(SKIP)) {
                    translateElementAttrs(n); // e.g. a textarea's placeholder
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let n = walker.nextNode();
        while (n) {
            if (n.nodeType === 3) {
                swapText(n);
            } else {
                translateElementAttrs(n);
            }
            n = walker.nextNode();
        }
    }

    if (lang === 'ar') {
        const nativeConfirm = window.confirm.bind(window);
        const nativeAlert = window.alert.bind(window);
        window.confirm = (msg) => nativeConfirm(tr(String(msg)));
        window.alert = (msg) => nativeAlert(tr(String(msg)));
    }

    function start() {
        if (lang !== 'ar') return;
        translate(document.body);
        document.title = tr(document.title);
        new MutationObserver((records) => {
            for (const r of records) {
                if (r.type === 'childList') r.addedNodes.forEach(translate);
                else if (r.type === 'characterData') translate(r.target);
                else if (r.type === 'attributes') translateElementAttrs(r.target);
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();

    window.I18N = {
        lang,
        isAr: lang === 'ar',
        t: tr,
        L: (en, ar) => (lang === 'ar' && ar !== undefined ? ar : en),
        locale: lang === 'ar' ? 'ar-OM-u-nu-latn' : 'en-GB',
        missing,
        set(newLang) {
            try { localStorage.setItem(KEY, newLang === 'ar' ? 'ar' : 'en'); } catch (e) { /* ignore */ }
        },
        hasSaved() {
            try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
        }
    };
})();
