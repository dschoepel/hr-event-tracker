// Builds an absolute URL for a redirect using the headers a reverse proxy
// sets to describe the client-facing request (X-Forwarded-Proto /
// X-Forwarded-Host), falling back to the request's own URL.
//
// Needed because request.url's host reflects whatever Host header actually
// reached the Next.js process. If the reverse proxy in front of it doesn't
// rewrite that header (a common nginx misconfiguration — it then falls back
// to sending its own upstream target as Host), request.url ends up pointing
// at the container's internal bind address instead of the public domain.
//
// Edge-safe: only uses Web-standard Request/Headers APIs, so this is safe to
// import from middleware.js as well as Node-runtime route handlers.
export function publicUrl(path, request) {
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  return new URL(path, `${proto}://${host}`)
}
