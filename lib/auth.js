// Owner login + doctor share-link auth.
//
// Two roles:
//   - owner:  full read/write, unlocked with OWNER_PASSWORD_HASH
//   - viewer: read-only, unlocked by visiting a /share/<token> link created
//             from Settings → Share Access. Reusable until it expires or is
//             revoked (checked against the share_links table on every
//             request, not just the cookie, so revoking is instant).
//
// Node runtime only (uses node:crypto) — middleware.js does its own coarse,
// edge-safe cookie-presence check and defers real verification here.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from './db'

export { hashPassword, verifyPassword } from './passwordHash'

export const OWNER_COOKIE = 'hret_owner'
export const VIEWER_COOKIE = 'hret_viewer'
const OWNER_SESSION_SECONDS = 60 * 60 * 24 * 30 // 30 days

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set')
  return secret
}

// ── Signed session tokens (HMAC-SHA256 over base64url JSON) ────────────
function sign(data) {
  return createHmac('sha256', sessionSecret()).update(data).digest('base64url')
}

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${sign(data)}`
}

function verifyToken(token) {
  if (!token) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  let expectedSig
  try { expectedSig = sign(data) } catch { return null }
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  let payload
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) } catch { return null }
  if (payload.exp && Date.now() > payload.exp) return null
  return payload
}

// ── Session lookup (authoritative — used by route handlers) ────────────
export function getOwnerSession(request) {
  const payload = verifyToken(request.cookies.get(OWNER_COOKIE)?.value)
  return payload?.role === 'owner' ? { role: 'owner' } : null
}

export function getViewerSession(request) {
  const payload = verifyToken(request.cookies.get(VIEWER_COOKIE)?.value)
  if (payload?.role !== 'viewer' || !payload.linkId) return null

  // Re-check the DB row every request — this is what makes revoking a link
  // take effect immediately, even for a browser that already has the cookie.
  const link = getDb().prepare('SELECT * FROM share_links WHERE id = ?').get(payload.linkId)
  if (!link || link.revoked_at) return null
  if (new Date(link.expires_at).getTime() < Date.now()) return null

  return { role: 'viewer', linkId: link.id, label: link.label }
}

export function getSession(request) {
  return getOwnerSession(request) ?? getViewerSession(request)
}

/** Returns a 403 NextResponse if the request isn't an owner session, else null. */
export function requireOwner(request) {
  const session = getSession(request)
  if (session?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/** Returns a 401 NextResponse if the request has no session at all, else null. */
export function requireAnySession(request) {
  if (!getSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

// ── Cookie helpers ───────────────────────────────────────────────────────
const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }

export function setOwnerCookie(response) {
  const exp = Date.now() + OWNER_SESSION_SECONDS * 1000
  response.cookies.set(OWNER_COOKIE, signToken({ role: 'owner', exp }), { ...cookieOpts, maxAge: OWNER_SESSION_SECONDS })
}

export function setViewerCookie(response, link) {
  const expMs = new Date(link.expires_at).getTime()
  const maxAge = Math.max(0, Math.floor((expMs - Date.now()) / 1000))
  response.cookies.set(VIEWER_COOKIE, signToken({ role: 'viewer', linkId: link.id, exp: expMs }), { ...cookieOpts, maxAge })
}

export function clearSessionCookies(response) {
  response.cookies.set(OWNER_COOKIE, '', { ...cookieOpts, maxAge: 0 })
  response.cookies.set(VIEWER_COOKIE, '', { ...cookieOpts, maxAge: 0 })
}
