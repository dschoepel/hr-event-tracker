'use client'
import { useState } from 'react'
import { Layout, Menu, Drawer, Button } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const { Header } = Layout

// Add your nav items here — key should match the href
const NAV_ITEMS = [
  { key: '/', label: <Link href="/">Home</Link> },
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
      <span
        style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: 17,
          marginRight: 32,
          userSelect: 'none',
        }}
      >
        __APP_NAME__
      </span>

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
        title="__APP_NAME__"
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
