'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Table, Tag, Card, App, Typography, Popconfirm, Button, Space, Row, Col, Badge, Upload, Dropdown, Statistic, Collapse } from 'antd'
import { DeleteOutlined, UploadOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
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
    if (!map[key]) map[key] = { key, label: rideLabel(e), count: 0 }
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
  const { message, modal } = App.useApp()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [rerunningId, setRerunningId] = useState(null)
  const [expandedMonths, setExpandedMonths] = useState([])
  const [highlightId, setHighlightId] = useState(null)
  const [highlightGpxId, setHighlightGpxId] = useState(null)
  const expandInitialized = useRef(false)

  const load = () => {
    setLoading(true)
    fetch('/api/events')
      .then(r => r.json())
      .then(setEvents)
      .catch(() => message.error('Failed to load events'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get('highlight')
    if (h) setHighlightId(Number(h))
  }, [])

  const monthData   = useMemo(() => byMonth(events),       [events])
  const rideData    = useMemo(() => byRide(events),        [events])
  const monthGroups = useMemo(() => groupByMonth(events),  [events])

  // Restore saved expand state on first load; expand all if nothing saved
  useEffect(() => {
    if (!loading && monthGroups.length > 0 && !expandInitialized.current) {
      expandInitialized.current = true
      try {
        const saved = sessionStorage.getItem('hr-expanded-months')
        const parsed = saved !== null ? JSON.parse(saved) : null
        setExpandedMonths(Array.isArray(parsed) && parsed.length > 0
          ? parsed
          : monthGroups.map(m => m.key))
      } catch {
        setExpandedMonths(monthGroups.map(m => m.key))
      }
    }
  }, [loading, monthGroups])

  // Persist expanded state so it survives back-navigation
  useEffect(() => {
    if (expandInitialized.current)
      sessionStorage.setItem('hr-expanded-months', JSON.stringify(expandedMonths))
  }, [expandedMonths])

  // Scroll to highlighted row; for gpx highlights also ensure the month is expanded
  useEffect(() => {
    if ((!highlightId && !highlightGpxId) || loading) return
    if (highlightGpxId) {
      const evt = events.find(e => e.gpx_file_id === highlightGpxId)
      if (evt) {
        const monthKey = eventMonthKey(evt)
        setExpandedMonths(prev => prev.includes(monthKey) ? prev : [...prev, monthKey])
      }
    }
    const t = setTimeout(() => {
      const el = document.querySelector('[data-highlight="true"]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    return () => clearTimeout(t)
  }, [highlightId, highlightGpxId, loading])

  const doUpload = async (file, force = false, saveEmpty = false) => {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    if (force)     params.set('force', 'true')
    if (saveEmpty) params.set('save',  'true')
    const url = `/api/gpx${params.size ? '?' + params : ''}`
    const res = await fetch(url, { method: 'POST', body: formData })
    const data = await res.json()

    if (res.status === 409 && data.duplicate) {
      const ex = data.existing
      const uploadedOn = new Date(ex.uploaded_at + 'Z').toLocaleDateString()
      modal.confirm({
        title: 'Duplicate ride detected',
        content: (
          <div>
            <p>This file appears to be a duplicate of a previously uploaded ride:</p>
            <p><strong>{ex.ride_name || ex.filename}</strong><br />
            Uploaded {uploadedOn} · {ex.event_count} event{ex.event_count !== 1 ? 's' : ''} detected</p>
            <p>Upload anyway? The file will be marked as a duplicate.</p>
          </div>
        ),
        okText: 'Upload Anyway',
        cancelText: 'Cancel',
        onOk: () => doUpload(file, true, saveEmpty),
      })
      return
    }

    if (data.noEvents) {
      const rideName = data.metadata?.ride_name || file.name
      const rideDate = data.metadata?.ride_date
        ? new Date(data.metadata.ride_date + 'T12:00:00').toLocaleDateString()
        : null
      modal.confirm({
        title: 'No events detected',
        content: (
          <div>
            <p>No SVT events were found in <strong>{rideName}</strong>{rideDate ? ` (${rideDate})` : ''}.</p>
            <p>Save this ride to history anyway, or discard it?</p>
          </div>
        ),
        okText: 'Save to History',
        cancelText: 'Discard',
        onOk: () => doUpload(file, force, true),
      })
      return
    }

    if (!res.ok) throw new Error(data.error)
    message.success(`Detected ${data.candidates?.length ?? 0} event(s) — history updated`)
    if (data.gpx_file_id) setHighlightGpxId(data.gpx_file_id)
    load()
  }

  const handleUpload = async ({ file }) => {
    setUploading(true)
    try {
      await doUpload(file)
    } catch (err) {
      message.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const deleteGpxFile = async (gpxFileId, reason) => {
    modal.confirm({
      title: 'Remove GPX file?',
      content: reason,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Keep',
      onOk: async () => {
        const res = await fetch(`/api/gpx/${gpxFileId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to remove GPX file')
        load()
      },
    })
  }

  const handleDelete = async (id) => {
    const evt = events.find(e => e.id === id)
    const gpxFileId = evt?.gpx_file_id
    const rideName = evt?.ride_name || 'this ride'
    const remaining = events.filter(e => e.gpx_file_id === gpxFileId && e.id !== id).length

    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      message.success('Event deleted')
      setEvents(prev => prev.filter(e => e.id !== id))

      if (remaining === 0 && gpxFileId) {
        deleteGpxFile(gpxFileId, `"${rideName}" has no remaining events. Remove the saved GPX file for this ride?`)
      }
    } catch {
      message.error('Delete failed')
    }
  }

  const handleRerun = async (gpxFileId) => {
    setRerunningId(gpxFileId)
    const rideName = events.find(e => e.gpx_file_id === gpxFileId)?.ride_name || 'this ride'
    try {
      const res = await fetch(`/api/gpx/${gpxFileId}/rerun`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.eventsFound === 0) {
        load()
        deleteGpxFile(gpxFileId, `No SVT events were detected for "${rideName}" with the current thresholds. Remove the saved GPX file?`)
      } else {
        message.success(`Re-detection complete — ${data.eventsFound} event(s) found`)
        load()
      }
    } catch (err) {
      message.error(`Rerun failed: ${err.message}`)
    } finally {
      setRerunningId(null)
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
      width: 140,
      render: (_, r) => {
        const gpxFileId = r.events[0]?.gpx_file_id
        return (
          <Space>
            {r.count === 1 && <Link href={`/events/${r.events[0].id}`}>View</Link>}
            {r.count === 1 && (
              <Popconfirm
                title="Delete this event?"
                description="This cannot be undone."
                onConfirm={() => handleDelete(r.events[0].id)}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            )}
            <Button
              type="text"
              icon={<ReloadOutlined />}
              size="small"
              loading={rerunningId === gpxFileId}
              onClick={() => handleRerun(gpxFileId)}
              title="Re-run detection"
            />
          </Space>
        )
      },
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
            <Card title="Summary" size="small">
              <Row gutter={[8, 16]} style={{ marginBottom: 12 }}>
                {[
                  { label: 'Total Events',  value: events.length },
                  { label: 'Confirmed SVT', value: events.filter(e => e.confirmed).length },
                  {
                    label: 'Avg Peak HR',
                    value: Math.round(events.reduce((s, e) => s + e.peak_hr, 0) / events.length),
                    suffix: 'bpm',
                  },
                  {
                    label: 'Avg Duration',
                    value: fmtDuration(events.reduce((s, e) => s + e.duration_seconds, 0) / events.length),
                  },
                ].map(({ label, value, suffix }) => (
                  <Col span={12} key={label}>
                    <Statistic title={label} value={value} suffix={suffix} styles={{ content: { fontSize: 20 } }} />
                  </Col>
                ))}
              </Row>
              {(() => {
                const multiRides = rideData.filter(r => r.count >= 2)
                if (!multiRides.length) return null
                return (
                  <Collapse
                    size="small"
                    ghost
                    items={[{
                      key: 'multi',
                      label: <Space size={6}><Badge count={multiRides.length} color="#d32f2f" /><Text style={{ fontSize: 12 }}>ride{multiRides.length > 1 ? 's' : ''} with multiple events</Text></Space>,
                      children: (
                        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                          {multiRides.map(({ key, label, count }) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text ellipsis style={{ flex: 1, fontSize: 12 }} title={label}>{label}</Text>
                              <Badge count={count} color="#d32f2f" style={{ marginLeft: 8, flexShrink: 0 }} />
                            </div>
                          ))}
                        </Space>
                      ),
                    }]}
                  />
                )
              })()}
            </Card>
          </Col>
        </Row>
      )}

      <Card
        title={<Title level={3} style={{ margin: 0 }}>Event History</Title>}
        extra={
          <Space>
            <Button
              size="small"
              disabled={monthGroups.length === 0}
              onClick={() => setExpandedMonths(
                expandedMonths.length === monthGroups.length
                  ? []
                  : monthGroups.map(m => m.key)
              )}
            >
              {expandedMonths.length === monthGroups.length ? 'Collapse All' : 'Expand All'}
            </Button>
            <Dropdown menu={{
              items: [
                { key: 'csv',  label: <a href="/api/events/export?format=csv"  download>Download CSV</a> },
                { key: 'json', label: <a href="/api/events/export?format=json" download>Download JSON</a> },
              ],
            }}>
              <Button icon={<DownloadOutlined />}>Export</Button>
            </Dropdown>
            <Upload customRequest={handleUpload} accept=".gpx" showUploadList={false}>
              <Button icon={<UploadOutlined />} loading={uploading} type="primary">Upload GPX</Button>
            </Upload>
          </Space>
        }
      >
        <Table
          rowKey="key"
          columns={monthColumns}
          dataSource={monthGroups}
          loading={loading}
          pagination={false}
          expandable={{
            expandedRowKeys: expandedMonths,
            onExpandedRowsChange: setExpandedMonths,
            expandedRowRender: month => (
              <Table
                rowKey="key"
                columns={rideColumns}
                dataSource={month.rides}
                pagination={false}
                size="small"
                onRow={r => {
                  const byEvent = r.count === 1 && r.events[0].id === highlightId
                  const byGpx   = r.events[0]?.gpx_file_id === highlightGpxId
                  return (byEvent || byGpx) ? { 'data-highlight': 'true', style: { background: '#fffde7' } } : {}
                }}
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
                      onRow={r => r.id === highlightId ? {
                        'data-highlight': 'true',
                        style: { background: '#fffde7' },
                      } : {}}
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
