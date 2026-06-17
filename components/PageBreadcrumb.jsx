'use client'
import { Breadcrumb } from 'antd'
import Link from 'next/link'

export default function PageBreadcrumb({ items }) {
  return (
    <Breadcrumb
      style={{ marginBottom: 16 }}
      items={items.map(item => ({
        title: item.href ? <Link href={item.href}>{item.label}</Link> : item.label,
      }))}
    />
  )
}
