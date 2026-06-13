// Helpers for protecting API routes (Tier 2/3)
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function requireAuth(handler) {
  return async (req, ctx) => {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, ctx, session)
  }
}

export async function requireAdmin(handler) {
  return async (req, ctx) => {
    const session = await auth()
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
    if (!session?.user || !adminEmails.includes(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return handler(req, ctx, session)
  }
}
