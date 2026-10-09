// Distance/elevation formatting shared by pages and the PDF template.
// Values are stored in meters; `units` is 'imperial' | 'metric'.

export const UNITS = ['imperial', 'metric']

export function fmtDistance(m, units) {
  if (m == null) return '—'
  return units === 'metric'
    ? `${(m / 1000).toFixed(1)} km`
    : `${(m / 1609.344).toFixed(1)} mi`
}

export function fmtElevation(m, units) {
  if (m == null) return '—'
  return units === 'metric'
    ? `${Math.round(m).toLocaleString('en-US')} m`
    : `${Math.round(m * 3.28084).toLocaleString('en-US')} ft`
}

export function fmtAvgHr(hr) {
  return hr == null ? '—' : `${hr} bpm`
}

// "64.5 mi · 4,311 ft gain · avg 117 bpm" — empty string when the ride has no stats
export function fmtRideStats(ride, units) {
  return [
    ride.distance_m != null && fmtDistance(ride.distance_m, units),
    ride.elevation_gain_m != null && `${fmtElevation(ride.elevation_gain_m, units)} gain`,
    ride.avg_hr != null && `avg ${ride.avg_hr} bpm`,
  ].filter(Boolean).join(' · ')
}
