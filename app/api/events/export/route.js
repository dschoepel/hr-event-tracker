import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const eventTime = r => {
  if (r.ride_start_time && r.start_time_seconds != null) {
    return new Date(new Date(r.ride_start_time).getTime() + r.start_time_seconds * 1000).toISOString()
  }
  return r.created_at ? new Date(r.created_at + 'Z').toISOString() : null
}

const escapeCell = v => {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv'

  const rows = getDb().prepare(`
    SELECT e.*, f.ride_name, f.ride_date AS file_ride_date, f.ride_start_time
    FROM hr_events e
    LEFT JOIN gpx_files f ON f.id = e.gpx_file_id
    ORDER BY f.ride_start_time ASC, e.start_time_seconds ASC
  `).all()

  const today = new Date().toISOString().slice(0, 10)

  if (format === 'json') {
    const data = rows.map(r => ({
      id:               r.id,
      ride_name:        r.ride_name ?? null,
      ride_date:        r.file_ride_date ?? null,
      event_time:       eventTime(r),
      baseline_hr:      r.baseline_before,
      peak_hr:          r.peak_hr,
      jump_bpm:         r.jump_magnitude,
      drop_bpm:         r.drop_magnitude,
      hr_after_drop:    r.hr_after_drop,
      duration_seconds: r.duration_seconds,
      confirmed:           r.confirmed === 1,
      notes:               r.notes ?? null,
      frontier_session_ref: r.frontier_session_ref ?? null,
    }))
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hr-events-${today}.json"`,
      },
    })
  }

  const headers = ['id', 'ride_name', 'ride_date', 'event_time', 'baseline_hr', 'peak_hr',
                   'jump_bpm', 'drop_bpm', 'hr_after_drop', 'duration_seconds', 'confirmed',
                   'notes', 'frontier_session_ref']

  const csvRows = rows.map(r => [
    r.id,
    r.ride_name,
    r.file_ride_date,
    eventTime(r),
    r.baseline_before,
    r.peak_hr,
    r.jump_magnitude,
    r.drop_magnitude,
    r.hr_after_drop,
    r.duration_seconds,
    r.confirmed === 1 ? 'Yes' : 'No',
    r.notes,
    r.frontier_session_ref,
  ].map(escapeCell).join(','))

  const csv = [headers.join(','), ...csvRows].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="hr-events-${today}.csv"`,
    },
  })
}
