# Nutrition Awareness (الوعي التغذوي): public site

This is the public site for the مبادرة «الوعي التغذوي» (Nutrition Awareness initiative) of the Department of Clinical Nutrition, Sultan Qaboos Hospital. It is shown at the department's corner during the launch ceremony:

> Thursday 15 October 2026, 10:00 a.m., Sultan Qaboos Hospital lobby

It is built on the Claude Design file *Nutrition Journey.html*. The staff clinical toolkit (`../index.html`) is separate and is not linked from here.

## What's on the page

| Section | Content |
|---|---|
| Hero | Launch details, plus a vertical opening animation with no text (`assets/video/opening.mp4`) |
| Integration (الدمج) | How health centres, specialist clinics and the hospital work together through referral and follow-up |
| Patient journey | 7 stops: screening → referral → dietitian assessment → nutrition treatment → follow-up → discharge planning → health-centre follow-up. Tap a number to jump to that stop |
| Service explorer | The 7 services. Filter by setting and tap a card for details |
| Specialist clinics, Map | Taken from the design. The map works offline too, but without the base map |
| صحّح وعيك التغذوي (quiz) | 8 fact-or-myth questions, each with an instant explanation |
| Build your healthy plate | Tap foods onto the plate and get feedback right away |
| MUST, Future plans | Taken from the design (MUST now has an awareness disclaimer) |
| Resources | A QR code for the site, national resources, and a slot for approved handouts |

## Ways to open it

- **Phones (QR):** `https://sqhnutrition-tech.github.io/SQH_Nutrition/awareness/`. This address only works once GitHub Pages is switched on (Settings → Pages → this branch, `/ (root)`). If the site is hosted somewhere else, change `CONFIG.siteUrl` in `assets/site.js` so the QR codes point to the right address.
- **Touchscreen:** add `?kiosk` to the address. After 2 minutes with no touch, the page resets to Arabic and returns to the start.
- **Large screen:** add `?present`, or press **وضع العرض** (Present). The page scrolls itself, shows a QR code in the corner, and loops back to the top. Touching the screen pauses it for 30 seconds.
- **Offline:** copy the whole `awareness/` folder to the event device and open `index.html`. Fonts, images, the video and all interactive parts are bundled locally. The only thing that needs internet is the map's background tiles.

## Editing

All settings are at the top of `assets/site.js`:

- `CONFIG`: QR address, launch end time, department logo path and kiosk timing.
- `HANDOUTS`: add `{ ar, en, url }` for each handout once it is approved. PDFs can go in `assets/handouts/`.
- `services`, `stages`, `QUIZ`, `FOODS`, and `F` (map facilities): plain data lists with Arabic and English text.

## Please check before launch

- The team count (21), the specialist-clinic days, and the map's facility list and clinic days all come from the design. "Specialty Polyclinic A/B" are placeholder names.
- The future-plans wording.
- Once the approved department logo is supplied, put it in `assets/img/` and set `CONFIG.deptLogo`. The hospital's official logo is not recreated here.

Map data © OpenStreetMap contributors. Leaflet 1.9.4 (BSD-2), qrcode-generator 1.4.4 (MIT), IBM Plex Sans Arabic / Plex Mono and Readex Pro fonts (SIL OFL).
