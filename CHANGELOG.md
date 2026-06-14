# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.3] - 2026-06-14
### Fixed
- Container healthcheck now passes — Next.js was binding only to the container's internal IP (because Docker sets HOSTNAME to the container ID). Explicitly setting HOSTNAME=0.0.0.0 in the image makes the server bind to all interfaces as expected.

## [1.0.2] - 2026-06-14
### Fixed
- SVT event duration no longer extends into normal post-event riding — settle scan stops once HR recovers to within 20 bpm of onset HR
- Months in event history stay expanded when navigating back from an event detail page

### Added
- Returning from an event detail page now highlights and scrolls to the event you just viewed in the history list

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

## [1.0.0] - 2026-06-14
### Added
- GPX file upload with HR spike detection (auto-detection algorithm)
- Event history page grouped by month → ride → events, expandable at each level
- Event detail page with HR + power chart (smoothed 30s rolling average for power)
- Narrative event summary: "HR jumped X bpm from Y to Z bpm and dropped..."
- Events by Month bar chart and Events by Ride summary cards
- Ride name and date extracted from GPX metadata
- Power data extracted from GPX extensions and displayed as filled area chart
- FaHeartbeat icon in navbar and SVG favicon

### Changed
- Detection algorithm uses peak-vs-baseline threshold (not trigger-vs-baseline) to catch gradual-onset SVT
- Settle scan searches full remaining stream for true HR recovery point
- Sensor dropout values (HR < 20) filtered from stream and settle scan
- data_truncated flag: if HR never recovers to near onset, recovery estimated as onset HR
- Upload moved into Event History page; home route redirects to /events
- Date/Time shows actual event time (ride_start_time + start_time_seconds)
- "Baseline" relabelled "HR at Onset"; Method column removed from display
- Duration formatted as Xm Ys throughout
- antd message() uses App context (fixes console warning)
- suppressHydrationWarning on body (fixes browser extension hydration mismatch)
