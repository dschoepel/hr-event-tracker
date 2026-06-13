import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseGpx, detectSpikes } from '@/lib/gpxParser'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { hrStream, metadata } = await parseGpx(buffer)
    const candidates = detectSpikes(hrStream)
    const db = getDb()

    const fileRow = db.prepare(`
      INSERT INTO gpx_files (filename, ride_date, duration_seconds)
      VALUES (?, ?, ?)
    `).run(file.name, metadata.ride_date, metadata.duration_seconds)

    const gpxFileId = Number(fileRow.lastInsertRowid)

    db.prepare(`INSERT INTO hr_streams (gpx_file_id, stream_json) VALUES (?, ?)`)
      .run(gpxFileId, JSON.stringify(hrStream))

    for (const c of candidates) {
      db.prepare(`
        INSERT INTO hr_events
          (gpx_file_id, start_time_seconds, peak_hr, peak_time_seconds, baseline_before,
           hr_after_drop, drop_time_seconds, duration_seconds, jump_magnitude, drop_magnitude,
           detection_method)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(gpxFileId, c.start_time_seconds, c.peak_hr, c.peak_time_seconds, c.baseline_before,
             c.hr_after_drop, c.drop_time_seconds, c.duration_seconds, c.jump_magnitude,
             c.drop_magnitude, c.detection_method)
    }

    return NextResponse.json({ gpx_file_id: gpxFileId, candidates })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const rows = getDb().prepare('SELECT * FROM gpx_files ORDER BY uploaded_at DESC').all()
  return NextResponse.json(rows)
}
