import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { getDb, GPX_DIR } from '@/lib/db'

export async function DELETE(request, { params }) {
  const id = Number((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const db = getDb()
    const fileRow = db.prepare('SELECT original_path FROM gpx_files WHERE id = ?').get(id)
    if (!fileRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const filePath = fileRow.original_path || join(GPX_DIR, `${id}.gpx`)
    if (existsSync(filePath)) unlinkSync(filePath)

    // CASCADE deletes hr_streams and hr_events
    db.prepare('DELETE FROM gpx_files WHERE id = ?').run(id)

    return NextResponse.json({ deleted: id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
