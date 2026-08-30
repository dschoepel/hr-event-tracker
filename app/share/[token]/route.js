import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { setViewerCookie } from '@/lib/auth'

// Public redemption endpoint for a doctor's share link. Reusable until the
// link expires or is revoked from Settings → Share Access — not a one-time code.
export async function GET(request, { params }) {
  const { token } = await params
  const link = getDb().prepare('SELECT * FROM share_links WHERE token = ?').get(token)

  const invalid = !link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()
  if (invalid) return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))

  const res = NextResponse.redirect(new URL('/report', request.url))
  setViewerCookie(res, link)
  return res
}
