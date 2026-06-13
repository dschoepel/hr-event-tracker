// Tier 1 — SQLite via Node.js built-in (requires Node 23+, no native compilation)
const { DatabaseSync } = require('node:sqlite')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', '__APP_NAME__.db')

let db

function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS example (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `)

  console.log('Database initialized at', DB_PATH)
}

// lastInsertRowid returns BigInt — convert before JSON serialization
function insertExample(name) {
  const stmt = getDb().prepare('INSERT INTO example (name) VALUES (?)')
  const result = stmt.run(name)
  return Number(result.lastInsertRowid)
}

module.exports = { getDb, initDb, insertExample }
