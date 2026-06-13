'use client'
import { useTheme } from '@/contexts/ThemeContext'

export default function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 18,
        padding: '4px 8px',
      }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
