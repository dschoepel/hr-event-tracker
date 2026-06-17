/**
 * Builds a self-contained HTML string for the HR Episode Log report.
 * Used by /api/report/pdf to generate the PDF via Puppeteer.
 */

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']

function eventTime(r) {
  if (r.ride_start_time && r.start_time_seconds != null)
    return new Date(new Date(r.ride_start_time).getTime() + r.start_time_seconds * 1000)
  return r.created_at ? new Date(r.created_at + 'Z') : null
}

const fmtDate = dt =>
  dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

const fmtTime = dt =>
  dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

const fmtDur = s => {
  const sec = Math.round(s)
  return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function monthRange(events) {
  const times = events.map(e => eventTime(e)).filter(Boolean)
  if (!times.length) return []
  const minMs = Math.min(...times.map(t => t.getTime()))
  const maxMs = Math.max(...times.map(t => t.getTime()))
  const result = []
  let cur = new Date(new Date(minMs).getFullYear(), new Date(minMs).getMonth(), 1)
  const end = new Date(new Date(maxMs).getFullYear(), new Date(maxMs).getMonth(), 1)
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 7))
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return result
}

export function buildReportHtml(events, settings) {
  // ── Multi-event ordinal labels ──
  const groups = {}
  for (const e of events) {
    if (!groups[e.gpx_file_id]) groups[e.gpx_file_id] = []
    groups[e.gpx_file_id].push(e)
  }
  for (const g of Object.values(groups))
    g.sort((a, b) => (a.start_time_seconds ?? 0) - (b.start_time_seconds ?? 0))
  const eventLabels = {}
  for (const group of Object.values(groups))
    if (group.length >= 2)
      group.forEach((e, i) => { eventLabels[e.id] = `(${ORDINALS[i] ?? `${i + 1}th`} event)` })

  // ── Monthly frequency data ──
  const countMap = {}
  for (const e of events) {
    const t = eventTime(e)
    if (!t) continue
    const key = t.toISOString().slice(0, 7)
    countMap[key] = (countMap[key] || 0) + 1
  }
  const months = monthRange(events).map(key => ({
    key,
    label: new Date(key + '-15').toLocaleString('en-US', { month: 'short', year: 'numeric' }),
    count: countMap[key] ?? 0,
  }))
  const maxCount = Math.max(1, ...months.map(m => m.count))

  // ── Summary stats ──
  const total = events.length
  const maxPeakHr = total ? Math.max(...events.map(e => e.peak_hr)) : 0
  const avgPeakHr = total ? Math.round(events.reduce((s, e) => s + e.peak_hr, 0) / total) : 0
  const avgDuration = total ? events.reduce((s, e) => s + e.duration_seconds, 0) / total : 0
  const sessionCount = new Set(events.map(e => e.gpx_file_id)).size

  // ── Date range ──
  const times = events.map(e => eventTime(e)).filter(Boolean)
  let dateRange = ''
  if (times.length) {
    const min = new Date(Math.min(...times.map(t => t.getTime())))
    const max = new Date(Math.max(...times.map(t => t.getTime())))
    const fmt = d => d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    dateRange = (min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear())
      ? fmt(min)
      : `${fmt(min)} through ${fmt(max)}`
  }

  // ── Narrative ──
  const peakMonth = months.reduce((a, m) => m.count > a.count ? m : a, { count: 0, label: '' })
  const multiRideCount = Object.values(
    events.reduce((acc, e) => { acc[e.gpx_file_id] = (acc[e.gpx_file_id] || 0) + 1; return acc }, {})
  ).filter(c => c >= 2).length
  let narrative = `The highest monthly episode count was ${peakMonth.count} episode${peakMonth.count !== 1 ? 's' : ''} in ${esc(peakMonth.label)}.`
  if (multiRideCount > 0)
    narrative += ` ${multiRideCount} ride${multiRideCount !== 1 ? 's' : ''} included multiple episodes within the same session.`

  // ── Sorted episode log (most recent first) ──
  const sorted = [...events].sort((a, b) => {
    const ta = eventTime(a)?.getTime() ?? 0
    const tb = eventTime(b)?.getTime() ?? 0
    return tb - ta
  })

  // ── Month rows ──
  const monthRows = months.map(m => {
    const barWidth = m.count > 0 ? Math.max(4, Math.round((m.count / maxCount) * 220)) : 0
    return `<tr>
      <td>${esc(m.label)}</td>
      <td style="text-align:center;font-weight:bold;">${m.count > 0 ? m.count : '<span style="color:#aaa">0</span>'}</td>
      <td>${barWidth > 0 ? `<span style="display:inline-block;height:14px;width:${barWidth}px;background:#b32020;border-radius:2px;vertical-align:middle;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></span>` : ''}</td>
    </tr>`
  }).join('\n')

  // ── Episode log rows ──
  const episodeRows = sorted.map(e => {
    const dt = eventTime(e)
    const isLong = e.duration_seconds >= 120
    const label = eventLabels[e.id] ? ` <span style="color:#666;font-size:10.5px;">${esc(eventLabels[e.id])}</span>` : ''
    const rowStyle = isLong ? 'background:#fff3e0;-webkit-print-color-adjust:exact;print-color-adjust:exact;' : ''
    const peakStyle = e.peak_hr >= 190 ? 'font-weight:bold;' : ''
    const ecgCell = e.frontier_session_ref
      ? `<a href="${esc(e.frontier_session_ref)}" style="color:#1a6fb5;text-decoration:none;">View ECG Recording</a>`
      : '—'
    return `<tr style="${rowStyle}">
      <td style="white-space:nowrap;">${dt ? esc(fmtDate(dt)) : '—'}</td>
      <td style="white-space:nowrap;">${dt ? esc(fmtTime(dt)) : '—'}</td>
      <td>${esc(e.ride_name || e.filename || '—')}${label}</td>
      <td style="white-space:nowrap;">${esc(e.baseline_before)} bpm</td>
      <td style="white-space:nowrap;${peakStyle}">${esc(e.peak_hr)} bpm</td>
      <td style="white-space:nowrap;">+${esc(e.jump_magnitude)} bpm</td>
      <td style="white-space:nowrap;">${esc(fmtDur(e.duration_seconds))}</td>
      <td style="white-space:nowrap;">&minus;${esc(e.drop_magnitude)} bpm &rarr; ${esc(e.hr_after_drop)} bpm</td>
      <td>${ecgCell}</td>
    </tr>`
  }).join('\n')

  const subtitleParts = [
    settings.report_activityType,
    dateRange,
    total > 0
      ? `${total} recorded episode${total !== 1 ? 's' : ''} across ${sessionCount} session${sessionCount !== 1 ? 's' : ''}`
      : 'No confirmed episodes',
  ].filter(Boolean)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>HR Episode Log</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, 'Helvetica Neue', sans-serif;
  font-size: 13px;
  color: #1a1a1a;
  line-height: 1.55;
  padding: 0;
}
h1 { font-size: 22px; font-weight: bold; color: #1e3a5f; margin-bottom: 6px; }
.subtitle { font-style: italic; color: #555; margin-bottom: 24px; font-size: 13px; }
h2 {
  font-size: 13px; font-weight: bold; color: #fff;
  background: #1e3a5f; padding: 5px 10px;
  margin: 24px 0 10px;
  letter-spacing: 0.4px; text-transform: uppercase;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
p { margin: 6px 0; }
ul { margin: 8px 0 8px 24px; }
li { margin: 4px 0; }
.stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 10px; margin: 14px 0;
}
.stat-box {
  border: 1px solid #c8d6e5; border-radius: 4px;
  padding: 14px 10px; text-align: center; background: #f8fafd;
}
.stat-value { display: block; font-size: 26px; font-weight: bold; color: #1e3a5f; line-height: 1.15; }
.stat-value.red { color: #b32020; }
.stat-label { display: block; font-size: 11px; color: #666; margin-top: 5px; line-height: 1.35; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th {
  background: #1e3a5f; color: #fff; padding: 7px 8px;
  text-align: left; font-weight: bold;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
td { padding: 5px 8px; border-bottom: 1px solid #e8edf2; vertical-align: top; }
.month-table td:nth-child(2) { text-align: center; font-weight: bold; width: 60px; }
.episode-section { break-before: page; page-break-before: always; }
tr { break-inside: avoid; page-break-inside: avoid; }
thead { display: table-header-group; }
a { color: #1a6fb5; text-decoration: none; }
.footer {
  margin-top: 32px; font-size: 11px; color: #888; font-style: italic;
  border-top: 1px solid #ddd; padding-top: 10px;
}
</style>
</head>
<body>

<h1>Unusual Heart Rate Episodes During Exercise</h1>
<p class="subtitle">${esc(subtitleParts.join(' · '))}</p>

<h2>Purpose of This Document</h2>
<p>This log documents episodes of sudden, elevated heart rate occurring during exercise sessions.
The episodes were detected algorithmically from HR monitor data and individually reviewed and confirmed.
This report is intended to support medical evaluation and does not represent a clinical diagnosis.</p>

<h2>How the Data Was Collected</h2>
<p>All sessions were ${esc(settings.report_activityType)} rides. Heart rate was recorded using two independent sources:</p>
<ul>
  <li><strong>Chest HR strap via Strava</strong> — Activity HR data was imported into HR Event Tracker${settings.report_appUrl ? ` (${esc(settings.report_appUrl)})` : ''} for automated episode detection and review.</li>
  <li><strong>${esc(settings.report_hrDevice)} heart rate monitor</strong> — A dedicated cardiac monitor worn during all rides, providing continuous ECG-quality recordings timestamped alongside each detected episode.</li>
</ul>

<h2>Episode Detection Criteria</h2>
<p>Episodes were flagged automatically when all of the following conditions were met:</p>
<ul>
  <li>Heart rate jumped by <strong>${esc(settings.jumpThreshold)} bpm or more</strong> within a short interval</li>
  <li>The baseline heart rate before the jump was above <strong>${esc(settings.minBaselineHr)} bpm</strong> (ruling out low-HR artifact noise)</li>
  <li>Heart rate subsequently dropped by <strong>${esc(settings.dropRequired)} bpm or more</strong> (confirming recovery)</li>
  <li>Episodes detected within 60 seconds of each other were merged and counted as a single event</li>
</ul>
${total > 0 ? `<p><em>All ${total} episodes in this log were individually reviewed and confirmed as genuine sudden-onset events.</em></p>` : ''}

<h2>Summary</h2>
${total > 0 ? `
<div class="stats-grid">
  <div class="stat-box">
    <span class="stat-value">${total}</span>
    <span class="stat-label">Total Episodes Recorded</span>
  </div>
  <div class="stat-box">
    <span class="stat-value red">${maxPeakHr} bpm</span>
    <span class="stat-label">Highest Recorded Peak HR</span>
  </div>
  <div class="stat-box">
    <span class="stat-value">${avgPeakHr} bpm</span>
    <span class="stat-label">Average Peak HR</span>
  </div>
  <div class="stat-box">
    <span class="stat-value red">${esc(fmtDur(avgDuration))}</span>
    <span class="stat-label">Average Episode Duration</span>
  </div>
</div>
` : '<p><em>No confirmed episodes to summarize.</em></p>'}

${months.length > 0 ? `
<h2>Episodes by Month</h2>
<p>${narrative}</p>
<table class="month-table">
  <thead>
    <tr><th>Month</th><th style="text-align:center;">Episodes</th><th>Relative Frequency</th></tr>
  </thead>
  <tbody>
    ${monthRows}
  </tbody>
</table>
` : ''}

<div class="episode-section">
<h2>Episode Log (Most Recent First)</h2>
<p>Rows shaded <span style="background:#fff3e0;padding:1px 5px;border:1px solid #ffd591;border-radius:2px;">orange</span> indicate episodes sustained for 2 minutes or longer. <strong>Bold</strong> peak HR values indicate &ge;190 bpm. Times are shown in local time.</p>

${sorted.length === 0 ? '<p><em>No confirmed episodes to display.</em></p>' : `
<table class="episode-table">
  <thead>
    <tr>
      <th>Date</th>
      <th>Time</th>
      <th>Activity</th>
      <th>Baseline HR</th>
      <th>Peak HR</th>
      <th>Jump</th>
      <th>Duration</th>
      <th>Drop &rarr; HR After</th>
      <th>${esc(settings.report_hrDevice)} ECG Recording</th>
    </tr>
  </thead>
  <tbody>
    ${episodeRows}
  </tbody>
</table>
`}
</div>

<p class="footer">
  Data source: Strava activity HR streams${settings.report_hrDevice ? ` + ${esc(settings.report_hrDevice)}` : ''}.
  Managed via HR Event Tracker${settings.report_appUrl ? ` (${esc(settings.report_appUrl)})` : ''}.
  Report generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
</p>

</body>
</html>`
}
