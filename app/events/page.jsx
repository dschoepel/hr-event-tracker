'use client'
import { useEffect, useState } from 'react'
import { Table, Tag, Card, message, Typography } from 'antd'
import Link from 'next/link'

const { Title } = Typography

const columns = [
  { title: 'ID', dataIndex: 'id', sorter: (a, b) => a.id - b.id },
  { title: 'Peak HR', dataIndex: 'peak_hr', sorter: (a, b) => a.peak_hr - b.peak_hr },
  { title: 'Jump (bpm)', dataIndex: 'jump_magnitude' },
  { title: 'Drop (bpm)', dataIndex: 'drop_magnitude' },
  { title: 'Duration (s)', dataIndex: 'duration_seconds', render: v => Math.round(v) },
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
    title: 'Detail',
    key: 'detail',
    render: (_, r) => <Link href={`/events/${r.id}`}>View</Link>,
  },
]

export default function EventHistoryPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(setEvents)
      .catch(() => message.error('Failed to load events'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <Title level={3}>Event History</Title>
      <Table rowKey="id" columns={columns} dataSource={events} loading={loading} />
    </Card>
  )
}
