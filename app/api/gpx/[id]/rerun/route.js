import { NextResponse } from 'next/server'
import { getDb, getSettings } from '@/lib/db'
import { detectSpikes } from '@/lib/gpxParser'

export async function POST(request, { params }) {
  const id = Number((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const db = getDb()

    const streamRow = db.prepare('SELECT stream_json FROM hr_streams WHERE gpx_file_id = ?').get(id)
    if (!streamRow) return NextResponse.json({ error: 'No stream found for this file' }, { status: 404 })

    const hrStream = JSON.parse(streamRow.stream_json)
    const settings = getSettings()
    const candidates = detectSpikes(hrStream, {
      threshold:    settings.jumpThreshold,
      minBaseline:  settings.minBaselineHr,
      dropRequired: settings.dropRequired,
    })

    db.prepare('DELETE FROM hr_events WHERE gpx_file_id = ?').run(id)

    const insert = db.prepare(`
      INSERT INTO hr_events
        (gpx_file_id, start_time_seconds, peak_hr, peak_time_seconds, baseline_before,
         hr_after_drop, drop_time_seconds, duration_seconds, jump_magnitude, drop_magnitude,
         detection_method, data_truncated)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `)

    for (const c of candidates) {
      insert.run(id, c.start_time_seconds, c.peak_hr, c.peak_time_seconds, c.baseline_before,
                 c.hr_after_drop, c.drop_time_seconds, c.duration_seconds, c.jump_magnitude,
                 c.drop_magnitude, c.detection_method, c.data_truncated)
    }

    return NextResponse.json({ eventsFound: candidates.length, gpxFileId: id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
