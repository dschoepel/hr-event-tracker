// Runs once at server startup — initialize the SQLite DB before any requests
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDb } = await import('./lib/db.js')
    initDb()
  }
}
