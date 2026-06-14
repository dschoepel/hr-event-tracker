# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
