import { NextResponse } from 'next/server'
import { verifyPassword, setOwnerCookie } from '@/lib/auth'

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}))

  const hash = process.env.OWNER_PASSWORD_HASH
  if (!hash) {
    console.error('OWNER_PASSWORD_HASH is not set — see scripts/hash-password.js')
    return NextResponse.json({ error: 'Login is not configured' }, { status: 500 })
  }

  if (!password || !(await verifyPassword(password, hash))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  setOwnerCookie(res)
  return res
}
