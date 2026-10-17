import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, importRow, InputError } from '../src/model.js';

const ctx = { today: '2026-10-14', facility: 'SQH', members: new Set(['a@x.om', 'b@x.om', 'c@x.om']), isAdmin: false };
const base = { location: 'ICU-1', bed: '4', risk: 'high', due: '2026-10-15', nextAction: 'Routine follow-up' };

function added() {
    const { next } = applyAction('add', { ...base, hospitalNo: '00123' }, null, 'a@x.om', ctx);
    return { ...next, id: 1, revision: 1 };
}

test('add creates an active inpatient case owned by the actor', () => {
    const c = added();
    assert.equal(c.owner, 'a@x.om');
    assert.equal(c.setting, 'inpatient');
    assert.equal(c.hospitalNo, '00123');
    assert.equal(c.status, 'active');
});

test('add rejects past review dates, unknown wards and names typed as numbers', () => {
    assert.throws(() => applyAction('add', { ...base, hospitalNo: '1', due: '2026-10-13' }, null, 'a@x.om', ctx), InputError);
    assert.throws(() => applyAction('add', { ...base, hospitalNo: '1', location: 'Mars' }, null, 'a@x.om', ctx), InputError);
    assert.throws(() => applyAction('add', { ...base, hospitalNo: 'Fatma Said' }, null, 'a@x.om', ctx), InputError);
});

test('only the owner (or an admin) can change a case', () => {
    const c = added();
    assert.throws(() => applyAction('review', base, c, 'b@x.om', ctx), e => e.status === 403);
    assert.doesNotThrow(() => applyAction('review', base, c, 'b@x.om', { ...ctx, isAdmin: true }));
});

test('colleague handover: owner keeps responsibility until accepted', () => {
    const c = added();
    const h = applyAction('handover', { recipient: 'b@x.om', note: 'Check tolerance' }, c, 'a@x.om', ctx).next;
    assert.equal(h.owner, 'a@x.om');
    assert.equal(h.pendingTo, 'b@x.om');
    assert.throws(() => applyAction('accept', {}, h, 'c@x.om', ctx), e => e.status === 403);
    const acc = applyAction('accept', {}, h, 'b@x.om', ctx).next;
    assert.equal(acc.owner, 'b@x.om');
    assert.equal(acc.pendingTo, null);
});

test('handover to an inactive or unknown member is refused', () => {
    assert.throws(() => applyAction('handover', { recipient: 'ghost@x.om' }, added(), 'a@x.om', ctx), InputError);
});

test('ward-to-ward transfer moves the patient immediately and optionally requests a handover', () => {
    const c = added();
    const { next, event } = applyAction('transfer', { location: 'Surgical', bed: '9', recipient: 'b@x.om' }, c, 'a@x.om', ctx);
    assert.equal(next.location, 'Surgical');
    assert.equal(next.setting, 'inpatient');
    assert.equal(next.owner, 'a@x.om');
    assert.equal(next.pendingTo, 'b@x.om');
    assert.match(event, /^Transferred to Surgical · Bed 9 \(from ICU-1\)/);
});

test('discharge to clinic requires the nutrition plan and a clinic date', () => {
    const c = added();
    assert.throws(() => applyAction('transfer', { location: 'Nutrition clinic', due: '2026-11-01' }, c, 'a@x.om', ctx), InputError);
    const { next, event } = applyAction('transfer', {
        location: 'Nutrition clinic', due: '2026-11-01', route: 'Oral + supplements (ONS)', notes: 'Weight check, ONS BID', kcal: '1800', protein: '80'
    }, c, 'a@x.om', ctx);
    assert.equal(next.setting, 'outpatient');
    assert.equal(next.nextAction, 'Outpatient review');
    assert.equal(next.plan.kcal, 1800);
    assert.match(event, /^Discharged to Nutrition clinic/);
});

test('transfer to the same place is refused', () => {
    assert.throws(() => applyAction('transfer', { location: 'ICU-1', bed: '4' }, added(), 'a@x.om', ctx), InputError);
});

test('close clears pending handover; reopen restores an active case', () => {
    const h = applyAction('handover', { recipient: 'b@x.om' }, added(), 'a@x.om', ctx).next;
    const closed = applyAction('close', { reason: 'Nutrition follow-up complete' }, h, 'a@x.om', ctx).next;
    assert.equal(closed.status, 'closed');
    assert.equal(closed.pendingTo, null);
    assert.throws(() => applyAction('review', base, closed, 'a@x.om', ctx), InputError);
    const re = applyAction('reopen', base, closed, 'a@x.om', ctx).next;
    assert.equal(re.status, 'active');
});

test('import accepts the pilot CSV shape including overdue dates', () => {
    const c = importRow({ hospitalNo: '777', location: 'Neuro · Bed 2', risk: 'Low risk', urgent: 'Yes', due: '2026-10-01', nextAction: 'Check intake' }, ctx);
    assert.equal(c.location, 'Neuro');
    assert.equal(c.bed, '2');
    assert.equal(c.risk, 'low');
    assert.equal(c.urgent, true);
    assert.equal(c.due, '2026-10-01');
});
