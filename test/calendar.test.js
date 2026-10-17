// Calendar events for follow-up reviews.
import test from 'node:test';
import assert from 'node:assert/strict';
import { muscatToDate, eventTimes, buildIcs, googleLink, outlookLink } from '../public/js/calendar.js';

const ev = {
    uid: 'case-7@sqh-nutrition-hub', sequence: 3, day: '2026-10-18', time: '08:30', minutes: 30, allDay: false,
    title: 'Nutrition review · Ward 5, Male · Bed 12', details: 'Next action: Review; check PO4\nHigh risk',
    url: 'https://hub.example/followup.html?case=7', remindMin: 15
};

test('Muscat time converts to UTC (+4, no daylight saving)', () => {
    assert.equal(muscatToDate('2026-10-18', '08:30').toISOString(), '2026-10-18T04:30:00.000Z');
    assert.equal(muscatToDate('2026-01-01', '02:00').toISOString(), '2025-12-31T22:00:00.000Z');
    const t = eventTimes(ev);
    assert.equal(t.startText, '20261018T043000Z');
    assert.equal(t.endText, '20261018T050000Z');
    const d = eventTimes({ day: '2026-12-31', allDay: true });
    assert.deepEqual([d.startText, d.endText], ['20261231', '20270101']);
});

test('.ics file: escaped text, reminder, sequence, CRLF and folded lines', () => {
    const ics = buildIcs([ev, { ...ev, uid: 'case-8@x', allDay: true, remindMin: -450 }], new Date('2026-10-16T10:00:00Z'));
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.equal(ics.split('BEGIN:VEVENT').length - 1, 2);
    assert.match(ics, /DTSTART:20261018T043000Z\r\n/);
    assert.match(ics, /DTSTART;VALUE=DATE:20261018\r\nDTEND;VALUE=DATE:20261019\r\n/);
    assert.match(ics, /SUMMARY:Nutrition review · Ward 5\\, Male · Bed 12/);
    assert.match(ics, /TRIGGER:-PT15M/);
    assert.match(ics, /TRIGGER:PT450M/);
    assert.match(ics, /SEQUENCE:3/);
    assert.match(ics, /DTSTAMP:20261016T100000Z/);
    // Unfold and check the description survived escaping.
    const unfolded = ics.replace(/\r\n /g, '');
    assert.ok(unfolded.includes('DESCRIPTION:Next action: Review\\; check PO4\\nHigh risk\\n\\nhttps://hub.example/followup.html?case=7'));
    for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
    const noAlarm = buildIcs([{ ...ev, remindMin: null }]);
    assert.ok(!noAlarm.includes('VALARM'));
});

test('Arabic text folds without splitting a character', () => {
    const ics = buildIcs([{ ...ev, title: 'مراجعة تغذية · الجناح الخامس · سرير ١٢ · '.repeat(4) }]);
    const unfolded = ics.replace(/\r\n /g, '');
    assert.ok(unfolded.includes('مراجعة تغذية · الجناح الخامس'));
    for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75);
});

test('Google and Outlook links carry the event', () => {
    const g = new URL(googleLink(ev));
    assert.equal(g.hostname, 'calendar.google.com');
    assert.equal(g.searchParams.get('dates'), '20261018T043000Z/20261018T050000Z');
    assert.equal(g.searchParams.get('text'), ev.title);
    assert.ok(g.searchParams.get('details').endsWith(ev.url));
    const o = new URL(outlookLink(ev));
    assert.equal(o.hostname, 'outlook.office.com');
    assert.equal(o.searchParams.get('startdt'), '2026-10-18T04:30:00Z');
    assert.equal(o.searchParams.get('allday'), 'false');
    const od = new URL(outlookLink({ ...ev, allDay: true }, { work: false }));
    assert.equal(od.hostname, 'outlook.live.com');
    assert.deepEqual([od.searchParams.get('startdt'), od.searchParams.get('enddt')], ['2026-10-18', '2026-10-19']);
});

