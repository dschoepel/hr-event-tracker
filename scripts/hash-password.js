// Generates the OWNER_PASSWORD_HASH value for a chosen owner password.
//
// Usage: node scripts/hash-password.js '<your password>'
import { hashPassword } from '../lib/passwordHash.js'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>')
  process.exit(1)
}

const hash = await hashPassword(password)
console.log('\nAdd this to your .env.local (dev) or production env file:\n')
console.log(`OWNER_PASSWORD_HASH=${hash}\n`)
