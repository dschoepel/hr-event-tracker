# __APP_NAME__

__APP_DESCRIPTION__

## Development

```bash
npm install
cp .env.example .env.local   # fill in your values

# Tier 1 (SQLite): just start the app
npm run dev

# Tier 2 (PostgreSQL): start DB first, then the app
docker-compose up db -d
npm run dev

# Tier 3 (Supabase): start the stack, then the app
docker-compose up -d         # starts all 8 Supabase services
npm run dev
```

App runs at http://localhost:3000

## Database migrations (Tier 2)

```bash
npm run db:generate    # generate migration from schema changes
npm run db:migrate     # apply migrations
npm run db:studio      # open Drizzle Studio
```

## Production

Triggered by pushing a version tag:
```bash
git tag v1.0.0
git push --tags
```

GitHub Actions builds the Docker image and pushes to GHCR.
Then run `/deploy` in Claude Code, or manually:
```bash
ssh user@vps './deploy/scripts/deploy.sh v1.0.0'
```

## Environment Variables

See `.env.example` and `deploy/.env.production.example`.

## Versioning

Version is tracked in `VERSION.md` and displayed in the app footer.
Use the `/release` skill in Claude Code to bump the version and update the changelog.
