import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getSession, requireOwner } from '@/lib/auth'

export async function GET(request, { params }) {
  const session = getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()
  const event = db.prepare(`
    SELECT e.*, f.filename, f.ride_name, f.ride_date AS file_ride_date, f.ride_start_time,
           f.distance_m, f.elevation_gain_m, f.avg_hr
    FROM hr_events e LEFT JOIN gpx_files f ON f.id = e.gpx_file_id
    WHERE e.id = ?
  `).get(id)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Viewers can only reach confirmed episodes, even by guessing an id.
  if (session.role === 'viewer' && !event.confirmed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const streamRow = db.prepare('SELECT stream_json FROM hr_streams WHERE gpx_file_id = ?').get(event.gpx_file_id)
  return NextResponse.json({ event, hr_stream: streamRow ? JSON.parse(streamRow.stream_json) : [] })
}

export async function PATCH(request, { params }) {
  const denied = requireOwner(request)
  if (denied) return denied

  const { id } = await params
  const { notes, confirmed, frontier_session_ref } = await request.json()
  const db = getDb()

  const event = db.prepare('SELECT id FROM hr_events WHERE id = ?').get(id)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare(`
    UPDATE hr_events SET
      notes = COALESCE(?, notes),
      confirmed = COALESCE(?, confirmed),
      frontier_session_ref = COALESCE(?, frontier_session_ref)
    WHERE id = ?
  `).run(notes ?? null, confirmed != null ? (confirmed ? 1 : 0) : null, frontier_session_ref ?? null, id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(request, { params }) {
  const denied = requireOwner(request)
  if (denied) return denied

  const { id } = await params
  getDb().prepare('DELETE FROM hr_events WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
