import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import puppeteer from 'puppeteer-core'
import { getDb, getSettings } from '@/lib/db'
import { buildReportHtml } from '@/lib/reportTemplate'
import { getSession } from '@/lib/auth'
import { UNITS } from '@/lib/units'

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
  if (!getSession(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
    SELECT e.*, f.ride_name, f.ride_date AS file_ride_date, f.ride_start_time, f.filename,
           f.distance_m, f.elevation_gain_m, f.avg_hr
    FROM hr_events e
    LEFT JOIN gpx_files f ON f.id = e.gpx_file_id
    WHERE e.confirmed = 1`
  const params = []
  if (start) { sql += ' AND date(f.ride_start_time) >= ?'; params.push(start) }
  if (end)   { sql += ' AND date(f.ride_start_time) <= ?'; params.push(end) }
  sql += ' ORDER BY f.ride_start_time ASC, e.start_time_seconds ASC'
  const events = db.prepare(sql).all(...params)

  const settings = getSettings()
  const unitsParam = searchParams.get('units')
  const units = UNITS.includes(unitsParam) ? unitsParam : settings.display_units
  const html = buildReportHtml(events, settings, { units })

  // The production container is read-only except /tmp, and Chromium (and its
  // crashpad handler) need a writable home/profile dir or they fail to launch
  // ("chrome_crashpad_handler: --database is required"). Give each render its
  // own throwaway home under /tmp and turn the crash reporter off.
  const chromeHome = mkdtempSync(join(tmpdir(), 'hret-chromium-'))
  let browser
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      userDataDir: join(chromeHome, 'profile'),
      env: { ...process.env, HOME: chromeHome, XDG_CONFIG_HOME: chromeHome, XDG_CACHE_HOME: chromeHome },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-crash-reporter',
        '--no-crashpad',
      ],
    })
  } catch (err) {
    console.error(err)
    rmSync(chromeHome, { recursive: true, force: true })
    return new Response(
      JSON.stringify({ error: `Could not start the PDF renderer: ${err.message.split('\n')[0]}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

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
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: `PDF generation failed: ${err.message.split('\n')[0]}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  } finally {
    await browser.close()
    rmSync(chromeHome, { recursive: true, force: true })
  }
}
