# SQH Clinical Nutrition Toolkit

> **Public site:** the Nutrition Awareness (الوعي التغذوي) initiative site for visitors lives in [`awareness/`](awareness/). It is separate from this staff toolkit. See [`awareness/README.md`](awareness/README.md).

A single-page web app for the Clinical Nutrition Department. It has bedside calculators and bilingual (Arabic / English) patient education handouts. Everything is in one `index.html` with no build step, so it can be hosted free on GitHub Pages.

> **Privacy by design:** the page stores no patient data and sends nothing anywhere. Staff are told not to enter names, MRNs or phone numbers. The only thing kept in the browser is the light/dark theme choice.

## What's inside

| Tab | What it does |
|---|---|
| **Patient parameters** (shared) | BMI and WHO category, ideal body weight (Hamwi), % IBW, adjusted body weight, % weight change |
| **Requirements** | Energy by kcal/kg, Mifflin-St Jeor and Harris-Benedict (× activity/stress factor); protein presets (acute illness, ICU, CKD per KDOQI 2020, dialysis, wounds, burns); fluid in mL/kg. Shows ASPEN/SCCM 2016 guidance for obese ICU patients, and Holliday-Segar fluid with a warning for patients under 18 |
| **Screening** | MUST (auto-scored from the parameters) and NRS-2002 (initial and final screening), each with the recommended action |
| **Enteral feeding** | Pump rate (rounded to 5 mL/h) or bolus volume, energy and protein delivered, protein gap, free water and flush volumes. Generic formula presets can be edited to match your formulary |
| **Refeeding risk** | NICE CG32 criteria (high and extreme risk), starting kcal/kg and the monitoring checklist |
| **ADIME note** | Builds a copy-paste documentation note (PES statement plus every number from the other tabs) for the EMR |
| **Patient education** | 7 handouts in Arabic and/or English: diabetes, low salt, CKD, high-energy high-protein, heart health, Ramadan fasting with diabetes, and iron deficiency. You can print them, copy them, or share them via WhatsApp (you pick the contact; no number is stored) |

## Run it / publish it

- **Locally:** open `index.html` in any browser.
- **GitHub Pages:** go to repo **Settings → Pages**, set the source to *Deploy from a branch*, pick the branch and `/ (root)`, then save. The site appears at `https://<owner>.github.io/<repo>/`.

## Customise

At the top of the `<script>` in `index.html`:

- `CONFIG`: department name, subtitle and the handout footer text (Arabic and English).
- `HANDOUTS`: add or edit topics. Each one has `en` and `ar` blocks with a `title` and a list of `items`.
- Formula presets (`#e-preset`) and protein presets (`#prot-preset`) are plain `<option value="…">` lists in the HTML.

**Clinical sign-off:** before using this on the wards, have a senior dietitian check the defaults, presets and handout wording against SQH protocols and your formulary.

---

## Review of the "Be With Us" (كُنْ مَعَنا) school platform, and what this project does differently

The school platform is a strong idea: everything a staff member needs is on one screen, with ready-made templates, one-click WhatsApp, role-based views, an archive and escalation tracking. This toolkit copies that "everything on one page, one click away" approach. It fixes the following problems rather than carrying them over.

### Must-fix issues in the original

1. **The API key is public.** `GEMINI_API_KEY` sits in the page source, so anyone can copy it and use the owner's quota. The owner should revoke it in Google AI Studio now. Any AI call should go through a small backend (for example, a Cloud Function) that holds the key.
2. **The passwords are fake.** The "protected" exports, backup and archive deletion all check against a hard-coded `'7772'` in the source. Anyone can read it with View Source, and the check can be skipped from the console. Real protection needs a server-side login.
3. **Personal data is public.** Student names and parents' phone numbers are loaded from Google Sheets that are shared publicly, and staff mobile numbers are written into the HTML. For a hospital this would be a serious confidentiality breach. That is why this toolkit stores nothing.
4. **Some "AI" features aren't AI.** The AI draft, translation and academic advice functions return fixed text. The "translation", for example, appends the same generic English, Urdu or Hindi sentence no matter what the message says. Users trust labels, so features should do what they say or be renamed.
5. **Names are injected into HTML unescaped** (`innerHTML` with names from the sheet), which allows script injection from a crafted sheet cell. This toolkit builds content with `textContent` and DOM nodes.

### Quality issues

- **Page size:** `index.html` is 2.6 MB because the banner image is embedded as base64. There is also a Three.js particle background and the Tailwind *development* CDN. On a ward PC or a phone this means slow loading and battery drain. This toolkit is about 70 KB with no frameworks.
- **Duplicated code:** 29 near-identical `useStoredClassX_Y()` functions and buttons, and the same export code written three times. A single data list plus a loop would do.
- **Data lives only in one browser** (`localStorage`). Clearing the browser or switching devices loses the archive.
- **Accessibility:** many tiny 9–11 px labels, low-contrast colour pairs, and modals with no focus handling or Escape key. This toolkit uses larger type, proper labels, keyboard-navigable tabs and a light/dark theme based on the system setting.

### Ideas for the next version (clinical)

- Arabic interface toggle (the handouts are already bilingual).
- More screening tools: GLIM criteria for diagnosing malnutrition, SGA, and paediatric tools such as STAMP and WHO z-scores.
- Parenteral nutrition calculator (macronutrients, osmolarity, glucose infusion rate).
- If the department wants a shared referral list or ward-round worklist, build it on the hospital's approved, access-controlled systems. Do not use Google Sheets or WhatsApp for this.

## References

Mifflin MD et al. 1990 · Harris JA, Benedict FG 1919 · Hamwi GJ 1964 · BAPEN *MUST* · Kondrup J et al. ESPEN NRS-2002, 2003 · NICE CG32 *Nutrition support for adults* · McClave SA et al. ASPEN/SCCM 2016 · KDOQI Clinical Practice Guideline for Nutrition in CKD 2020 · IDF-DAR *Diabetes and Ramadan Practical Guidelines* · WHO sodium intake guideline 2012.

*Clinical decision support only. Verify every result against local protocols and clinical judgement.*
