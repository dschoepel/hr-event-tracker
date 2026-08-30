import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireOwner } from '@/lib/auth'

export async function GET(request) {
  const denied = requireOwner(request)
  if (denied) return denied

  const rows = getDb().prepare('SELECT * FROM share_links ORDER BY created_at DESC').all()
  return NextResponse.json(rows)
}

export async function POST(request) {
  const denied = requireOwner(request)
  if (denied) return denied

  const { label, days } = await request.json().catch(() => ({}))
  const durationDays = Number(days)
  if (!Number.isFinite(durationDays) || durationDays <= 0 || durationDays > 365) {
    return NextResponse.json({ error: 'Invalid expiry duration' }, { status: 400 })
  }

  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + durationDays * 86_400_000).toISOString()

  const result = getDb()
    .prepare('INSERT INTO share_links (token, label, expires_at) VALUES (?, ?, ?)')
    .run(token, label || null, expiresAt)

  return NextResponse.json(
    { id: Number(result.lastInsertRowid), token, label: label || null, expires_at: expiresAt },
    { status: 201 }
  )
}
