import { NextResponse } from 'next/server'
import { getDb, getSettings, DETECTION_DEFAULTS } from '@/lib/db'

export async function GET() {
  return NextResponse.json(getSettings())
}

export async function PUT(request) {
  const body = await request.json()
  const { jumpThreshold, minBaselineHr, dropRequired } = body

  const parsed = {
    jumpThreshold: Number(jumpThreshold),
    minBaselineHr: Number(minBaselineHr),
    dropRequired:  Number(dropRequired),
  }

  for (const [k, v] of Object.entries(parsed)) {
    if (!Number.isFinite(v) || v < 1) {
      return NextResponse.json({ error: `Invalid value for ${k}` }, { status: 400 })
    }
  }

  const db = getDb()
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  upsert.run('detection.jumpThreshold', String(parsed.jumpThreshold))
  upsert.run('detection.minBaselineHr', String(parsed.minBaselineHr))
  upsert.run('detection.dropRequired',  String(parsed.dropRequired))

  return NextResponse.json(parsed)
}
