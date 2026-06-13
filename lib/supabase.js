// Tier 3 — Supabase self-hosted clients
// Two-client pattern: anonClient (public) + adminClient (service role, server-only)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Singleton proxy pattern — one client instance per process
function createSingletonClient(url, key, options = {}) {
  let client = null
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (!client) client = createClient(url, key, options)
        return client[prop]
      },
    }
  )
}

// Public client — safe to use in client components (uses anon key)
export const supabase = createSingletonClient(supabaseUrl, supabaseAnonKey)

// Admin client — server-side only, bypasses RLS
export const supabaseAdmin = createSingletonClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
