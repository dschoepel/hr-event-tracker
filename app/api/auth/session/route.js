import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// Public — returns only the current role, nothing sensitive. Used by the
// nav and event-detail page to decide what to render.
export async function GET(request) {
  const session = getSession(request)
  return NextResponse.json({ role: session?.role ?? null, label: session?.label ?? null })
}
