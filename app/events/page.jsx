'use client'
import { useEffect, useState, useMemo } from 'react'
import { Table, Tag, Card, App, Typography, Popconfirm, Button, Space, Row, Col, Badge, Upload } from 'antd'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Link from 'next/link'

const { Title, Text } = Typography

const fmtDuration = v => { const s = Math.round(v); return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s` }

const eventTime = r => r.ride_start_time
  ? new Date(new Date(r.ride_start_time).getTime() + r.start_time_seconds * 1000)
  : r.created_at ? new Date(r.created_at + 'Z') : null

const eventMonthKey = r => { const t = eventTime(r); return t ? t.toISOString().slice(0, 7) : '?' }

const rideLabel = r => {
  const name = r.ride_name || r.filename || 'Unknown'
  const dateStr = r.ride_start_time
    ? new Date(r.ride_start_time).toLocaleDateString()
    : r.file_ride_date ?? null
  return dateStr ? `${name} — ${dateStr}` : name
}

function byMonth(events) {
  const map = {}
  for (const e of events) {
    const m = eventMonthKey(e)
    map[m] = (map[m] || 0) + 1
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      label: new Date(month + '-02').toLocaleString('default', { month: 'short', year: '2-digit' }),
      count,
    }))
}

function byRide(events) {
  const map = {}
  for (const e of events) {
    const key = e.gpx_file_id ?? e.filename ?? 'Unknown'
    if (!map[key]) map[key] = { label: rideLabel(e), count: 0 }
    map[key].count++
  }
  return Object.values(map).sort((a, b) => b.count - a.count)
}

function groupByMonth(events) {
  // group by month
  const monthMap = {}
  for (const e of events) {
    const m = eventMonthKey(e)
    if (!monthMap[m]) monthMap[m] = []
    monthMap[m].push(e)
  }

  return Object.entries(monthMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, evts]) => {
      // group by gpx_file_id within month
      const rideMap = {}
      for (const e of evts) {
        const rk = e.gpx_file_id ?? `unknown-${e.id}`
        if (!rideMap[rk]) rideMap[rk] = []
        rideMap[rk].push(e)
      }

      const rides = Object.entries(rideMap)
        .sort(([, a], [, b]) => (eventTime(b[0]) ?? 0) - (eventTime(a[0]) ?? 0))
        .map(([rk, revts]) => ({
          key: `ride-${rk}`,
          label: rideLabel(revts[0]),
          count: revts.length,
          events: revts.sort((a, b) => (eventTime(a) ?? 0) - (eventTime(b) ?? 0)),
        }))

      return {
        key: month,
        label: new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' }),
        count: evts.length,
        rides,
      }
    })
}

export default function EventHistoryPage() {
  const { message } = App.useApp()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/events')
      .then(r => r.json())
      .then(setEvents)
      .catch(() => message.error('Failed to load events'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const monthData   = useMemo(() => byMonth(events),       [events])
  const rideData    = useMemo(() => byRide(events),        [events])
  const monthGroups = useMemo(() => groupByMonth(events),  [events])

  const handleUpload = async ({ file }) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/gpx', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      message.success(`Detected ${data.candidates?.length ?? 0} event(s) — history updated`)
      load()
    } catch (err) {
      message.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

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

  const eventRow = r => (
    <div>
      <div style={{ color: '#666', fontSize: 13 }}>
        HR jumped <strong>{r.jump_magnitude} bpm</strong> from <strong>{r.baseline_before}</strong> to <strong>{r.peak_hr} bpm</strong> and
        dropped <strong>{r.drop_magnitude} bpm</strong> back to <strong>{r.hr_after_drop} bpm</strong> after <strong>{fmtDuration(r.duration_seconds)}</strong>.
      </div>
    </div>
  )

  const eventColumns = [
    {
      title: 'Time',
      key: 'event_time',
      width: 180,
      render: (_, r) => eventTime(r)?.toLocaleTimeString() ?? '—',
    },
    { title: 'Summary', key: 'summary', render: (_, r) => eventRow(r) },
    {
      title: 'Confirmed',
      dataIndex: 'confirmed',
      width: 100,
      render: v => <Tag color={v ? 'success' : 'default'}>{v ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
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

  const rideColumns = [
    {
      title: '',
      dataIndex: 'label',
      render: (label, r) => (
        <span>
          <Text strong>{label}</Text>
          {r.count === 1 && <span style={{ marginLeft: 12 }}>{eventRow(r.events[0])}</span>}
        </span>
      ),
    },
    {
      title: '',
      dataIndex: 'count',
      width: 90,
      render: count => <Badge count={count} color="#d32f2f" showZero />,
    },
    {
      title: 'Confirmed',
      key: 'confirmed',
      width: 110,
      render: (_, r) => r.count === 1
        ? <Tag color={r.events[0].confirmed ? 'success' : 'default'}>{r.events[0].confirmed ? 'Yes' : 'No'}</Tag>
        : null,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, r) => r.count === 1 ? (
        <Space>
          <Link href={`/events/${r.events[0].id}`}>View</Link>
          <Popconfirm
            title="Delete this event?"
            description="This cannot be undone."
            onConfirm={() => handleDelete(r.events[0].id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ) : null,
    },
  ]

  const monthColumns = [
    {
      title: 'Month',
      dataIndex: 'label',
      render: label => <Text strong style={{ fontSize: 15 }}>{label}</Text>,
    },
    {
      title: 'Events',
      dataIndex: 'count',
      width: 90,
      render: count => <Badge count={count} color="#d32f2f" showZero />,
    },
  ]

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>

      {!loading && events.length > 0 && (
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="Events by Month" size="small">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => [v, 'Events']} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {monthData.map((_, i) => <Cell key={i} fill="#d32f2f" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Events by Ride" size="small" styles={{ body: { padding: '8px 16px' } }}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                {rideData.map(({ label, count }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text ellipsis style={{ flex: 1, fontSize: 12 }} title={label}>{label}</Text>
                    <Badge count={count} color="#d32f2f" style={{ marginLeft: 8, flexShrink: 0 }} />
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      <Card
        title={<Title level={3} style={{ margin: 0 }}>Event History</Title>}
        extra={
          <Upload customRequest={handleUpload} accept=".gpx" showUploadList={false}>
            <Button icon={<UploadOutlined />} loading={uploading} type="primary">Upload GPX</Button>
          </Upload>
        }
      >
        <Table
          rowKey="key"
          columns={monthColumns}
          dataSource={monthGroups}
          loading={loading}
          pagination={false}
          expandable={{
            defaultExpandAllRows: true,
            expandedRowRender: month => (
              <Table
                rowKey="key"
                columns={rideColumns}
                dataSource={month.rides}
                pagination={false}
                size="small"
                expandable={{
                  defaultExpandAllRows: true,
                  rowExpandable: ride => ride.count > 1,
                  expandedRowRender: ride => (
                    <Table
                      rowKey="id"
                      columns={eventColumns}
                      dataSource={ride.events}
                      pagination={false}
                      size="small"
                      style={{ margin: '0 0 8px 24px' }}
                    />
                  ),
                }}
              />
            ),
          }}
        />
      </Card>

    </Space>
  )
}
