# Deploying the Nutrition Hub on Cloudflare

Total time is about 45 minutes. Do this once; after that, updates take one command. Everything here works on Cloudflare's **free plan**, including Access for up to 50 users.

> **Before you start:** this moves patient follow-up data (hospital numbers, wards, review dates, nutrition plans) to a cloud service run by the department. Get written approval from hospital IT / information security first. The README's "What is stored" table is ready to share with them.

## What you need

- A Cloudflare account (free): <https://dash.cloudflare.com/sign-up>. Use a department email, not a personal one, and give a second admin access so the account isn't tied to one person.
- **Recommended:** a domain name added to Cloudflare, for example `nutrition-hub.example.om`. Without one, see *Option B* in step 4.
- A computer with **Node.js 20 or newer** (<https://nodejs.org>) and this repository downloaded.

## Status (16 October 2026)

- **Done:** the database `sqh-nutrition-hub` was created in the department's Cloudflare account (Eastern Europe region) with all tables and the 46 formulary products. Its ID is already in `wrangler.toml`. **Skip step 2.**
- **Next:** publish the Worker (the quickest way is below), switch on sign-in (step 3, or the one-click option in step 4 B), then fill in the three settings in step 4.

## Quickest way to publish: connect GitHub (no computer setup)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository**.
2. Connect GitHub and choose the repository **sqh_nutrition**.
3. **Project name:** `sqh-nutrition-hub` (must match `name` in `wrangler.toml`).
4. **Branch:** the branch that holds the hub, `claude/clinical-nutrition-improvements-2s00on` until it is merged into `main`.
5. Leave the build command empty and the deploy command as `npx wrangler deploy`. Save and deploy.

After this, every push to that branch publishes the hub automatically. Until the Access settings in step 4 are filled in, the hub answers every visitor with "Sign-in required", so nothing is exposed while you finish setup.

## 1. Install and log in

```bash
cd SQH_Nutrition
npm install
npx wrangler login        # opens the browser; approve access to your Cloudflare account
```

## 2. Create the database

```bash
npx wrangler d1 create sqh-nutrition-hub
```

Copy the `database_id` it prints into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`. Then create the tables:

```bash
npm run db:migrate:remote
```

## 3. Set up sign-in (Cloudflare Access)

1. In the dashboard, open **Zero Trust**. The first time, choose a team name, for example `sqh-nutrition`. Your **team domain** is then `sqh-nutrition.cloudflareaccess.com`. Choose the **Free** plan.
2. Go to **Settings → Authentication → Login methods**. Make sure **One-time PIN** is listed (add it if not): people type their email and receive a 6-digit code. This works with Ministry email addresses and needs no setup.
3. Go to **Access → Applications → Add an application → Self-hosted**:
   - **Name:** Nutrition Hub
   - **Session duration:** 12 hours, so people sign in once per shift
   - **Domain:** the hostname you will use in step 4, for example `nutrition-hub.example.om`
4. Add a **policy**:
   - **Name:** Dietitians
   - **Action:** Allow
   - **Include → Emails:** add each dietitian's work email
   - This list is your front door. Remove people here when they leave.
5. Save. Open the application's **Overview** and copy the **Application Audience (AUD) Tag**.

## 4. Fill in the settings and deploy

In `wrangler.toml`, under `[vars]`:

```toml
ACCESS_TEAM_DOMAIN = "sqh-nutrition.cloudflareaccess.com"
ACCESS_AUD = "<the AUD tag from step 3.5>"
ADMIN_EMAILS = "head.dietitian@example.om"   # comma-separate several
```

**Option A, your own domain (recommended).** Add this to `wrangler.toml`:

```toml
routes = [{ pattern = "nutrition-hub.example.om", custom_domain = true }]
```

**Option B, no domain.** Set `workers_dev = true` in `wrangler.toml`. In step 3, use the Worker's `*.workers.dev` address as the Access application domain. Alternatively, after deploying, open the Worker in the dashboard → **Settings → Domains & Routes** and enable **Cloudflare Access** on the workers.dev address, then copy that application's AUD tag.

Then deploy:

```bash
npm run deploy
```

## 5. Check it

1. Open the hub address in a private browser window. You should see the Cloudflare sign-in page, not the hub.
2. Sign in with an admin email. The **Admin** tab should appear.
3. Ask a colleague to sign in once. They then appear under **Admin → Team members** and in handover lists.

## 6. Move over from the ChatGPT pilot

1. In the old app, open **Department**, clear all filters, and click **Export CSV**. Do the same for each dietitian's view if anything is missing.
2. Ask every dietitian to sign in to the new hub once, so their cases import back to them instead of to you.
3. In the new hub, go to **Admin → Import from the old pilot** and choose the CSV. Read the report: it lists any skipped rows and why.
4. Spot-check a few cases. Then **delete the CSV file** and stop using the old app. Delete its data there if it offers that.

## 7. Set up the content

In **Admin**:

- **Quick links:** Ministry email, HR portal, Al Shifa, protocols, duty roster.
- **Phone directory:** use the category **Urgent** for code blue, security and similar. Add the department, the wards, and support services such as the diet kitchen, pharmacy and lab.

## Updating later

After changing code:

```bash
npm test && npm run deploy
```

If a release adds a new file in `migrations/`, run `npm run db:migrate:remote` first.

## Day-to-day admin

| Task | Where |
|---|---|
| New dietitian joins | Add their email to the Access policy (step 3.4). They appear in the hub after their first sign-in. |
| Dietitian goes on leave | **Admin → Team members → Move all open cases to** a colleague |
| Dietitian leaves | Move their cases, click **Turn off** in Admin, and remove them from the Access policy |
| Back up the data | `npx wrangler d1 export sqh-nutrition-hub --remote --output backup.sql`. Store it only on a hospital computer. D1 also keeps point-in-time recovery ("Time Travel"): 7 days on the free plan, 30 days on paid. |
