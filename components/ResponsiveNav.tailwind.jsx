'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { key: '/', label: 'Home', href: '/' },
]

export default function ResponsiveNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav style={{ background: 'var(--color-header-bg)' }}>
      <div className="flex items-center justify-between px-6 py-3">
        <span className="text-white font-bold text-lg select-none">__APP_NAME__</span>

        {/* Desktop links */}
        <ul className="hidden md:flex gap-6 list-none">
          {NAV_ITEMS.map(item => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`text-sm ${
                  pathname === item.href ? 'text-white font-semibold' : 'text-white/70 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-1"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className="block w-5 h-0.5 bg-white mb-1" />
          <span className="block w-5 h-0.5 bg-white mb-1" />
          <span className="block w-5 h-0.5 bg-white" />
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <ul className="md:hidden list-none px-6 pb-4 flex flex-col gap-3">
          {NAV_ITEMS.map(item => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="text-white/80 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
