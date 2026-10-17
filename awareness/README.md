# رحلة المريض التغذوية · ظفار (public site)

The public site for the مبادرة «الوعي التغذوي» (Nutrition Awareness initiative) of the Department of Nutrition & Dietetics, Sultan Qaboos Hospital. Prepared by Dietitian Thuraiya Al Rawas.

The site is the Claude Design file *Nutrition Journey* (the latest version, with photos), turned into plain static files: `index.html` plus the `assets/` folder. There is no build step. It is separate from the staff toolkit (`../index.html`).

## Changes from the design file

- Added an **Integration (الدمج)** section: health centres → specialist clinics → hospital, connected by referral and follow-up.
- Added 2 services, so there are now 9. Each has its own "Learn more" window:
  - Oral supplements and tube feeding
  - Discharge planning and continued care
- Image slots are now ordinary images in `assets/`, and the "Made with Claude Design" badge is removed.

## Publish on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, then pick `SQHNutrition-tech/SQH_Nutrition`.
2. Set the production branch to `claude/clinical-nutrition-improvements-2s00on` (or `main` once the work is merged there).
3. Choose the framework preset **None**, leave the build command empty, and set the build output directory to `awareness`.
4. Click **Save and Deploy**. The site appears at `https://<project-name>.pages.dev`. You can add your own domain later under **Custom domains**.

Every push to that branch then redeploys the site automatically. `_headers` lets browsers cache the images for 7 days.

## Editing

All text sits in `index.html` as plain data lists with Arabic and English side by side:

| List | What it holds |
|---|---|
| `stages` | Journey stops |
| `svcs` and `svcMore` | Services and their "Learn more" details |
| `clinics` | Specialty clinics |
| `F` | Map facilities and clinic days |
| `futs` | Future plans |

To replace a photo, drop a new file into `assets/` with the same name (for example `svc-support.jpg`).

## Still to do

- `svc-support.jpg` and `svc-discharge.jpg` are temporary copies of the journey illustrations for stops 4 and 6. Replace them with photos in the same style as the other service photos.
- Check the facts that come from the design: the team count (21), the map facilities and clinic days, and the placeholder names "Specialty Polyclinic A/B".

Map data © OpenStreetMap contributors © CARTO. Leaflet 1.9.4 (BSD-2). IBM Plex Sans Arabic / IBM Plex Mono and Readex Pro fonts (SIL OFL).
