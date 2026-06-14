## [1.0.3] - 2026-06-14

### Bug Fixes
- **Container health check is now green.** The app was reachable but Portainer was reporting it as unhealthy. The root cause: Docker automatically sets a `HOSTNAME` environment variable to the container ID, and Next.js was using that to bind the server to just the container's internal IP rather than all interfaces. The health check (which uses the loopback address) couldn't reach it. Fixed by explicitly telling the server to listen on all interfaces.

---

## [1.0.2] - 2026-06-14

### Bug Fixes
- **Event durations are now accurate.** Previously, the algorithm would scan the entire remaining ride to find the lowest HR after a spike, which caused it to pick up normal HR dips later in the ride and report inflated durations (e.g. 13 minutes instead of 2). The scan now stops as soon as HR has recovered to near the level it was at before the spike.
- **Event history stays expanded when you navigate back.** Months in the history list no longer collapse when you return from viewing an event detail page.

### Improvements
- When you return from an event detail page, the event you just viewed is highlighted in the history list and scrolled into view automatically.

---

## [1.0.1] - 2026-06-14
### What's New
- **Frontier X2 integration**: Paste a shared workout URL into the Frontier X2 Session Ref field and use the new **Open** button to launch it in a new tab, or **Preview** to view the session in a panel directly on the page.
- **Chart loading indicator**: A spinner with "Loading chart…" now appears while the HR/power graph is rendering, so the page no longer freezes silently.
- **Back to history** link added at the top of the event detail page — no more scrolling to the bottom to navigate back.

### Improvements
- The **Confirmed** status now appears for all events in the history list, not just rides with multiple events.
- Column headers (Confirmed, Actions) are now visible for all ride rows in the history table.
- Chart time axis now shows in **H:MM:SS** format (e.g. 1:02:13) instead of a mix of minutes and seconds.

---

## [1.0.0] - 2026-06-14
### Initial Release
HR Event Tracker is a personal tool for recording and reviewing supraventricular tachycardia (SVT) events detected during cycling workouts.

### Features
- **GPX upload**: Import a ride file from Zwift or any GPS device. HR spike events are detected automatically.
- **Event history**: Browse all detected events grouped by month and ride, with expandable rows and event summaries.
- **Event detail**: View HR and power on a single chart with the event window highlighted. Includes a narrative summary ("HR jumped X bpm from Y to Z bpm…").
- **Ride metadata**: Ride name and date are read directly from the GPX file.
- **Power chart**: If your device records power, it's displayed as a filled area chart alongside HR.
- **Notes and confirmation**: Add notes, link a Frontier X2 ECG session, and mark events as confirmed SVT.
