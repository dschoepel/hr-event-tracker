## [1.0.1] - 2026-06-14
### Added
- Frontier X2 Session Ref: Open (new tab) and Preview (iframe) buttons via Space.Compact
- Preview iframe with loading spinner and Close toggle
- Chart loading spinner with description while Recharts renders
- Back to history link at top of event detail page

### Changed
- Confirmed column now shows for single-event rides in history table
- History ride table shows column headers (Confirmed, Actions)
- Chart x-axis formatted as M:SS / H:MM:SS instead of Xm Ys
- Deployment adapted for local LAN server with nginx reverse proxy
- deploy/docker-compose.yml: PUID/PGID support, SQLite data volume, no proxy_net
- deploy/scripts/deploy.sh: removed SWAG maintenance flag dependency
- SSH_PORT support in /deploy skill and .env.deploy.example
- nginx config added for hr-event-tracker.schoepels.com
