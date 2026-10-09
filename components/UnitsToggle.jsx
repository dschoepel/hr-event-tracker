'use client'
import { useEffect, useState } from 'react'
import { Segmented } from 'antd'
import { UNITS } from '@/lib/units'

const STORAGE_KEY = 'hr-tracker.units'

function readOverride() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return UNITS.includes(v) ? v : null
  } catch { return null }
}

// Units for distance/elevation: the viewer's toggle choice if they made one,
// otherwise the owner's default from Settings (display.units).
export function useUnits() {
  const [units, setUnitsState] = useState('imperial')

  useEffect(() => {
    const override = readOverride()
    if (override) { setUnitsState(override); return }
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (UNITS.includes(s?.display_units)) setUnitsState(s.display_units) })
      .catch(() => {})
  }, [])

  const setUnits = (v) => {
    setUnitsState(v)
    try { localStorage.setItem(STORAGE_KEY, v) } catch {}
  }

  return [units, setUnits]
}

export default function UnitsToggle({ units, onChange, size = 'small' }) {
  return (
    <Segmented
      size={size}
      value={units}
      onChange={onChange}
      options={[
        { label: 'mi / ft', value: 'imperial' },
        { label: 'km / m', value: 'metric' },
      ]}
    />
  )
}
