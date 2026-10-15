# CLAUDE.md — hr-event-tracker

This file provides guidance to Claude Code when working in this repository.

## Quick Reference
- **Stack**: Next.js 15 (App Router) + React 19, Ant Design v6, SQLite via Node's built-in `node:sqlite` (Tier 1 of the app-template)
- **Version**: see `VERSION.md`
- **Dev**: `npm run dev` (port 3000)

## Commands
```bash
npm run dev                                   # Start development server
npm run build                                 # Production build
node scripts/hash-password.js '<password>'    # Generate OWNER_PASSWORD_HASH
```
- **Don't run `npm run build` while `npm run dev` is running** — both use `.next`, and the dev server then serves stale/mixed code until restarted. Check `curl localhost:3000` first; if it's up, syntax-check instead (e.g. Next's SWC `transform` from `next/dist/build/swc`) or ask the user to restart dev after
- `npm run lint` is not usable — ESLint was never configured (`next lint` stops at an interactive setup prompt)
- The `db:*` scripts (Drizzle) and the postgres service in `docker-compose.yml` are unused app-template leftovers

## Key Files
- `lib/db.js` — SQLite singleton (`DB_PATH`, GPX files under `GPX_PATH`); applies `ALTER TABLE` migrations on startup. `lastInsertRowid` may be a BigInt — use `Number()` before JSON
- `lib/auth.js` — custom HMAC-signed cookie auth (not Auth.js). Two roles: **owner** (password checked against `OWNER_PASSWORD_HASH`, signed with `SESSION_SECRET`) and **viewer** (doctor, read-only, via share link; revocation checked against `share_links` on every request). API routes are the real security boundary
- `middleware.js` — edge-safe cookie-*presence* gate only; viewers may open `/report` and `/events/[id]`
- `app/share/[token]/route.js` — redeems a share link (Settings → Share Access), sets the viewer cookie, redirects to `/report`
- `lib/publicUrl.js` — builds redirect URLs from the public host behind the nginx proxy (see `ARCHITECTURE.md` → Deployment)
- `lib/gpxParser.js` — GPX parsing + HR episode detection
- `app/report/page.jsx` — on-screen/printable report; `lib/reportTemplate.js` + `app/api/report/pdf/route.js` — downloadable PDF (HTML template rendered by puppeteer-core; needs Chromium, `PUPPETEER_EXECUTABLE_PATH`). Keep the two report renderings in step
- `next.config.mjs` — reads `VERSION.md` → `NEXT_PUBLIC_APP_VERSION` at build time

## Mobile layout
- Breakpoint is **768px** (AntD `md`). Below it, wide tables render as stacked cards instead: `Grid.useBreakpoint().md === false` in `app/events/page.jsx` and `app/settings/page.jsx`; CSS-only cards (`data-label` + `::before`) for the report episode log in `report.module.css`
- Scope small-screen CSS to `@media screen and (max-width: 768px)` — an A4 print page is ~680px wide and would otherwise pick up the phone layout
- App gutters come from `.app-main` in `app/globals.css`

## Versioning
- `VERSION.md` contains the current version (single line, e.g. `v1.2.0`)
- Use `/release` skill to bump version, update CHANGELOG, tag, and push
- Footer reads `process.env.NEXT_PUBLIC_APP_VERSION` (baked in at build time)

## Documentation Files to Maintain
- `CHANGELOG.md` — update `[Unreleased]` section as features are added
- `ARCHITECTURE.md` — update schema section when DB tables change
- `RELEASE.md` — user-facing release notes; `/release` prepends each new release

## Deployment
- Push tag → GitHub Actions builds GHCR image → redeploy the `hr-event-tracker` stack in Dockhand
- Dockhand pulls the image, recreates the container, and polls the compose healthcheck itself — no SSH script, no `/deploy` skill (retired)
- The production compose file is **not in this repo** — it lives in the separate `schoepels-services` repo at `jupiter-r640/hr-event-tracker/docker-compose.yml` (nginx config: `earth/nginx/sites-available/hr-event-tracker.schoepels.com.conf`) and pulls the `latest` image tag, so a normal release needs no compose change. Only update it there when the deployment shape changes (new env vars, volumes, services)
- DB schema changes need no manual deploy step — `lib/db.js` applies `ALTER TABLE` migrations on startup
- Secrets (`SESSION_SECRET`, `OWNER_PASSWORD_HASH`, etc.) live in Dockhand's Environment Variables panel, referenced from that compose file's `environment:` block as `${VAR_NAME}` — see `ARCHITECTURE.md` → Deployment
- Do NOT push without a version tag if the image needs to deploy
