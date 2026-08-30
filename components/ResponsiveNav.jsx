'use client'
import { useEffect, useState } from 'react'
import { Layout, Menu, Drawer, Button, Space, Tag } from 'antd'
import { MenuOutlined, LogoutOutlined } from '@ant-design/icons'
import { FaHeartbeat } from 'react-icons/fa'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const { Header } = Layout

const OWNER_NAV_ITEMS = [
  { key: '/events',   label: <Link href="/events">Event History</Link> },
  { key: '/report',   label: <Link href="/report">Report</Link> },
  { key: '/settings', label: <Link href="/settings">Settings</Link> },
]

const VIEWER_NAV_ITEMS = [
  { key: '/report', label: <Link href="/report">Report</Link> },
]

export default function ResponsiveNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [role, setRole] = useState(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => setRole(d.role))
      .catch(() => setRole(null))
  }, [pathname])

  const navItems = role === 'owner' ? OWNER_NAV_ITEMS : role === 'viewer' ? VIEWER_NAV_ITEMS : []

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        background: 'var(--color-header-bg)',
      }}
    >
      <Space align="center" style={{ marginRight: 32 }}>
        <FaHeartbeat style={{ fontSize: 22, color: '#ff8a80', filter: 'drop-shadow(0 0 4px #ff5252aa)' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 17, userSelect: 'none' }}>
          HR Event Tracker
        </span>
        {role === 'viewer' && <Tag color="blue">Doctor View — read only</Tag>}
      </Space>

      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[pathname]}
        items={navItems}
        className="desktop-nav"
        style={{ flex: 1, background: 'transparent', borderBottom: 'none', minWidth: 0 }}
      />

      {role && (
        <Button
          type="text"
          icon={<LogoutOutlined />}
          className="desktop-nav"
          style={{ color: '#fff' }}
          onClick={signOut}
        >
          Sign out
        </Button>
      )}

      <Button
        type="text"
        icon={<MenuOutlined />}
        className="mobile-menu-btn"
        style={{ color: '#fff', marginLeft: 'auto' }}
        onClick={() => setDrawerOpen(true)}
      />

      <Drawer
        title="HR Event Tracker"
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={navItems}
          onClick={() => setDrawerOpen(false)}
        />
        {role && (
          <Button block icon={<LogoutOutlined />} onClick={signOut} style={{ marginTop: 16 }}>
            Sign out
          </Button>
        )}
      </Drawer>
    </Header>
  )
}
