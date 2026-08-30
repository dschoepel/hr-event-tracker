import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { setViewerCookie } from '@/lib/auth'
import { publicUrl } from '@/lib/publicUrl'

// Public redemption endpoint for a doctor's share link. Reusable until the
// link expires or is revoked from Settings → Share Access — not a one-time code.
export async function GET(request, { params }) {
  const { token } = await params
  const link = getDb().prepare('SELECT * FROM share_links WHERE token = ?').get(token)

  const invalid = !link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()
  if (invalid) return NextResponse.redirect(publicUrl('/login?error=invalid_link', request))

  getDb().prepare("UPDATE share_links SET last_used_at = datetime('now') WHERE id = ?").run(link.id)

  const res = NextResponse.redirect(publicUrl('/report', request))
  setViewerCookie(res, link)
  return res
}
