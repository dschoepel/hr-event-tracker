import { NextResponse } from 'next/server'

// Coarse, edge-safe gate: checks cookie *presence* only (no crypto — that
// needs node:crypto, which isn't available in the Edge runtime middleware
// runs in). Real verification — signature, expiry, and share-link
// revocation — happens in each API route handler via lib/auth.js, which is
// the actual security boundary since all data flows through those routes.
//
// Cookie names must match lib/auth.js (OWNER_COOKIE / VIEWER_COOKIE).
const OWNER_COOKIE = 'hret_owner'
const VIEWER_COOKIE = 'hret_viewer'

// Pages a viewer (doctor) session may open.
const VIEWER_ALLOWED = [/^\/report(\/|$)/, /^\/events\/[^/]+\/?$/]

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (request.cookies.has(OWNER_COOKIE)) return NextResponse.next()

  if (request.cookies.has(VIEWER_COOKIE)) {
    if (VIEWER_ALLOWED.some(re => re.test(pathname))) return NextResponse.next()
    return NextResponse.redirect(new URL('/report', request.url))
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  // Pages only — /api/* and /share/* self-enforce with real verification;
  // /login must stay reachable without a session or nobody could log in.
  matcher: ['/((?!api|share|login|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
