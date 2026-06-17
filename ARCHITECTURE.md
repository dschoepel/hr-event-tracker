# Architecture — hr-event-tracker

## Overview

HR Event Tracker detects and logs unusual heart rate episodes from cycling workout GPX files. It parses HR streams, runs an automatic spike-detection algorithm, and provides a review UI for confirming events, adding notes, and linking ECG recordings. Confirmed events can be exported to CSV/JSON or rendered as a doctor-shareable PDF report.

**Tier**: 1 (SQLite, no auth)
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
| Auth | None |
| Hosting | Self-hosted VPS (Docker, Alpine-based image) |
| CI/CD | GitHub Actions → GHCR → deploy script over SSH |

---

## Project Structure

```
app/
  layout.jsx                  Root layout (ThemeProvider, AntDThemeProvider, nav, footer)
  page.jsx                    Redirects / → /events
  events/
    page.jsx                  Event History — main list view (grouped by month → ride)
    [id]/page.jsx             Event detail — HR/power chart, notes, confirmation
  report/
    page.jsx                  Doctor report — live preview with date range filter
    report.module.css         Print-optimised styles for the report
  settings/
    page.jsx                  Settings — Detection, GPX Files, Report tabs
  api/
    health/route.js           GET /api/health — liveness probe
    events/
      route.js                GET (list, filterable) | POST (manual create)
      [id]/route.js           GET | PATCH (confirm, notes, frontier ref) | DELETE
      export/route.js         GET /api/events/export?format=csv|json
    gpx/
      route.js                POST (upload + parse + detect) | GET (file list)
      [id]/route.js           DELETE (file + cascade events)
      [id]/rerun/route.js     POST — re-run detection from saved HR stream
    settings/
      route.js                GET | PUT (detection thresholds + report fields)
    report/
      pdf/route.js            GET — server-side PDF via Puppeteer

components/
  ResponsiveNav.jsx           Top nav bar (desktop Menu + mobile Drawer)
  AntDThemeProvider.jsx       ConfigProvider + App wrapper (enables useApp())
  AppFooter.jsx               Version footer

contexts/
  ThemeContext.jsx            Light/dark theme toggle

lib/
  db.js                       SQLite singleton, schema init, getSettings()
  gpxParser.js                GPX → HR/power stream parser + detectSpikes()
  reportTemplate.js           Self-contained HTML builder for Puppeteer PDF

deploy/
  docker-compose.yml          Production compose (app + volume mounts)
  scripts/deploy.sh           Maintenance mode → pull image → healthcheck → go live
  nginx/                      SWAG/nginx config
  .env.production.example     Environment variable reference

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

---

## Deployment

1. Push a version tag: `git tag vX.Y.Z && git push --tags`
2. GitHub Actions builds the Docker image and pushes it to GHCR
3. Run `/deploy` (or manually): `ssh vps 'bash -s' < deploy/scripts/deploy.sh vX.Y.Z`
   - Enables maintenance page, pulls new image, starts container, runs healthcheck, disables maintenance page
4. The container mounts two host volumes:
   - `/data/hr-event-tracker/db` → `/app/data` (SQLite database)
   - `/data/hr-event-tracker/gpx` → `/app/gpx` (saved GPX files)
