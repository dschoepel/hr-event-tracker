import { NextResponse } from 'next/server'
import { getDb, getSettings } from '@/lib/db'

export async function GET() {
  return NextResponse.json(getSettings())
}

export async function PUT(request) {
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

  return NextResponse.json(getSettings())
}
