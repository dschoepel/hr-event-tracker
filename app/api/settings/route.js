import { NextResponse } from 'next/server'
import { getDb, getSettings } from '@/lib/db'
import { getSession, requireOwner } from '@/lib/auth'
import { UNITS } from '@/lib/units'

export async function GET(request) {
  // Read-only, allowed for viewers too — the Report page needs it.
  if (!getSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(getSettings())
}

export async function PUT(request) {
  const denied = requireOwner(request)
  if (denied) return denied

  const body = await request.json()
  const db = getDb()
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

  // Detection thresholds (numeric, validated)
  if ('jumpThreshold' in body || 'minBaselineHr' in body || 'dropRequired' in body) {
    const s = getSettings()
    const parsed = {
      jumpThreshold: Number(body.jumpThreshold ?? s.jumpThreshold),
      minBaselineHr: Number(body.minBaselineHr ?? s.minBaselineHr),
      dropRequired:  Number(body.dropRequired  ?? s.dropRequired),
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (!Number.isFinite(v) || v < 1)
        return NextResponse.json({ error: `Invalid value for ${k}` }, { status: 400 })
    }
    upsert.run('detection.jumpThreshold', String(parsed.jumpThreshold))
    upsert.run('detection.minBaselineHr', String(parsed.minBaselineHr))
    upsert.run('detection.dropRequired',  String(parsed.dropRequired))
  }

  // Report settings (string fields, no numeric validation needed)
  for (const field of ['activityType', 'hrDevice', 'appUrl']) {
    if (field in body) upsert.run(`report.${field}`, String(body[field]))
  }

  if ('displayUnits' in body) {
    if (!UNITS.includes(body.displayUnits))
      return NextResponse.json({ error: 'Invalid value for displayUnits' }, { status: 400 })
    upsert.run('display.units', body.displayUnits)
  }

  return NextResponse.json(getSettings())
}
