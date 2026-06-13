// Full Auth.js v5 config with Drizzle adapter — server-side only
import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { db } from '@/lib/drizzle/client'
import { authConfig } from './auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
  providers: [
    Google,
    Resend({ from: process.env.EMAIL_FROM }),
  ],
  session: { strategy: 'database' },
})
