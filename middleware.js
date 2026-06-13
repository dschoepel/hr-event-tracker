// Tier 2/3 — Auth.js v5 middleware for route protection
// Uses edge-compatible auth config (no DB adapter)
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
