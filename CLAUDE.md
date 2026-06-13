# CLAUDE.md — __APP_NAME__

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
- Push tag → GitHub Actions builds GHCR image → run `/deploy`
- Deploy script: `deploy/scripts/deploy.sh` — handles maintenance mode + healthcheck
- Do NOT push without a version tag if the image needs to deploy
