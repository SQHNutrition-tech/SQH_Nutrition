// Calendar events for follow-up reviews: Google / Outlook links and .ics files.
// Events never carry the hospital number: personal calendars sit outside the
// hospital, so the event names the ward, bed and next action and links back
// to the case in the hub, where the number is shown behind sign-in.

// Oman keeps UTC+4 all year (no daylight saving), so a fixed offset is exact.
const OFFSET_MIN = 4 * 60;

const pad = (n) => String(n).padStart(2, '0');

/** "2026-10-18" + "08:30" (Muscat) → Date in UTC. */
export function muscatToDate(day, time = '08:00') {
    const [y, m, d] = String(day).split('-').map(Number);
    const [hh, mm] = String(time).split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_MIN * 60000);
}

/** UTC stamp as calendars want it: 20261018T043000Z. */
export function utcStamp(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Start and end of one event. allDay keeps the review on the date without a time. */
export function eventTimes({ day, time = '08:00', minutes = 30, allDay = false }) {
    if (allDay) {
        const start = new Date(`${day}T00:00:00Z`);
        const end = new Date(start.getTime() + 86400000);
        const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
        return { allDay, start, end, startText: ymd(start), endText: ymd(end) };
    }
    const start = muscatToDate(day, time);
    const end = new Date(start.getTime() + minutes * 60000);
    return { allDay, start, end, startText: utcStamp(start), endText: utcStamp(end) };
}

// RFC 5545 text: escape \ ; , and new lines, and fold long lines at 75 octets.
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out = [];
    let cur = '', size = 0;
    for (const ch of line) {
        const n = new TextEncoder().encode(ch).length;
        if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
        cur += ch;
        size += n;
    }
    out.push(cur);
    return out.join('\r\n ');
}

/**
 * One VEVENT. ev: { uid, sequence, day, time, minutes, allDay, title, details, url, remindMin }
 * The same uid with a higher sequence replaces the earlier event when re-imported.
 * remindMin: minutes before the start (null = no reminder). For all-day events it
 * counts back from midnight, so 0 rings at 00:00 — callers pass e.g. -450 for 07:30.
 */
function vevent(ev, now = new Date()) {
    const t = eventTimes(ev);
    const lines = [
        'BEGIN:VEVENT',
        `UID:${ev.uid}`,
        `SEQUENCE:${Number(ev.sequence) || 0}`,
        `DTSTAMP:${utcStamp(now)}`,
        t.allDay ? `DTSTART;VALUE=DATE:${t.startText}` : `DTSTART:${t.startText}`,
        t.allDay ? `DTEND;VALUE=DATE:${t.endText}` : `DTEND:${t.endText}`,
        `SUMMARY:${icsText(ev.title)}`,
        `DESCRIPTION:${icsText([ev.details, ev.url].filter(Boolean).join('\n\n'))}`,
        ev.url ? `URL:${ev.url}` : '',
        t.allDay ? 'TRANSP:TRANSPARENT' : 'TRANSP:OPAQUE'
    ];
    if (ev.remindMin !== null && ev.remindMin !== undefined && ev.remindMin !== '') {
        const m = Number(ev.remindMin);
        const trigger = m >= 0 ? `-PT${m}M` : `PT${-m}M`;
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(ev.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
    return lines.filter(Boolean).map(fold);
}

/** A complete .ics file holding one or more events. */
export function buildIcs(events, now = new Date()) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SQH Clinical Nutrition//Nutrition Hub//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...events.flatMap(ev => vevent(ev, now)),
        'END:VCALENDAR'
    ].join('\r\n') + '\r\n';
}

/** Google Calendar "new event" page, filled in. */
export function googleLink(ev) {
    const t = eventTimes(ev);
    const p = new URLSearchParams({
        action: 'TEMPLATE',
        text: ev.title,
        dates: `${t.startText}/${t.endText}`,
        details: [ev.details, ev.url].filter(Boolean).join('\n\n'),
        ctz: 'Asia/Muscat'
    });
    return `https://calendar.google.com/calendar/render?${p}`;
}

/** Outlook on the web "new event" page (work/school accounts use office.com). */
export function outlookLink(ev, { work = true } = {}) {
    const t = eventTimes(ev);
    const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const p = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: ev.title,
        body: [ev.details, ev.url].filter(Boolean).join('\n\n'),
        startdt: t.allDay ? ev.day : iso(t.start),
        enddt: t.allDay ? t.end.toISOString().slice(0, 10) : iso(t.end),
        allday: String(!!t.allDay)
    });
    return `https://outlook.${work ? 'office' : 'live'}.com/calendar/0/deeplink/compose?${p}`;
}

/** Saves an .ics file through the browser. */
export function downloadIcs(filename, events) {
    const url = URL.createObjectURL(new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Each dietitian's own choices, kept in this browser only.
const PREF_KEY = 'hub.calendar';
export const DEFAULT_PREFS = { time: '08:00', minutes: 30, allDay: false, remindMin: 15, ask: true, app: 'google' };
export function loadPrefs() {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
}
export function savePrefs(p) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private window: keep defaults */ }
}
