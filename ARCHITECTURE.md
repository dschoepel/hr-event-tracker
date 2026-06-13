# Architecture — hr-event-tracker

## Overview
Tachycardia event detection from cycling GPX files

**Tier**: <!-- 1 (SQLite) | 2 (PostgreSQL + Auth.js) | 3 (Supabase) -->
**UI**: <!-- Ant Design v6 | Tailwind CSS -->

## Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 15+ App Router |
| UI | <!-- Ant Design v6 / Tailwind CSS --> |
| Database | <!-- SQLite (node:sqlite) / PostgreSQL + Drizzle / Supabase --> |
| Auth | <!-- None / Auth.js v5 / Supabase GoTrue --> |
| Hosting | Self-hosted VPS (Docker) |
| CI/CD | GitHub Actions → GHCR |

## Project Structure
```
app/              Next.js App Router pages and API routes
components/       Shared UI components
contexts/         React context providers (ThemeContext)
lib/              DB client, auth config, API helpers
deploy/           Production Docker compose, deploy script, SWAG maintenance page
scripts/          setup.js (template initialization)
.github/          GitHub Actions workflows
```

## Database Schema
<!-- Document your tables here as you add them -->

## Data Flow
<!-- Describe key user flows and how data moves through the system -->

## Environment Variables
See `.env.example` and `deploy/.env.production.example`.

## Deployment
1. Push a version tag: `git tag vX.Y.Z && git push --tags`
2. GitHub Actions builds and pushes image to GHCR
3. Run `/deploy` skill or manually: `ssh vps './deploy/scripts/deploy.sh vX.Y.Z'`
