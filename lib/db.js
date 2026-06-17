import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || join(__dirname, '../data/hr_events.db')
export const GPX_DIR = process.env.GPX_PATH || join(dirname(DB_PATH), 'gpx')

let db

export function getDb() {
  if (!db) initDb()
  return db
}

export function initDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true })
  mkdirSync(GPX_DIR, { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS gpx_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_path TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      ride_name TEXT,
      ride_date TEXT,
      ride_start_time TEXT,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS hr_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpx_file_id INTEGER NOT NULL REFERENCES gpx_files(id) ON DELETE CASCADE,
      stream_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hr_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gpx_file_id INTEGER NOT NULL REFERENCES gpx_files(id) ON DELETE CASCADE,
      start_time_seconds REAL,
      peak_hr INTEGER,
      peak_time_seconds REAL,
      baseline_before INTEGER,
      hr_after_drop INTEGER,
      drop_time_seconds REAL,
      duration_seconds REAL,
      jump_magnitude INTEGER,
      drop_magnitude INTEGER,
      detection_method TEXT NOT NULL DEFAULT 'auto',
      confirmed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      frontier_session_ref TEXT,
      data_truncated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  try { db.exec('ALTER TABLE gpx_files ADD COLUMN ride_start_time TEXT') } catch {}
  try { db.exec('ALTER TABLE hr_events ADD COLUMN data_truncated INTEGER NOT NULL DEFAULT 0') } catch {}

  console.log('Database initialized at', DB_PATH)
  return db
}

export const DETECTION_DEFAULTS = { jumpThreshold: 60, minBaselineHr: 50, dropRequired: 30 }

export function getSettings() {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    jumpThreshold: Number(map['detection.jumpThreshold'] ?? DETECTION_DEFAULTS.jumpThreshold),
    minBaselineHr: Number(map['detection.minBaselineHr'] ?? DETECTION_DEFAULTS.minBaselineHr),
    dropRequired:  Number(map['detection.dropRequired']  ?? DETECTION_DEFAULTS.dropRequired),
    report_activityType: map['report.activityType'] ?? 'Indoor cycling (Zwift)',
    report_hrDevice:     map['report.hrDevice']     ?? 'Frontier X2',
    report_appUrl:       map['report.appUrl']       ?? '',
  }
}
