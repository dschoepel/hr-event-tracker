# HR Event Tracker

Detects and logs unusual heart-rate episodes in cycling workouts. Upload a ride's
GPX file. The app scans the heart-rate stream for sudden spikes, groups them by ride and
month for review, and produces a report you can print, download as a PDF, or
share with your doctor through a time-limited, read-only link.

The app records *what happened*: sudden HR jumps and how long they lasted. It
does not diagnose. All wording is deliberately neutral ("episode").

## What it does

- **GPX upload and automatic detection.** Upload a ride, and the app parses the
  HR stream (and power, if present) and flags episodes where:
  - HR jumps by at least 60 bpm within a short interval
  - the heart rate just before the jump was at least 50 bpm (filters out sensor artifacts)
  - HR then drops by at least 30 bpm, showing the episode ended rather than
    sustained effort

  Episodes within 60 seconds of each other are merged into one. All three
  thresholds can be changed in Settings. Re-uploading the same ride is detected
  and you're asked before it's stored again.
- **Event History.** Episodes are grouped by month and ride, with summary stats,
  a monthly frequency chart, and rides that had more than one episode called
  out. Export everything as CSV or JSON.
- **Episode detail.** An HR (and power) chart around each episode. Confirm or
  reject it, add notes, and link an ECG recording from a separate monitor, for
  example a Frontier X2.
- **Doctor report.** A summary of confirmed episodes with an explanation of how
  the data was collected and the detection criteria. It includes summary stats,
  an episodes-by-month table, and the full episode log. Filter by date range,
  switch between miles/feet and km/m, print it, or download a PDF.
- **Share access.** Create a share link that expires after 3 to 90 days. Anyone
  with the link sees the report and confirmed episodes read-only, with no
  settings, uploads or editing. You can revoke a link at any time, and it stops
  working immediately.
- **Re-run detection.** Raw HR data is kept, so after changing thresholds you
  can re-run detection on any ride without re-uploading it, and recalculate
  ride stats (distance, climbing, average HR).
- **Works on phones.** Below 768px, tables become stacked cards, so nothing
  scrolls sideways.

## Tech

Next.js 15 (App Router), React 19, Ant Design v6, Recharts. Data is stored in
SQLite using Node's built-in `node:sqlite`. PDFs are rendered with
puppeteer-core and a local Chromium. Access control is a single owner password
plus signed share-link cookies. See `ARCHITECTURE.md` for the schema, data flows
and detection algorithm.

## Development

```bash
npm install
node scripts/hash-password.js '<your password>'   # prints OWNER_PASSWORD_HASH
```

Create `.env.local`:

```bash
SESSION_SECRET=<output of: openssl rand -base64 32>
OWNER_PASSWORD_HASH=<output of the hash-password script>
# Optional:
# DB_PATH=data/hr_events.db
# GPX_PATH=data/gpx
# PUPPETEER_EXECUTABLE_PATH=<path to Chrome/Chromium, for PDF download>
```

```bash
npm run dev    # http://localhost:3000
```

The SQLite database and tables are created on first start. Schema changes are
applied automatically on startup.

Don't run `npm run build` while `npm run dev` is running. Both write to `.next`,
and the dev server will serve stale code until it's restarted.

## Production

Pushing a version tag triggers GitHub Actions, which builds the Docker image and
pushes it to GHCR. Then redeploy the `hr-event-tracker` stack in Dockhand: it
pulls the new image, recreates the container, and polls the healthcheck.

The production compose file and nginx config live in the separate
`schoepels-services` repo. Secrets (`SESSION_SECRET`, `OWNER_PASSWORD_HASH`) are
set in Dockhand's Environment Variables panel. See `ARCHITECTURE.md` →
Deployment.

## Versioning

The version is tracked in `VERSION.md` and shown in the app footer. Use the
`/release` skill in Claude Code to bump the version, update `CHANGELOG.md` and
`RELEASE.md`, tag, and push.
