import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { refreshRideStats } from '@/lib/gpxParser'
import { requireOwner } from '@/lib/auth'

// Recompute distance / elevation / avg HR for every ride whose GPX is still on disk.
// Idempotent — safe to run any number of times.
export async function POST(request) {
  const denied = requireOwner(request)
  if (denied) return denied

  try {
    const db = getDb()
    const rows = db.prepare('SELECT id, original_path FROM gpx_files').all()
    let updated = 0, skippedMissingFile = 0

    for (const r of rows) {
      if (await refreshRideStats(db, r.id, r.original_path)) updated++
      else skippedMissingFile++
    }

    return NextResponse.json({ updated, skippedMissingFile })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
