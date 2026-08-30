# Architecture — hr-event-tracker

## Overview

HR Event Tracker detects and logs unusual heart rate episodes from cycling workout GPX files. It parses HR streams, runs an automatic spike-detection algorithm, and provides a review UI for confirming events, adding notes, and linking ECG recordings. Confirmed events can be exported to CSV/JSON or rendered as a doctor-shareable PDF report.

**Tier**: 1 (SQLite, custom cookie-based auth)
**UI**: Ant Design v6
**Version**: see `VERSION.md`

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router (`'use client'` components) |
| UI | Ant Design v6, Recharts (HR/power chart) |
| Database | SQLite via `node:sqlite` (Node.js built-in, no ORM) |
| PDF generation | Puppeteer Core + system Chromium (Alpine) |
| Auth | Single owner password + time-limited doctor share links (`lib/auth.js`, signed cookies, no session store) |
| Hosting | Self-hosted VPS (Docker, Alpine-based image) |
| CI/CD | GitHub Actions → GHCR → deploy script over SSH |

---

## Project Structure

```
app/
  layout.jsx                  Root layout (ThemeProvider, AntDThemeProvider, nav, footer)
  page.jsx                    Redirects / → /events
  login/page.jsx              Owner password login
  share/[token]/route.js      Public — redeems a doctor share link into a viewer cookie
  events/
    page.jsx                  Event History — main list view (grouped by month → ride) — owner only
    [id]/page.jsx             Event detail — HR/power chart, notes, confirmation (read-only for viewers)
  report/
    page.jsx                  Doctor report — live preview with date range filter — owner + viewer
    report.module.css         Print-optimised styles for the report
  settings/
    page.jsx                  Settings — Detection, GPX Files, Report, Share Access tabs — owner only
  api/
    health/route.js           GET /api/health — liveness probe (public)
    auth/
      login/route.js          POST — verify owner password, set owner cookie
      logout/route.js         POST — clear session cookies
      session/route.js        GET — current role (owner | viewer | null)
    share-links/
      route.js                GET (list) | POST (create) — owner only
      [id]/route.js           DELETE — revoke a link — owner only
    events/
      route.js                GET (list, filterable) | POST (manual create) — viewers see confirmed only
      [id]/route.js           GET | PATCH (confirm, notes, frontier ref) | DELETE — PATCH/DELETE owner only
      export/route.js         GET /api/events/export?format=csv|json — owner only
    gpx/
      route.js                POST (upload + parse + detect) | GET (file list) — owner only
      [id]/route.js           DELETE (file + cascade events) — owner only
      [id]/rerun/route.js     POST — re-run detection from saved HR stream — owner only
    settings/
      route.js                GET (any session) | PUT (detection thresholds + report fields) — owner only
    report/
      pdf/route.js            GET — server-side PDF via Puppeteer — owner + viewer

middleware.js                 Edge-safe route gate — redirects to /login (or scopes viewers to
                               /report and /events/<id>) based on cookie presence only; API routes
                               do the real verification (see lib/auth.js)

components/
  ResponsiveNav.jsx           Top nav bar (desktop Menu + mobile Drawer), role-aware, sign-out
  AntDThemeProvider.jsx       ConfigProvider + App wrapper (enables useApp())
  AppFooter.jsx               Version footer

contexts/
  ThemeContext.jsx            Light/dark theme toggle

lib/
  db.js                       SQLite singleton, schema init, getSettings()
  auth.js                     Signed session cookies + share-link verification (Next.js route handlers)
  passwordHash.js             Owner password hashing (node:crypto only — no Next.js dependency,
                               so scripts/hash-password.js can run under plain `node`)
  gpxParser.js                GPX → HR/power stream parser + detectSpikes()
  reportTemplate.js           Self-contained HTML builder for Puppeteer PDF

scripts/
  hash-password.js            CLI: generates OWNER_PASSWORD_HASH from a plaintext password

deploy/
  docker-compose.yml          Production compose — deployed as a Dockhand stack (see "Deployment" below)
  nginx/                      SWAG/nginx config
  swag/                       Maintenance page shown by the reverse proxy during upgrades

.github/workflows/            GitHub Actions CI (build + push GHCR image)
```

---

## Database Schema

All tables live in a single SQLite file (default: `data/hr_events.db`, overridable via `DB_PATH`). Foreign keys are enforced; cascading deletes remove dependent rows automatically.

### `gpx_files`
One row per uploaded GPX file.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `filename` | TEXT | Original filename (or `… (duplicate).gpx` for forced re-uploads) |
| `original_path` | TEXT | Absolute path to saved `.gpx` file on disk |
| `uploaded_at` | TEXT | UTC datetime |
| `ride_name` | TEXT | Extracted from GPX `<name>` tag |
| `ride_date` | TEXT | YYYY-MM-DD, from GPX start time |
| `ride_start_time` | TEXT | ISO 8601 UTC — used as duplicate key |
| `duration_seconds` | INTEGER | Total ride duration |

### `hr_streams`
Raw HR (and optionally power) data for each ride, stored as JSON. Retained for rerun detection without re-uploading.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `gpx_file_id` | INTEGER FK → `gpx_files` | CASCADE DELETE |
| `stream_json` | TEXT | `[{ t, hr, power? }, …]` array |

### `hr_events`
One row per detected or manually created HR episode.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `gpx_file_id` | INTEGER FK → `gpx_files` | CASCADE DELETE |
| `start_time_seconds` | REAL | Seconds from ride start |
| `peak_hr` | INTEGER | bpm |
| `peak_time_seconds` | REAL | |
| `baseline_before` | INTEGER | HR just before the jump |
| `hr_after_drop` | REAL | HR once recovery confirmed |
| `drop_time_seconds` | REAL | |
| `duration_seconds` | REAL | Time from jump to recovery |
| `jump_magnitude` | INTEGER | `peak_hr − baseline_before` |
| `drop_magnitude` | INTEGER | `peak_hr − hr_after_drop` |
| `detection_method` | TEXT | `'auto'` or `'manual'` |
| `confirmed` | INTEGER | 0 / 1 boolean |
| `notes` | TEXT | Free-text user notes |
| `frontier_session_ref` | TEXT | URL to Frontier X2 ECG session |
| `data_truncated` | INTEGER | 1 if HR stream ended before full recovery |
| `created_at` | TEXT | UTC datetime |

### `settings`
Key-value store for user-configurable values.

| Key | Default | Description |
|---|---|---|
| `detection.jumpThreshold` | `60` | Min HR jump (bpm) to flag an event |
| `detection.minBaselineHr` | `50` | Ignore events where resting HR was below this |
| `detection.dropRequired` | `30` | Min HR drop from peak to confirm recovery |
| `report.activityType` | `Indoor cycling (Zwift)` | Shown in report narrative |
| `report.hrDevice` | `Frontier X2` | Device name in report and ECG column header |
| `report.appUrl` | _(empty)_ | App URL shown in report footer |

### `share_links`
Read-only doctor/health-professional access links, created from Settings → Share Access.
A link works any number of times until it expires or is revoked — not a one-time code.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `token` | TEXT UNIQUE | Random 24-byte token, embedded in `/share/{token}` |
| `label` | TEXT | Optional note (e.g. "Dr. Smith — Aug visit") |
| `created_at` | TEXT | UTC datetime |
| `expires_at` | TEXT | ISO datetime; link is inert after this |
| `revoked_at` | TEXT | Set when manually revoked; inert immediately (checked on every request, not cached in the cookie) |

---

## Auth & Access Control (`lib/auth.js`, `middleware.js`)

Two roles, no user table — just one owner and any number of share links:

- **owner** — unlocked at `/login` with a single password (`OWNER_PASSWORD_HASH`,
  generated via `scripts/hash-password.js`). Full read/write, ~30-day session.
- **viewer** — unlocked by visiting a `/share/{token}` link created from
  Settings → Share Access. Read-only, confirmed episodes only, scoped to the
  Report page and individual event-detail pages. The link is reusable until
  it expires or is revoked — not a one-time code.

Both roles are stored as signed (HMAC-SHA256), httpOnly cookies — `hret_owner`
and `hret_viewer` — with no server-side session store. The viewer cookie only
carries a `share_links.id`; every request re-checks that row's `revoked_at`/
`expires_at`, so revoking a link from Settings takes effect immediately even
for a browser that already has the cookie.

`middleware.js` runs on the Edge runtime and only checks cookie *presence* to
redirect page navigation (`/login`, or a viewer hitting an owner-only page
gets bounced to `/report`). It does no signature verification — that needs
`node:crypto`, which isn't available at the edge. The actual security
boundary is inside each API route handler (Node runtime), via `getSession()`
/ `requireOwner()` from `lib/auth.js`.

---

## Key Data Flows

### GPX Upload & Detection
1. Client POSTs multipart form to `POST /api/gpx`
2. `parseGpx()` extracts HR stream + metadata from the GPX buffer
3. Duplicate check: if `ride_start_time` already exists in `gpx_files`, return 409
4. `detectSpikes()` runs against the stream with thresholds from `getSettings()`
5. If 0 events and `?save` not set, return `{ noEvents: true }` — client prompts the user
6. On save: insert `gpx_files` row → write raw `.gpx` to `GPX_DIR/{id}.gpx` → insert `hr_streams` row → insert `hr_events` rows

### Rerun Detection
1. Client POSTs to `POST /api/gpx/{id}/rerun`
2. Route reads `hr_streams.stream_json` for that file
3. Deletes existing `hr_events` for the file
4. Runs `detectSpikes()` with fresh settings → re-inserts events

### PDF Report Generation
1. Client GETs `/api/report/pdf?start=YYYY-MM-DD&end=YYYY-MM-DD`
2. Route queries confirmed events filtered by date range
3. `buildReportHtml(events, settings)` produces a self-contained HTML string
4. Puppeteer launches headless Chromium, calls `page.setContent(html)`
5. `page.pdf()` renders to A4 with a custom footer (page numbers + date)
6. PDF buffer returned as `application/pdf` attachment

---

## Detection Algorithm (`lib/gpxParser.js` → `detectSpikes`)

Scans the HR stream sample-by-sample looking for sudden jumps:

1. **Jump**: HR rises by ≥ `jumpThreshold` bpm from a rolling baseline
2. **Baseline guard**: The pre-jump HR must be ≥ `minBaselineHr` bpm (filters artifact)
3. **Recovery**: After the peak, scan forward until HR drops ≥ `dropRequired` bpm from peak
4. **Deduplication**: Events within 60 s of each other are merged into one
5. **Truncation flag**: If the stream ends before recovery is observed, `data_truncated = 1`

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `data/hr_events.db` | SQLite database file path |
| `GPX_PATH` | `<DB_PATH dir>/gpx/` | Directory where raw GPX files are stored |
| `PUPPETEER_EXECUTABLE_PATH` | _(auto-detected)_ | Path to Chromium/Chrome for PDF generation |
| `PORT` | `3000` | Next.js server port |
| `HOSTNAME` | `0.0.0.0` | Bind address (must be `0.0.0.0` in Docker) |
| `NEXT_PUBLIC_APP_VERSION` | _(from VERSION.md at build time)_ | Shown in footer |
| `SESSION_SECRET` | _(none — required)_ | Signs owner + viewer session cookies. Generate with `openssl rand -base64 32` |
| `OWNER_PASSWORD_HASH` | _(none — required)_ | Output of `npm run auth:hash-password -- '<password>'` |

---

## Deployment

Deployed as a [Dockhand](https://dockhand.dev)-managed stack — Dockhand owns
pulling the image, recreating the container, and polling its healthcheck.
There is no SSH deploy script or `/deploy` skill; those were retired once
Dockhand could do this work itself.

1. `/release` bumps `VERSION.md`, updates `CHANGELOG.md`/`RELEASE.md`, tags,
   and pushes — `git push --tags` triggers GitHub Actions, which builds the
   image and pushes it to GHCR.
2. Once the Actions run is green, redeploy the `hr-event-tracker` stack from
   Dockhand's UI. It pulls `ghcr.io/dschoepel/hr-event-tracker:latest`,
   recreates the container, and waits on the compose healthcheck
   (`GET /api/health`) itself.
3. The container mounts two host volumes:
   - `/data/hr-event-tracker/data` → `/app/data` (SQLite database)
   - `/data/hr-event-tracker/gpx` → `/app/gpx` (saved GPX files)

### Secrets delivery: Dockhand's Environment Variables panel, not a host file or the image

`SESSION_SECRET`, `OWNER_PASSWORD_HASH`, and any future runtime secret are
never baked into the Docker image or committed to the repo — the image is
built by GitHub Actions from the public repo, so anything in the repo or the
image is effectively public. They're set instead in Dockhand's "Environment
Variables" panel for this stack (mask `SESSION_SECRET` and
`OWNER_PASSWORD_HASH` there), and `deploy/docker-compose.yml`'s `environment:`
block references them as `${VAR_NAME}` so Dockhand interpolates real values
into the compose file before it creates the container. **Every var the `app`
service needs must have a corresponding `${VAR_NAME}` line in that
`environment:` block** — a value existing in Dockhand's panel but not
referenced there does nothing; recreating the stack won't pick it up either,
since it was never wired in to begin with. Current list: `APP_PORT`, `DB_PATH`,
`GPX_PATH`, `HOSTNAME`, `PUID`, `PGID`, `TZ`, `SESSION_SECRET`,
`OWNER_PASSWORD_HASH` (see the Environment Variables table above for what each
does).

This also matters because `output: 'standalone'` (`next.config.mjs`) produces
a plain `server.js` that reads `process.env` directly — it does **not** do
Next's usual `.env`/`.env.production` auto-loading, so a `.env` file dropped
inside the image would never be read anyway. The vars have to arrive as real
process environment variables before `node server.js` starts, which is what
Dockhand's interpolation does at container-creation time.
