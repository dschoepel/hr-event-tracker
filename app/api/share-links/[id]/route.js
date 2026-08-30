import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireOwner } from '@/lib/auth'

export async function DELETE(request, { params }) {
  const denied = requireOwner(request)
  if (denied) return denied

  const { id } = await params
  getDb().prepare("UPDATE share_links SET revoked_at = datetime('now') WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
