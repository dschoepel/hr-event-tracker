## [1.1.1] - 2026-06-17

### Improvements
- The app no longer uses the term "SVT" anywhere in the interface. All references have been replaced with neutral language ("episode") that describes what you experienced without implying a specific diagnosis. The report page already used this language — the rest of the UI now matches.

---

## [1.1.0] - 2026-06-16

### What's New

- **Doctor-shareable PDF report.** A new Report page (`/report`) generates a formatted episode log you can share with your cardiologist. It includes a summary of stats, a monthly frequency chart, and a full episode table with orange highlights for long events, bold peak HR values ≥ 190 bpm, ECG recording links, and ordinal labels when a single ride contains multiple episodes. Hit **Download PDF** for a clean server-generated file with proper page numbers — no browser URL headers or print dialog required.

- **Date range filter on the report.** Pick a start and end date to scope the report to a specific period. The summary stats, monthly chart, and episode table all update live, and the downloaded PDF filename includes the selected dates.

- **GPX files are now saved to disk.** Uploaded GPX files are kept so they can be reprocessed later. A new **GPX Files** tab in Settings shows all uploaded files grouped by ride, lets you rerun spike detection with the current thresholds, and flags orphaned records (rides with no events and no file on disk) for easy cleanup.

- **Rerun detection.** After changing detection thresholds in Settings, use the Rerun action on any ride to re-analyse its saved HR stream without re-uploading the file.

- **Settings page.** Configure spike detection thresholds (jump size, minimum baseline HR, required drop) and report display fields (activity type, HR device name, app URL) in one place.

- **Duplicate upload detection.** Uploading the same activity a second time is now detected by ride start time. You'll be prompted to confirm before it's saved again.

- **No-events prompt.** When an uploaded ride has no detected events, you can choose to save it to history anyway (useful for reference) or discard it.

- **Data export.** Download your full event history as CSV or JSON from the Export button in Event History. Includes the Frontier X2 session reference URL.

- **Summary card.** The top of the Event History page now shows key stats — total events, confirmed episode count, average peak HR, and average duration. Rides with multiple events are listed in a collapsible section with a badge count.

- **Collapse All / Expand All.** Quickly collapse or expand all months in the Event History with one click.

- **Upload highlight.** After uploading a GPX file, the new ride is highlighted in the history list and scrolled into view automatically.

- **Expanded month state is remembered.** Navigating to an event detail page and coming back no longer collapses all the months you had open.

---

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
HR Event Tracker is a personal tool for recording and reviewing unusual heart rate episodes detected during cycling workouts.

### Features
- **GPX upload**: Import a ride file from Zwift or any GPS device. HR spike events are detected automatically.
- **Event history**: Browse all detected events grouped by month and ride, with expandable rows and event summaries.
- **Event detail**: View HR and power on a single chart with the event window highlighted. Includes a narrative summary ("HR jumped X bpm from Y to Z bpm…").
- **Ride metadata**: Ride name and date are read directly from the GPX file.
- **Power chart**: If your device records power, it's displayed as a filled area chart alongside HR.
- **Notes and confirmation**: Add notes, link a Frontier X2 ECG session, and mark events as confirmed.
