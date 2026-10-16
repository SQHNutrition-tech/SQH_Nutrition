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
- **Phone directory:** its own page and the first quick link. Searchable extensions for the department, wards and support services, with urgent numbers at the top. Each person can star their favourites, which then appear on their home page. Admins edit it in the app.
- **Formulary:** every feed and module the department stocks, with photo and label values. Includes:
  - **compare** up to three side by side
  - **which formula fits** a patient's energy, protein and fluid targets
  - **concentrate** a powder to a target kcal per 100 mL
  - **protein top-up:** grams and scoops of a verified protein module to close a protein gap
  - **use in enteral calculator**, which opens the calculator pre-filled
  - suggestions in the follow-up plan's diet/formula field
- **Calculators and handouts:** requirements, MUST, NRS-2002, enteral regimen, refeeding risk, ADIME note, and Arabic/English patient handouts.
- **English or Arabic interface:** each dietitian chooses on their first visit and can switch any time with the **ع / EN** button in the top bar. See [Arabic interface](#arabic-interface).

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
  - **Invite-only:** even after signing in, only people an admin has added under **Admin → Team members** (plus the first admin in `ADMIN_EMAILS`) get in. A too-broad Access rule therefore cannot expose any data.
  - Admins can switch off a member inside the app; that person is refused even if they can still sign in to Access.
- **Who can change what:**
  - Only the responsible dietitian, or an admin, can change a case.
  - Only the receiving dietitian can accept or decline a handover.
  - If two people edit the same case at once, the second is asked to refresh instead of overwriting the first.

## Formulary: adding and editing products

Admins manage the formulary on one page: **Formulary → Edit formulary** (or **Admin → Open formulary editor**). No code changes are needed, including for photos.

- **One product at a time:** **＋ Add product**, or **Edit** on any row. The form covers every label value, the bottle size, tags, source and notes. **Choose photo** takes a picture of the pack front from a phone or computer and resizes it automatically.
- **Quick changes:** click any number in the grid, type, and press **Save changes**. Enter moves down a column, like a spreadsheet.
- **Many products with Excel:**
  1. **Download all products** (or the **Blank template** for new products only).
  2. Fill it in Excel. Keep each product's ID; leave ID empty for new products. The *How to fill* sheet explains every column, and Group, Form and Values per have drop-down lists.
  3. **Upload Excel file.** The hub shows every new product, every changed value and any problem row **before** saving. Rows with problems are skipped, never half-saved.

The safety rules are the same everywhere:
1. Enter the label's **per 100 mL** column (as prepared for powders), or **per 100 g** for modules.
2. The hub rejects an energy value that doesn't match protein, carbohydrate and fat (4/4/9 kcal per g), and numbers outside sensible limits.
3. **Changing any number removes the verification.** Verifying is only done in the hub, never by an Excel upload: click **Verify** after checking every value against the pack in hand. The hub records who verified and when.
4. Only verified products drive the calculators.

46 products have been added from front-of-pack photos (October 2026):
- **First batch:** 16 infant and paediatric products.
- **Second batch:** 16 adult oral supplements and tube feeds.
- **Third batch:** 14 renal, peptide, oncology and paediatric products, plus the first modules (Protifar, Maxijul, Abound).

**Datasheet values (16 October 2026):** 40 products now have full panels taken from the manufacturers' published datasheets:
- energy, protein, carbohydrate, fat, fibre and free water
- sodium, potassium, chloride, calcium, magnesium and phosphate (with mmol shown next to the mg)
- osmolality and/or osmolarity
- dilution and scoop size for powders, and bottle size for liquids

Each product links to the page its values came from and says which country's version it is. Most sources are UK, Irish, EU, US or Australian, and Middle East formulations can differ. So **every product is still unverified** and must be checked against the pack in hand before a dietitian presses Verify. Notes marked **CHECK** flag known doubts (Fortini or Fortini Multi Fibre, Monogen osmolality, Forticare Advanced, the Philippine values for S-26 LF Gold).

**Still need the label** (no official values found): S-26 PDF Gold, S-26 Gold 1, S-26 Gold 2, S-26 Ultima 1, Novalac AD and Aptamil Advance 2 CESAR.

**Per bottle:** for liquids with a bottle size, the product view shows per 100 mL and per bottle side by side, and **Compare** can switch between the two.

## Arabic interface

- **First visit:** a welcome dialog (in both languages) asks for the display name colleagues will see and the interface language.
- **Switching:** the **ع / EN** button in the top bar switches language on every page. The choice is saved to the member's account, so it follows them to another computer or phone.
- **Right to left:** in Arabic the layout runs right to left. Number ranges, doses and hospital numbers keep their left-to-right order, so "25–30 kcal/kg" never shows as "30–25".
- **What stays as entered:**
  - product names, pack sizes, extensions, quick links and anything an admin types
  - units (kcal, g, mL)
  - the ADIME note, which stays in English for the EMR
  - the patient handouts, which follow their own language choice (Arabic, English or both)
- **Adding or fixing a translation:** edit `public/js/i18n-ar.js`. Each line is `'English text': 'النص العربي'`. To list any text still showing in English, open the page in Arabic and type `[...I18N.missing]` in the browser console. `npm test` checks that every ward, next action, feeding route and closure reason has an Arabic name.

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
public/formulary-edit.html Formulary editor: grid, product form with photo, Excel download/upload
public/js/xlsx-lite.js Excel (.xlsx) reader and writer, no outside library (tested)
public/formulas.html Formulary: library, compare, best fit, concentration
public/directory.html Phone directory
public/js/formula-math.js Feed calculations (unit-tested)
src/formulary.js     Formulary validation and verification rules
public/img/formulas/ Product photos
public/tools.html    Calculators and patient handouts
public/js/i18n.js    English / Arabic switch and right-to-left layout
public/js/i18n-ar.js Arabic text for the interface
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
4. **Hospital hosting:** if IT prefers, the same database layout can move to a hospital server.

*Clinical decision support only. Verify calculator results against local protocols.*
