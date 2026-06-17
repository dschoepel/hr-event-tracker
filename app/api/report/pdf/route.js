import { existsSync } from 'fs'
import puppeteer from 'puppeteer-core'
import { getDb, getSettings } from '@/lib/db'
import { buildReportHtml } from '@/lib/reportTemplate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  // Common browser paths for local development (Chrome, Edge, Chromium)
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') // YYYY-MM-DD or null
  const end   = searchParams.get('end')   // YYYY-MM-DD or null

  const chromePath = getChromePath()
  if (!chromePath) {
    return new Response(
      JSON.stringify({ error: 'Chromium not found. Set PUPPETEER_EXECUTABLE_PATH in your environment.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const db = getDb()
  let sql = `
    SELECT e.*, f.ride_name, f.ride_date AS file_ride_date, f.ride_start_time, f.filename
    FROM hr_events e
    LEFT JOIN gpx_files f ON f.id = e.gpx_file_id
    WHERE e.confirmed = 1`
  const params = []
  if (start) { sql += ' AND date(f.ride_start_time) >= ?'; params.push(start) }
  if (end)   { sql += ' AND date(f.ride_start_time) <= ?'; params.push(end) }
  sql += ' ORDER BY f.ride_start_time ASC, e.start_time_seconds ASC'
  const events = db.prepare(sql).all(...params)

  const settings = getSettings()
  const html = buildReportHtml(events, settings)

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const suffix = (start && end) ? `${start}_${end}` : new Date().toISOString().slice(0, 10)
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-family:Arial,sans-serif;font-size:9px;color:#666;
        text-align:center;width:100%;box-sizing:border-box;padding:0 15mm;">
        HR Episode Log &nbsp;&middot;&nbsp;
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        &nbsp;&middot;&nbsp; <span class="date"></span>
      </div>`,
      margin: { top: '12mm', bottom: '18mm', left: '12mm', right: '12mm' },
    })

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="HR-Episode-Log-${suffix}.pdf"`,
      },
    })
  } finally {
    await browser.close()
  }
}
