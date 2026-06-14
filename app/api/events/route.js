import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const min_peak_hr = searchParams.get('min_peak_hr')
  const start_date = searchParams.get('start_date')
  const end_date = searchParams.get('end_date')

  let sql = `SELECT e.*, f.filename, f.ride_name, f.ride_date AS file_ride_date, f.ride_start_time
             FROM hr_events e LEFT JOIN gpx_files f ON f.id = e.gpx_file_id
             WHERE 1=1`
  const params = []

  if (min_peak_hr) { sql += ' AND peak_hr >= ?'; params.push(Number(min_peak_hr)) }
  if (start_date)  { sql += ' AND date(created_at) >= ?'; params.push(start_date) }
  if (end_date)    { sql += ' AND date(created_at) <= ?'; params.push(end_date) }

  sql += ' ORDER BY created_at DESC'

  return NextResponse.json(getDb().prepare(sql).all(...params))
}

export async function POST(request) {
  const body = await request.json()
  const {
    gpx_file_id, start_time_seconds, peak_hr, peak_time_seconds, baseline_before,
    hr_after_drop, drop_time_seconds, duration_seconds, jump_magnitude, drop_magnitude,
    detection_method = 'manual', confirmed = 0, notes, frontier_session_ref,
  } = body

  const result = getDb().prepare(`
    INSERT INTO hr_events
      (gpx_file_id, start_time_seconds, peak_hr, peak_time_seconds, baseline_before,
       hr_after_drop, drop_time_seconds, duration_seconds, jump_magnitude, drop_magnitude,
       detection_method, confirmed, notes, frontier_session_ref)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(gpx_file_id, start_time_seconds, peak_hr, peak_time_seconds, baseline_before,
         hr_after_drop, drop_time_seconds, duration_seconds, jump_magnitude, drop_magnitude,
         detection_method, confirmed ? 1 : 0, notes ?? null, frontier_session_ref ?? null)

  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 })
}
