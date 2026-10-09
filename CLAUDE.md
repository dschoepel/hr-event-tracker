# CLAUDE.md — hr-event-tracker

This file provides guidance to Claude Code when working in this repository.

## Quick Reference
- **Tier**: <!-- 1 (SQLite) | 2 (PostgreSQL + Auth.js) | 3 (Supabase) -->
- **UI**: <!-- Ant Design v6 | Tailwind CSS -->
- **Version**: see `VERSION.md`
- **Dev**: `npm run dev` (port 3000)

## Commands
```bash
npm run dev           # Start development server
npm run build         # Production build
npm run lint          # ESLint

# Tier 2 only:
npm run db:generate   # Generate Drizzle migration from schema
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Drizzle Studio (schema browser)

# Start supporting services (Tier 2/3):
docker-compose up db -d     # Tier 2: postgres only
docker-compose up -d        # Tier 3: full Supabase stack
```

## Key Files
- `lib/db.js` — SQLite singleton (Tier 1). `lastInsertRowid` returns BigInt — use `Number()` before JSON
- `lib/drizzle/` — Drizzle client + schema (Tier 2)
- `lib/supabase.js` — Supabase singleton clients (Tier 3)
- `lib/auth.js` — Auth.js v5 full config (Tier 2/3)
- `lib/auth.config.js` — Edge-compatible config used by middleware
- `next.config.mjs` — reads `VERSION.md` → `NEXT_PUBLIC_APP_VERSION` at build time

## Versioning
- `VERSION.md` contains the current version (single line, e.g. `v1.2.0`)
- Use `/release` skill to bump version, update CHANGELOG, tag, and push
- Footer reads `process.env.NEXT_PUBLIC_APP_VERSION` (baked in at build time)

## Documentation Files to Maintain
- `CHANGELOG.md` — update `[Unreleased]` section as features are added
- `ARCHITECTURE.md` — update schema section when DB tables change
- `RELEASE.md` — overwritten by `/release` skill with current release notes

## Deployment
- Push tag → GitHub Actions builds GHCR image → redeploy the `hr-event-tracker` stack in Dockhand
- Dockhand pulls the image, recreates the container, and polls the compose healthcheck itself — no SSH script, no `/deploy` skill (retired)
- The production compose file is **not in this repo** — it lives in the separate `schoepels-services` repo at `jupiter-r640/hr-event-tracker/docker-compose.yml` (nginx config: `earth/nginx/sites-available/hr-event-tracker.schoepels.com.conf`) and pulls the `latest` image tag, so a normal release needs no compose change. Only update it there when the deployment shape changes (new env vars, volumes, services)
- DB schema changes need no manual deploy step — `lib/db.js` applies `ALTER TABLE` migrations on startup
- Secrets (`SESSION_SECRET`, `OWNER_PASSWORD_HASH`, etc.) live in Dockhand's Environment Variables panel, referenced from that compose file's `environment:` block as `${VAR_NAME}` — see `ARCHITECTURE.md` → Deployment
- Do NOT push without a version tag if the image needs to deploy
