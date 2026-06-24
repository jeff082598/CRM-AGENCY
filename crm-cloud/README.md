# Agency CRM — Cloud Edition

The online, shared version: your whole team logs into one URL and sees
the same live data, in real time. Same features as the desktop edition
(leads, clients, projects, tasks, payments, invoices with PDF, files,
dashboard, reports, settings, staff accounts, RBAC) — just running on a
real server with a real shared PostgreSQL database instead of a local
SQLite file.

## Get this online (no command line required)

👉 **Start here: [`docs/DEPLOY_RENDER_NEON.md`](docs/DEPLOY_RENDER_NEON.md)**

That walks through everything: a free database (Neon), free hosting
(Render), and exactly what to click. Total cost to start: $0/month.

## What changed from the desktop edition

- **Time Clock / Attendance (new):** every staff member gets a "Time Clock"
  page with just a Clock In / Clock Out button and a read-only history of
  their own hours — they cannot edit a recorded time themselves, by
  design. Admins get an "Attendance" page showing everyone's hours, with
  full edit/add/delete control, a green badge once a day's total hours
  meet your configured target, and a red badge with the exact number of
  minutes late based on a shift-start-time you set in Settings.
- **Database:** PostgreSQL (shared, lives on a server) instead of SQLite
  (local file, one computer only). All the same data, same relationships
  — just upgraded to handle multiple people reading/writing at once.
- **No Electron.** This runs as a normal website in a browser, not a
  desktop app you install. The React frontend is unchanged — it's the
  same interface, just reached via a URL instead of double-clicking an
  icon.
- **Backup/restore format changed.** The desktop edition backs up by
  copying the raw SQLite file. This edition exports/imports a JSON dump
  of every table instead (Settings → Download/Restore Backup) — same
  idea, different mechanism, because there's no single file to copy
  anymore.
- **File uploads need a bit of attention.** See
  [`docs/DEPLOY_RENDER_NEON.md`](docs/DEPLOY_RENDER_NEON.md) Step 5 — by
  default, uploaded files don't survive a redeploy unless you attach a
  small persistent disk. This is a real, common gotcha with cloud hosting
  in general, not something specific to how I built this.
- **Required JWT secret.** The desktop edition had a safe-enough default
  signing secret since it never left your computer. This edition refuses
  to start without `CRM_JWT_SECRET` set, because it's now reachable from
  the internet.

## Local development

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and CRM_JWT_SECRET
npm run dev
```

This starts the API (nodemon, auto-restarts on changes) and the React
dev server together. Visit http://localhost:5173.

You'll need *some* Postgres database to point `DATABASE_URL` at, even for
local development — the easiest is to just create a free Neon database
(Step 1 of the deploy guide) and use it for local dev too. There's no
need to install Postgres on your own machine.

## Project structure

```
crm-cloud/
├── server/             # Express API
│   ├── db/              # schema.sql (Postgres), database.js, seed.js
│   ├── routes/          # one file per resource
│   ├── middleware/       # auth (JWT), RBAC, error handling
│   └── utils/             # PDF generation, notifications, activity log
├── client/             # React + Vite + Tailwind frontend (same UI as desktop edition)
├── docs/
│   └── DEPLOY_RENDER_NEON.md
└── check-queries.js    # dev tool — verifies SQL placeholder/param counts match
```

## A note on how this was built

I wrote and syntax-checked every file in this project, and ran a custom
static analyzer (`check-queries.js`) against all 150+ database calls to
catch mismatched query parameters — a common bug class when porting from
one database driver to another. I don't have a PostgreSQL server or
internet access in the environment I built this in, so **I was not able
to actually run this against a live database before handing it to you.**
The patterns used here are standard, well-documented `node-postgres`
usage, but the real test is your first deploy. If something breaks,
paste me the error from Render's logs and I'll fix it fast.
