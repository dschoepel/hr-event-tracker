import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { getDb, GPX_DIR, getSettings } from '@/lib/db'
import { parseGpx, detectSpikes } from '@/lib/gpxParser'

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const { hrStream, metadata } = await parseGpx(buffer)
    const db = getDb()

    // Duplicate check — same ride_start_time means same activity
    if (!force && metadata.ride_start_time) {
      const existing = db.prepare(`
        SELECT g.id, g.ride_name, g.filename, g.uploaded_at, COUNT(e.id) as event_count
        FROM gpx_files g
        LEFT JOIN hr_events e ON e.gpx_file_id = g.id
        WHERE g.ride_start_time = ?
        GROUP BY g.id
        LIMIT 1
      `).get(metadata.ride_start_time)

      if (existing) {
        return NextResponse.json({
          duplicate: true,
          existing: {
            id:         existing.id,
            ride_name:  existing.ride_name,
            filename:   existing.filename,
            uploaded_at: existing.uploaded_at,
            event_count: Number(existing.event_count),
          },
        }, { status: 409 })
      }
    }

    const settings = getSettings()
    const candidates = detectSpikes(hrStream, {
      threshold:    settings.jumpThreshold,
      minBaseline:  settings.minBaselineHr,
      dropRequired: settings.dropRequired,
    })

    const storedFilename = force ? file.name.replace(/\.gpx$/i, ' (duplicate).gpx') : file.name

    const fileRow = db.prepare(`
      INSERT INTO gpx_files (filename, ride_name, ride_date, ride_start_time, duration_seconds)
      VALUES (?, ?, ?, ?, ?)
    `).run(storedFilename, metadata.ride_name, metadata.ride_date, metadata.ride_start_time, metadata.duration_seconds)

    const gpxFileId = Number(fileRow.lastInsertRowid)

    const savedPath = join(GPX_DIR, `${gpxFileId}.gpx`)
    writeFileSync(savedPath, buffer)
    db.prepare('UPDATE gpx_files SET original_path = ? WHERE id = ?').run(savedPath, gpxFileId)

    db.prepare('INSERT INTO hr_streams (gpx_file_id, stream_json) VALUES (?, ?)')
      .run(gpxFileId, JSON.stringify(hrStream))

    for (const c of candidates) {
      db.prepare(`
        INSERT INTO hr_events
          (gpx_file_id, start_time_seconds, peak_hr, peak_time_seconds, baseline_before,
           hr_after_drop, drop_time_seconds, duration_seconds, jump_magnitude, drop_magnitude,
           detection_method, data_truncated)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(gpxFileId, c.start_time_seconds, c.peak_hr, c.peak_time_seconds, c.baseline_before,
             c.hr_after_drop, c.drop_time_seconds, c.duration_seconds, c.jump_magnitude,
             c.drop_magnitude, c.detection_method, c.data_truncated)
    }

    return NextResponse.json({ gpx_file_id: gpxFileId, candidates })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare(`
    SELECT g.*, COUNT(e.id) as event_count
    FROM gpx_files g
    LEFT JOIN hr_events e ON e.gpx_file_id = g.id
    GROUP BY g.id
    ORDER BY g.uploaded_at DESC
  `).all()

  return NextResponse.json(rows.map(r => ({
    ...r,
    event_count: Number(r.event_count),
    file_exists: r.original_path ? existsSync(r.original_path) : false,
  })))
}
