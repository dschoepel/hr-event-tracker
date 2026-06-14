'use client'
import { useState } from 'react'
import { Layout, Menu, Drawer, Button, Space } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { FaHeartbeat } from 'react-icons/fa'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const { Header } = Layout

const NAV_ITEMS = [
  { key: '/events', label: <Link href="/events">Event History</Link> },
]

export default function ResponsiveNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

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
      </Space>

      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[pathname]}
        items={NAV_ITEMS}
        className="desktop-nav"
        style={{ flex: 1, background: 'transparent', borderBottom: 'none', minWidth: 0 }}
      />

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
          items={NAV_ITEMS}
          onClick={() => setDrawerOpen(false)}
        />
      </Drawer>
    </Header>
  )
}
