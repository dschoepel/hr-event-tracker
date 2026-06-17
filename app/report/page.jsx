'use client'
import { useEffect, useState, useMemo } from 'react'
import { App, Button, DatePicker, Spin, Tooltip, Typography } from 'antd'
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons'
import styles from './report.module.css'
import PageBreadcrumb from '@/components/PageBreadcrumb'

const { RangePicker } = DatePicker
const { Text } = Typography

function DownloadPdfButton({ dateFilter }) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const download = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFilter?.[0]) params.set('start', dateFilter[0].format('YYYY-MM-DD'))
      if (dateFilter?.[1]) params.set('end',   dateFilter[1].format('YYYY-MM-DD'))
      const qs = params.size ? `?${params}` : ''

      const res = await fetch(`/api/report/pdf${qs}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'PDF generation failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = dateFilter?.[0]
        ? `${dateFilter[0].format('YYYY-MM-DD')}_${dateFilter[1].format('YYYY-MM-DD')}`
        : new Date().toISOString().slice(0, 10)
      a.download = `HR-Episode-Log-${suffix}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type="primary" icon={<DownloadOutlined />} onClick={download} loading={loading}>
      Download PDF
    </Button>
  )
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']

const eventTime = r => {
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

export default function ReportPage() {
  const [allEvents, setAllEvents] = useState([])
  const [settings, setSettings]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [dateFilter, setDateFilter] = useState(null) // [dayjs, dayjs] | null

  useEffect(() => {
    Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([evts, stgs]) => {
      setAllEvents(evts.filter(e => e.confirmed))
      setSettings(stgs)
      setLoading(false)
    })
  }, [])

  // ── Apply date range filter ──
  const events = useMemo(() => {
    if (!dateFilter?.[0] || !dateFilter?.[1]) return allEvents
    const start = dateFilter[0].startOf('day').valueOf()
    const end   = dateFilter[1].endOf('day').valueOf()
    return allEvents.filter(e => {
      const t = eventTime(e)
      return t && t.getTime() >= start && t.getTime() <= end
    })
  }, [allEvents, dateFilter])

  // ── Multi-event ordinal labels ──
  const eventLabels = useMemo(() => {
    const groups = {}
    for (const e of events) {
      if (!groups[e.gpx_file_id]) groups[e.gpx_file_id] = []
      groups[e.gpx_file_id].push(e)
    }
    for (const g of Object.values(groups))
      g.sort((a, b) => (a.start_time_seconds ?? 0) - (b.start_time_seconds ?? 0))
    const labels = {}
    for (const group of Object.values(groups))
      if (group.length >= 2)
        group.forEach((e, i) => { labels[e.id] = `(${ORDINALS[i] ?? `${i + 1}th`} event)` })
    return labels
  }, [events])

  // ── Month frequency data ──
  const monthsData = useMemo(() => {
    const countMap = {}
    for (const e of events) {
      const t = eventTime(e)
      if (!t) continue
      const key = t.toISOString().slice(0, 7)
      countMap[key] = (countMap[key] || 0) + 1
    }
    return monthRange(events).map(key => ({
      key,
      label: new Date(key + '-15').toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      count: countMap[key] ?? 0,
    })).reverse()
  }, [events])

  const maxMonthCount = useMemo(
    () => Math.max(1, ...monthsData.map(m => m.count)),
    [monthsData]
  )

  // ── Summary stats ──
  const stats = useMemo(() => {
    if (!events.length) return null
    return {
      total:       events.length,
      maxPeakHr:   Math.max(...events.map(e => e.peak_hr)),
      avgPeakHr:   Math.round(events.reduce((s, e) => s + e.peak_hr, 0) / events.length),
      avgDuration: events.reduce((s, e) => s + e.duration_seconds, 0) / events.length,
    }
  }, [events])

  // ── Subtitle date range string ──
  const subtitleDateRange = useMemo(() => {
    if (!events.length) return ''
    const times = events.map(e => eventTime(e)).filter(Boolean)
    const min = new Date(Math.min(...times.map(t => t.getTime())))
    const max = new Date(Math.max(...times.map(t => t.getTime())))
    const fmt = d => d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    return min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear()
      ? fmt(min)
      : `${fmt(min)} through ${fmt(max)}`
  }, [events])

  const sessionCount = useMemo(() => new Set(events.map(e => e.gpx_file_id)).size, [events])

  // ── Narrative for monthly section ──
  const narrative = useMemo(() => {
    if (!monthsData.length) return ''
    const peak = monthsData.reduce((a, m) => m.count > a.count ? m : a, { count: 0, label: '' })
    const multiRideCount = Object.values(
      events.reduce((acc, e) => { acc[e.gpx_file_id] = (acc[e.gpx_file_id] || 0) + 1; return acc }, {})
    ).filter(c => c >= 2).length
    let text = `The highest monthly episode count was ${peak.count} episode${peak.count !== 1 ? 's' : ''} in ${peak.label}.`
    if (multiRideCount > 0)
      text += ` ${multiRideCount} ride${multiRideCount !== 1 ? 's' : ''} included multiple episodes within the same session.`
    return text
  }, [monthsData, events])

  // ── Episode log: most recent first ──
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => {
      const ta = eventTime(a)?.getTime() ?? 0
      const tb = eventTime(b)?.getTime() ?? 0
      return tb - ta
    }),
    [events]
  )

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}><Spin size="large" /></div>
      </div>
    )
  }

  if (!settings) return null

  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className={styles.page}>
      {/* Global print rules — hides the app nav bar */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          header, .ant-layout-header { display: none !important; }
          .ant-layout { background: #fff !important; }
          .ant-layout-content { padding: 0 !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}} />

      <PageBreadcrumb items={[
        { label: 'Event History', href: '/events' },
        { label: 'Report' },
      ]} />

      {/* Controls bar */}
      <div className={styles.controls}>
        <DownloadPdfButton dateFilter={dateFilter} />
        <Tooltip title="Opens the browser print dialog. Uncheck 'Headers and footers' in More settings for a cleaner output.">
          <Button
            icon={<PrinterOutlined />}
            onClick={() => {
              const prev = document.title
              document.title = 'HR Episode Log'
              window.print()
              document.title = prev
            }}
          >
            Print
          </Button>
        </Tooltip>
        <RangePicker
          value={dateFilter}
          onChange={setDateFilter}
          allowClear
          placeholder={['Start date', 'End date']}
          style={{ width: 240 }}
        />
        {dateFilter && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {events.length} of {allEvents.length} episode{allEvents.length !== 1 ? 's' : ''}
          </Text>
        )}
      </div>

      {/* Report document */}
      <div className={styles.doc}>
        <h1>Unusual Heart Rate Episodes During Exercise</h1>
        <p className={styles.subtitle}>
          {settings.report_activityType}
          {subtitleDateRange ? ` · ${subtitleDateRange}` : ''}
          {events.length > 0
            ? ` · ${events.length} recorded episode${events.length !== 1 ? 's' : ''} across ${sessionCount} session${sessionCount !== 1 ? 's' : ''}`
            : ' · No confirmed episodes'}
        </p>

        {/* ── Purpose ── */}
        <h2>Purpose of This Document</h2>
        <p>
          This log documents episodes of sudden, elevated heart rate occurring during exercise sessions.
          The episodes were detected algorithmically from HR monitor data and individually reviewed and confirmed.
          This report is intended to support medical evaluation and does not represent a clinical diagnosis.
        </p>

        {/* ── Data Collection ── */}
        <h2>How the Data Was Collected</h2>
        <p>All sessions were {settings.report_activityType} rides. Heart rate was recorded using two independent sources:</p>
        <ul>
          <li>
            <strong>Chest HR strap via Strava</strong> — Activity HR data was imported into HR Event Tracker
            {settings.report_appUrl ? ` (${settings.report_appUrl})` : ''} for automated episode detection and review.
          </li>
          <li>
            <strong>{settings.report_hrDevice} heart rate monitor</strong> — A dedicated cardiac monitor worn during all rides,
            providing continuous ECG-quality recordings timestamped alongside each detected episode.
          </li>
        </ul>

        {/* ── Detection Criteria ── */}
        <h2>Episode Detection Criteria</h2>
        <p>Episodes were flagged automatically when all of the following conditions were met:</p>
        <ul>
          <li>Heart rate jumped by <strong>{settings.jumpThreshold} bpm or more</strong> within a short interval</li>
          <li>The baseline heart rate before the jump was above <strong>{settings.minBaselineHr} bpm</strong> (ruling out low-HR artifact noise)</li>
          <li>Heart rate subsequently dropped by <strong>{settings.dropRequired} bpm or more</strong> (confirming recovery and distinguishing from sustained elevated effort)</li>
          <li>Episodes detected within 60 seconds of each other were merged and counted as a single event</li>
        </ul>
        {events.length > 0 && (
          <p><em>All {events.length} episodes in this log were individually reviewed and confirmed as genuine sudden-onset events.</em></p>
        )}

        {/* ── Summary stats ── */}
        <h2>Summary</h2>
        {stats ? (
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{stats.total}</span>
              <span className={styles.statLabel}>Total Episodes Recorded</span>
            </div>
            <div className={styles.statBox}>
              <span className={`${styles.statValue} ${styles.statValueRed}`}>{stats.maxPeakHr} bpm</span>
              <span className={styles.statLabel}>Highest Recorded Peak HR</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{stats.avgPeakHr} bpm</span>
              <span className={styles.statLabel}>Average Peak HR</span>
            </div>
            <div className={styles.statBox}>
              <span className={`${styles.statValue} ${styles.statValueRed}`}>{fmtDur(stats.avgDuration)}</span>
              <span className={styles.statLabel}>Average Episode Duration</span>
            </div>
          </div>
        ) : (
          <p><em>No confirmed episodes to summarize.</em></p>
        )}

        {/* ── Episodes by Month ── */}
        {monthsData.length > 0 && (
          <>
            <h2>Episodes by Month</h2>
            <p>{narrative}</p>
            <table className={styles.monthTable}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'center' }}>Episodes</th>
                  <th>Relative Frequency</th>
                </tr>
              </thead>
              <tbody>
                {monthsData.map(m => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td>{m.count > 0 ? m.count : <span style={{ color: '#aaa' }}>0</span>}</td>
                    <td>
                      {m.count > 0 && (
                        <span
                          className={styles.freqBar}
                          style={{ width: `${Math.max(4, Math.round((m.count / maxMonthCount) * 220))}px` }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ── Episode Log — forced onto its own page when printing ── */}
        <div className={styles.episodeSection}>
          <h2>Episode Log (Most Recent First)</h2>
          <p>
            Rows shaded{' '}
            <span style={{ background: '#fff3e0', padding: '1px 5px', border: '1px solid #ffd591', borderRadius: 2 }}>
              orange
            </span>
            {' '}indicate episodes sustained for 2 minutes or longer.{' '}
            <strong>Bold</strong> peak HR values indicate ≥190 bpm.{' '}
            Times are shown in local time.
          </p>

          {sortedEvents.length === 0 ? (
            <p><em>No confirmed episodes to display.</em></p>
          ) : (
            <table className={styles.episodeTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Activity</th>
                  <th>Baseline HR</th>
                  <th>Peak HR</th>
                  <th>Jump</th>
                  <th>Duration</th>
                  <th>Drop → HR After</th>
                  <th>{settings.report_hrDevice} ECG Recording</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map(e => {
                  const dt = eventTime(e)
                  const isLong = e.duration_seconds >= 120
                  const label = eventLabels[e.id]
                  return (
                    <tr key={e.id} className={isLong ? styles.orangeRow : ''}>
                      <td style={{ whiteSpace: 'nowrap' }}>{dt ? fmtDate(dt) : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{dt ? fmtTime(dt) : '—'}</td>
                      <td>
                        {e.ride_name || e.filename || '—'}
                        {label && <span style={{ color: '#666', marginLeft: 4 }}>{label}</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{e.baseline_before} bpm</td>
                      <td style={{ whiteSpace: 'nowrap' }} className={e.peak_hr >= 190 ? styles.boldHr : ''}>
                        {e.peak_hr} bpm
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>+{e.jump_magnitude} bpm</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDur(e.duration_seconds)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        &minus;{e.drop_magnitude} bpm &rarr; {e.hr_after_drop} bpm
                      </td>
                      <td>
                        {e.frontier_session_ref ? (
                          <a href={e.frontier_session_ref} target="_blank" rel="noreferrer">
                            View ECG Recording
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <p className={styles.footer}>
          Data source: Strava activity HR streams{settings.report_hrDevice ? ` + ${settings.report_hrDevice}` : ''}.{' '}
          Managed via HR Event Tracker{settings.report_appUrl ? ` (${settings.report_appUrl})` : ''}.{' '}
          Report generated {reportDate}.
        </p>
      </div>
    </div>
  )
}
