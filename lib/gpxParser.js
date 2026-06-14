import { parseStringPromise } from 'xml2js'

export async function parseGpx(buffer) {
  const result = await parseStringPromise(buffer.toString('utf8'), { explicitArray: true })

  const rideName = result?.gpx?.trk?.[0]?.name?.[0] ?? result?.gpx?.metadata?.[0]?.name?.[0] ?? null
  const tracks = result?.gpx?.trk || []
  const points = []

  for (const trk of tracks) {
    for (const seg of trk.trkseg || []) {
      for (const pt of seg.trkpt || []) {
        const timeStr = pt.time?.[0]
        const hrEl = pt.extensions?.[0]?.['gpxtpx:TrackPointExtension']?.[0]?.['gpxtpx:hr']?.[0]
        if (!timeStr || !hrEl) continue
        const wattsEl = pt.extensions?.[0]?.power?.[0]
        const hr = parseInt(hrEl, 10)
        if (hr < 20) continue  // skip sensor dropout
        const point = { time: new Date(timeStr), hr }
        if (wattsEl != null) point.watts = parseInt(wattsEl, 10)
        points.push(point)
      }
    }
  }

  if (points.length === 0) return { hrStream: [], metadata: {} }

  const t0 = points[0].time.getTime()
  const hasPower = points.some(p => p.watts != null)
  const hrStream = points.map((p) => {
    const point = { t: Math.round((p.time.getTime() - t0) / 1000), hr: p.hr }
    if (hasPower) point.watts = p.watts ?? null
    return point
  })

  const duration = hrStream[hrStream.length - 1].t
  const rideStart = points[0].time
  const rideDate = rideStart.toISOString().slice(0, 10)

  return { hrStream, metadata: { ride_name: rideName, ride_date: rideDate, ride_start_time: rideStart.toISOString(), duration_seconds: duration } }
}

export function detectSpikes(hrStream, {
  threshold = 60,
  minBaseline = 50,
  dropRequired = 30,
  peakScanSeconds = 180,
  dropWindowSeconds = Infinity,
  dedupeSeconds = 60,
  preTrigger = 20,
} = {}) {
  const candidates = []
  const WINDOW = 5

  for (let i = WINDOW; i < hrStream.length; i++) {
    const preWindow = hrStream.slice(i - WINDOW, i)
    const baseline = Math.min(...preWindow.map((p) => p.hr))
    const trigger = hrStream[i]

    if (baseline < minBaseline) continue
    if (trigger.hr - baseline < preTrigger) continue  // cheap pre-filter before peak scan

    let peakHr = trigger.hr
    let peakIdx = i
    for (let k = i + 1; k < hrStream.length; k++) {
      if (hrStream[k].t - trigger.t > peakScanSeconds) break
      if (hrStream[k].hr > peakHr) {
        peakHr = hrStream[k].hr
        peakIdx = k
      }
    }

    if (peakHr - baseline < threshold) continue  // threshold check on full peak, not trigger

    const peakPoint = hrStream[peakIdx]

    let dropped = false
    let dropPoint = null
    for (let j = peakIdx + 1; j < hrStream.length; j++) {
      if (hrStream[j].t - peakPoint.t > dropWindowSeconds) break
      if (hrStream[j].hr < 40) continue  // skip sensor dropout
      if (peakHr - hrStream[j].hr >= dropRequired) {
        dropped = true
        // Scan the full remaining stream for the true settle HR, ignoring dropouts
        let settleHr = hrStream[j].hr
        let settleIdx = j
        for (let k = j + 1; k < hrStream.length; k++) {
          if (hrStream[k].hr < 40) continue  // skip sensor dropout
          if (hrStream[k].hr < settleHr) {
            settleHr = hrStream[k].hr
            settleIdx = k
          }
          // Stop once HR has recovered to within 20 bpm of onset — any further
          // dip is normal riding variation, not part of the SVT event
          if (settleHr <= baseline + 20) break
        }
        // If HR never returned to near onset, data ended before full recovery
        const truncated = settleHr > baseline + 20
        dropPoint = { ...hrStream[settleIdx], hr: truncated ? baseline : settleHr, truncated }
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
      data_truncated: dropPoint.truncated ? 1 : 0,
    })

    i = peakIdx
  }

  return candidates
}
