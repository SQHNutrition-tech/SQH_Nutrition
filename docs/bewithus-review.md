# Review: "Be With Us" (كُنْ مَعَنا) school platform

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
