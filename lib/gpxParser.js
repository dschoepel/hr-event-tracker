import { parseStringPromise } from 'xml2js'

export async function parseGpx(buffer) {
  const result = await parseStringPromise(buffer.toString('utf8'), { explicitArray: true })

  const tracks = result?.gpx?.trk || []
  const points = []

  for (const trk of tracks) {
    for (const seg of trk.trkseg || []) {
      for (const pt of seg.trkpt || []) {
        const timeStr = pt.time?.[0]
        const hrEl = pt.extensions?.[0]?.['gpxtpx:TrackPointExtension']?.[0]?.['gpxtpx:hr']?.[0]
        if (!timeStr || !hrEl) continue
        points.push({ time: new Date(timeStr), hr: parseInt(hrEl, 10) })
      }
    }
  }

  if (points.length === 0) return { hrStream: [], metadata: {} }

  const t0 = points[0].time.getTime()
  const hrStream = points.map((p) => ({
    t: Math.round((p.time.getTime() - t0) / 1000),
    hr: p.hr,
  }))

  const duration = hrStream[hrStream.length - 1].t
  const rideDate = points[0].time.toISOString().slice(0, 10)

  return { hrStream, metadata: { ride_date: rideDate, duration_seconds: duration } }
}

export function detectSpikes(hrStream, {
  threshold = 60,
  minBaseline = 50,
  dropRequired = 30,
  peakScanSeconds = 180,
  dropWindowSeconds = Infinity,
  dedupeSeconds = 60,
} = {}) {
  const candidates = []
  const WINDOW = 5

  for (let i = WINDOW; i < hrStream.length; i++) {
    const preWindow = hrStream.slice(i - WINDOW, i)
    const baseline = Math.min(...preWindow.map((p) => p.hr))
    const trigger = hrStream[i]

    if (baseline < minBaseline) continue
    if (trigger.hr - baseline < threshold) continue

    let peakHr = trigger.hr
    let peakIdx = i
    for (let k = i + 1; k < hrStream.length; k++) {
      if (hrStream[k].t - trigger.t > peakScanSeconds) break
      if (hrStream[k].hr > peakHr) {
        peakHr = hrStream[k].hr
        peakIdx = k
      }
    }
    const peakPoint = hrStream[peakIdx]

    let dropped = false
    let dropPoint = null
    for (let j = peakIdx + 1; j < hrStream.length; j++) {
      if (hrStream[j].t - peakPoint.t > dropWindowSeconds) break
      if (peakHr - hrStream[j].hr >= dropRequired) {
        dropped = true
        dropPoint = hrStream[j]
        break
      }
    }

    if (!dropped) continue

    const lastCandidate = candidates[candidates.length - 1]
    if (lastCandidate && trigger.t - lastCandidate.start_time_seconds < dedupeSeconds) continue

    candidates.push({
      start_time_seconds: preWindow[0].t,
      peak_hr: peakHr,
      peak_time_seconds: peakPoint.t,
      baseline_before: baseline,
      hr_after_drop: dropPoint.hr,
      drop_time_seconds: dropPoint.t,
      duration_seconds: dropPoint.t - preWindow[0].t,
      jump_magnitude: peakHr - baseline,
      drop_magnitude: peakHr - dropPoint.hr,
      detection_method: 'auto',
    })

    i = peakIdx
  }

  return candidates
}
