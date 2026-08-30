// Owner password hashing — split out from lib/auth.js so it has zero
// dependency on `next/server`. That lets scripts/hash-password.js run under
// plain `node` (Next's package exports don't resolve outside Next's own
// bundler), while lib/auth.js still re-exports these for route handlers.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export async function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scryptAsync(plain, salt, 64)
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(plain, stored) {
  if (!plain || !stored) return false
  const [salt, hashHex] = stored.split(':')
  if (!salt || !hashHex) return false
  const derived = await scryptAsync(plain, salt, 64)
  const storedBuf = Buffer.from(hashHex, 'hex')
  return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf)
}
