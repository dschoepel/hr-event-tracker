'use client'
import { useEffect, useState } from 'react'
import { Table, Tag, Card, App, Typography, Popconfirm, Button, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title } = Typography

const fmtDuration = v => { const s = Math.round(v); return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s` }

export default function EventHistoryPage() {
  const { message } = App.useApp()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/events')
      .then(r => r.json())
      .then(setEvents)
      .catch(() => message.error('Failed to load events'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      message.success('Event deleted')
      setEvents(prev => prev.filter(e => e.id !== id))
    } catch {
      message.error('Delete failed')
    }
  }

  const columns = [
    {
      title: 'Date / Time',
      dataIndex: 'created_at',
      sorter: (a, b) => a.created_at.localeCompare(b.created_at),
      render: v => v ? new Date(v + 'Z').toLocaleString() : '—',
    },
    {
      title: 'File',
      dataIndex: 'filename',
      render: v => v ?? '—',
      ellipsis: true,
    },
    { title: 'Peak HR', dataIndex: 'peak_hr', sorter: (a, b) => a.peak_hr - b.peak_hr },
    { title: 'Jump (bpm)', dataIndex: 'jump_magnitude' },
    { title: 'Drop (bpm)', dataIndex: 'drop_magnitude' },
    { title: 'Duration', dataIndex: 'duration_seconds', render: fmtDuration },
    {
      title: 'Method',
      dataIndex: 'detection_method',
      render: v => <Tag color={v === 'auto' ? 'blue' : 'green'}>{v}</Tag>,
    },
    {
      title: 'Confirmed',
      dataIndex: 'confirmed',
      render: v => <Tag color={v ? 'success' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Link href={`/events/${r.id}`}>View</Link>
          <Popconfirm
            title="Delete this event?"
            description="This cannot be undone."
            onConfirm={() => handleDelete(r.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <Title level={3}>Event History</Title>
      <Table rowKey="id" columns={columns} dataSource={events} loading={loading} />
    </Card>
  )
}
