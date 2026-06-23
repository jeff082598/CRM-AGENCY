# Deploying This Online — Step by Step

This turns the app into a real website your whole team logs into, with one
shared, live database. Total cost: **$0/month to start** (with the
trade-off that the app "wakes up" for a few seconds if nobody's used it in
the last 15 minutes — upgrading later removes that for about $7/month).

I'm recommending two specific services, on purpose:

- **Neon** for the database — its free tier doesn't expire or get deleted
  after a fixed number of days, which (as of mid-2026) some competing
  free-database offers do. You don't want to find that out the hard way
  after a month of real client data.
- **Render** to run the actual app — straightforward dashboard, free web
  hosting tier, deploys straight from a GitHub repository.

Neither of these require a credit card to start. You will need a (free)
GitHub account to hold the code — that's how Render knows what to run.

> Service pricing and free-tier limits change over time. If anything below
> doesn't match what you see on screen, that's likely why — the overall
> steps (create database → get code on GitHub → connect Render → set
> environment variables) will still apply even if a button is named
> slightly differently.

---

## Step 1 — Create your database (Neon)

1. Go to **neon.tech** and sign up (free).
2. Create a new project — any name is fine (e.g. "agency-crm").
3. Once it's created, find the **connection string** — it looks like:
   `postgresql://username:password@ep-something.region.aws.neon.tech/dbname?sslmode=require`
4. **Copy this entire string somewhere safe** (a notes app). You'll paste
   it into Render in Step 3. Treat it like a password — anyone with this
   string can read your whole database.

## Step 2 — Get this code onto GitHub

1. Go to **github.com** and sign up (free), if you don't have an account.
2. Click **+** (top right) → **New repository**. Name it `agency-crm`
   (or anything). Keep it **Private**. Don't add a README. Click **Create
   repository**.
3. On the next page, click **uploading an existing file**.
4. Unzip the project folder I gave you on your computer, then **drag the
   entire unzipped folder** (the one containing `package.json`, `server/`,
   `client/`, etc.) into the upload area in your browser.
5. Wait for the upload to finish, write any commit message (or leave the
   default), click **Commit changes**.

(If you're comfortable with a terminal, this is also just a normal
`git init && git add . && git commit -m "init" && git push` — feel free
to skip the drag-and-drop and do that instead.)

## Step 3 — Deploy the app (Render)

1. Go to **render.com** and sign up (free) — choosing "Sign up with
   GitHub" is the easiest, since it connects the two automatically.
2. Click **New +** → **Web Service**.
3. Connect your GitHub account if prompted, then select the
   `agency-crm` repository you just created.
4. Fill in:
   - **Name:** anything (e.g. `agency-crm`) — this becomes part of your URL.
   - **Region:** pick whichever is closest to you/your team.
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build:client`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (you can change this later if you want it to
     never sleep)
5. Scroll to **Environment Variables** and add these two:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from Step 1 |
   | `CRM_JWT_SECRET` | a long random string — see below |

   For `CRM_JWT_SECRET`, you need something long and random. If you have
   no easy way to generate one, use this (it's random enough for this
   purpose): mash your keyboard for 40+ characters, mixing letters,
   numbers, and symbols, and paste that in. Don't reuse a real password.

6. Click **Create Web Service**.
7. Watch the deploy log. The first deploy takes a few minutes (it's
   running `npm install`, building the React app, then starting the
   server). When it says something like "Agency CRM (cloud edition)
   listening on port ...", it's live.
8. Click the URL at the top of the page (something like
   `https://agency-crm.onrender.com`) — that's your app, online, right now.

## Step 4 — Log in and lock it down

1. Open your new URL. Log in with:
   - **Admin:** `admin` / `admin123`
   - **Staff:** `staff` / `staff123`
2. **Change both passwords immediately** — user menu (top right) →
   Change password. Anyone who finds your URL and guesses these defaults
   gets in otherwise.
3. Go to **Settings** and fill in your real business info — this appears
   on generated invoices.
4. Go to **Staff Accounts** and create real accounts for your actual team,
   then deactivate or repurpose the sample `staff` account.

Share the URL with your team. Whoever logs in, on whatever device,
sees the same live data.

## Step 5 — About file uploads (read this before you rely on it)

Render's disk is **wiped every time the app redeploys** (a code update, a
restart, etc.) unless you attach a **persistent disk**. That's a paid
add-on (a few dollars a month depending on size) under your service's
**Settings → Disks** in the Render dashboard — mount it at `/var/data` and
set the environment variable `CRM_UPLOADS_DIR=/var/data/uploads`.

Until you do that, contracts/scripts/audio/video files you upload will
**disappear the next time the app redeploys**. Everything else (clients,
projects, payments, invoices) is safe in the Neon database regardless —
this only affects the actual uploaded file contents.

If you don't expect to use file uploads heavily, you can skip this for
now and add it later — nothing else depends on it.

## Step 6 — A custom domain (optional)

Render's free tier includes free custom domain support. In your
service's **Settings → Custom Domains**, add your domain and follow the
DNS instructions Render gives you (usually a CNAME record at your domain
registrar). This typically takes 15 minutes to a few hours to take effect.

## Updating the app later

Whenever I (or you) make changes to the code: re-upload the changed files
to the same GitHub repository (same drag-and-drop process, or `git push`
if using the command line) — Render automatically redeploys on every
push to the `main` branch. No need to repeat the Render setup steps.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Deploy fails with a Postgres connection error | Double check `DATABASE_URL` was pasted completely and correctly, including `?sslmode=require` at the end |
| App deploys but shows a blank page | Check the build log for errors in `npm run build:client`; make sure `client/` was actually uploaded (not just `server/`) |
| "CRM_JWT_SECRET is not set" in the logs | Add that environment variable in Render and redeploy |
| First request after idle takes ~30-60 seconds | Normal on the free tier — it "sleeps" after 15 minutes idle. Upgrade the instance type to avoid this |
| Uploaded files vanish after a redeploy | Expected without a persistent disk — see Step 5 |
| Login works but says "Invalid or expired session" right after | Clear your browser's local storage for the site and log in again — can happen if `CRM_JWT_SECRET` changed since you last logged in |

## What this costs

| | Free | Always-on, no sleep |
|---|---|---|
| Render web service | $0/month (sleeps after 15 min idle) | ~$7/month |
| Neon database | $0/month | $0/month (free tier is generous enough for a small CRM) |
| File upload persistence | not included | a few $/month for a small persistent disk |

So: genuinely $0/month to try this for real, with the option to spend
~$7-10/month once you're sure it's worth keeping the lights on 24/7.
