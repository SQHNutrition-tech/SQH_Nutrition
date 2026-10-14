# SQH Nutrition Hub

> **Public site:** the Nutrition Awareness (الوعي التغذوي) initiative site for visitors lives in [`awareness/`](awareness/). It is separate from this staff hub. See [`awareness/README.md`](awareness/README.md).

The Clinical Nutrition Department's daily home page. Each dietitian opens it in the morning and finds:

- **Their day:** a greeting, the quote of the day (Arabic and English), and their overdue / due-today reviews and incoming handovers.
- **Follow-ups and handovers:** the shared patient list, using **hospital numbers only**. It covers:
  - handing a case to a colleague (they must accept it)
  - moving a patient from ward to ward
  - discharging from a ward to a clinic, with the nutrition plan travelling with the case
  - admitting from a clinic back to a ward
- **Quick links:** Ministry email, HR, Al Shifa, protocols. Admins edit these in the app.
- **Phone directory:** searchable extensions for the department, wards and support services, with urgent numbers at the top. Each person can star their favourites. Admins edit it in the app.
- **Calculators and handouts:** requirements, MUST, NRS-2002, enteral regimen, refeeding risk, ADIME note, and Arabic/English patient handouts.

It runs on **Cloudflare** (a Worker plus a D1 database), in the department's own account, with sign-in through **Cloudflare Access**. It no longer depends on ChatGPT. See **[DEPLOY.md](DEPLOY.md)** for step-by-step setup.

## What is stored, and what is not

| Stored | Not stored |
|---|---|
| Hospital number, ward/clinic, bed | Patient names, diagnoses, clinical notes (these stay in Al Shifa) |
| Nutrition risk, urgent flag, review date, next task | |
| Nutrition plan for handover: route, diet/formula, kcal / protein / fluid targets, short goals note | |
| Who owns the case, pending handover, and a log of every action with who did it and when | |
| Team members' work email, display name and role | |

- **Retention:** closed cases and their activity log are **deleted automatically 90 days after closing** (daily job at 02:00 Oman time). Change this with `RETENTION_DAYS` in `src/config.js`.
- **Sign-in:**
  - Cloudflare Access decides who can sign in (an allowlist of emails).
  - The Worker then checks Access's signed token on **every** request, including pages, so nothing loads without a valid sign-in.
  - Admins can switch off a member inside the app; that person is refused even if they can still sign in to Access.
- **Who can change what:**
  - Only the responsible dietitian, or an admin, can change a case.
  - Only the receiving dietitian can accept or decline a handover.
  - If two people edit the same case at once, the second is asked to refresh instead of overwriting the first.

## How handovers work

| Situation | What to do | What happens |
|---|---|---|
| Colleague takes over (leave, workload) | **Hand over**, then choose a colleague | You stay responsible until they press **Accept**. If they decline, the case stays with you. |
| Patient moves ward | **Move / discharge**, then choose the new ward | The location changes immediately. Optionally hand over to the dietitian covering that ward. |
| Patient discharged to clinic | **Move / discharge**, then choose a clinic | The clinic date and nutrition plan are **required**. The case becomes an outpatient case, optionally handed to the clinic dietitian. |
| Clinic patient admitted | **Move / admit**, then choose a ward | The case becomes an inpatient case again. |
| Referred to primary care | **Close** with "Referred to primary care (PHC)" | The case leaves the active list. PHC handover is the next phase (see roadmap). |

## Project layout

```
src/worker.js        API, sign-in check, admin actions, daily retention clean-up
src/model.js         Case rules: add, review, handover, transfer, discharge, close (unit-tested)
src/auth.js          Cloudflare Access token verification
src/config.js        Wards and clinics, next actions, feeding routes, closure reasons, retention
migrations/          D1 database schema
public/index.html    Home: greeting, quote, today's counts, quick links, phone directory
public/followup.html Follow-up list and handovers
public/admin.html    Members, quick links, phone directory, import from the old pilot
public/tools.html    Calculators and patient handouts
test/                Unit tests (npm test)
docs/                Earlier review of the "Be With Us" school platform
```

To add or rename a ward or clinic, edit `LOCATIONS` in `src/config.js` and redeploy.

## Develop locally

```bash
npm install
npm run db:migrate:local
npm run dev          # http://localhost:8787 signed in as a test user
npm test
```

Local mode signs you in as `DEV_USER_EMAIL` (set in the `dev` script). It only works on `localhost`, so it can never apply on the real site.

## Roadmap (after the hospital pilot)

1. **Email notice on handover:** tell the receiving dietitian a case is waiting for them (no patient details in the email).
2. **PHC referral:** a printable referral summary (no name; the dietitian writes the name on paper), and later PHC dietitians as members with their own facility code. The database already stores a facility on every case.
3. **Workload report:** monthly counts per dietitian, ward and handover type for department reports.
4. **Arabic interface.**
5. **Hospital hosting:** if IT prefers, the same database layout can move to a hospital server.

*Clinical decision support only. Verify calculator results against local protocols.*
