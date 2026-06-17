'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  App, Card, Tabs, Form, InputNumber, Input, Button, Space, Table, Badge, Tag,
  Typography, Tooltip,
} from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const DEFAULTS = { jumpThreshold: 60, minBaselineHr: 50, dropRequired: 30 }

function DetectionTab() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => form.setFieldsValue(data))
      .catch(() => message.error('Failed to load settings'))
  }, [])

  const save = async (values) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error()
      message.success('Settings saved')
    } catch {
      message.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    form.setFieldsValue(DEFAULTS)
    save(DEFAULTS)
  }

  return (
    <Card style={{ maxWidth: 480 }}>
      <Form form={form} layout="vertical" onFinish={save} initialValues={DEFAULTS}>
        <Form.Item
          label="Jump Threshold (bpm)"
          name="jumpThreshold"
          extra="Minimum HR increase required to flag an event. Raise to ignore smaller spikes."
          rules={[{ required: true, type: 'number', min: 1 }]}
        >
          <InputNumber min={1} max={200} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Min Baseline HR (bpm)"
          name="minBaselineHr"
          extra="Events where resting HR was below this value are ignored."
          rules={[{ required: true, type: 'number', min: 1 }]}
        >
          <InputNumber min={1} max={150} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Drop Required (bpm)"
          name="dropRequired"
          extra="HR must fall by at least this much from peak before the event ends."
          rules={[{ required: true, type: 'number', min: 1 }]}
        >
          <InputNumber min={1} max={200} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
            <Button onClick={reset}>Reset to Defaults</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

function GpxFilesTab() {
  const { message, modal } = App.useApp()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [rerunningId, setRerunningId] = useState(null)

  const load = () => {
    setLoading(true)
    fetch('/api/gpx')
      .then(r => r.json())
      .then(setFiles)
      .catch(() => message.error('Failed to load GPX files'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Group flat list by ride_name + ride_date (same route runs weekly need separate groups)
  const grouped = useMemo(() => {
    const map = {}
    for (const f of files) {
      const name = f.ride_name || f.filename
      const date = f.ride_date || f.uploaded_at?.slice(0, 10) || ''
      const key = `${name}|${date}`
      if (!map[key]) {
        const dateLabel = date ? new Date(date + 'T12:00:00').toLocaleDateString() : ''
        map[key] = { key, label: name, dateLabel, uploads: [] }
      }
      map[key].uploads.push(f)
    }
    return Object.values(map).map(g => ({
      ...g,
      totalEvents: g.uploads.reduce((s, f) => s + f.event_count, 0),
      anyFileSaved: g.uploads.some(f => f.file_exists),
      latestUpload: g.uploads.reduce((l, f) => f.uploaded_at > l ? f.uploaded_at : l, ''),
    })).sort((a, b) => b.latestUpload.localeCompare(a.latestUpload))
  }, [files])

  const orphans = files.filter(f => f.event_count === 0 && !f.file_exists)

  const handleRerun = async (id, rideName) => {
    setRerunningId(id)
    try {
      const res = await fetch(`/api/gpx/${id}/rerun`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      message.success(`Re-detection complete — ${data.eventsFound} event(s) found`)
      load()
    } catch (err) {
      message.error(`Rerun failed: ${err.message}`)
    } finally {
      setRerunningId(null)
    }
  }

  const handleDelete = (id, rideName) => {
    modal.confirm({
      title: 'Remove GPX file?',
      content: `This will permanently delete "${rideName}" and all its associated events and data.`,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        const res = await fetch(`/api/gpx/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Delete failed')
        load()
      },
    })
  }

  const handleCleanupOrphans = () => {
    modal.confirm({
      title: `Remove ${orphans.length} orphaned record${orphans.length > 1 ? 's' : ''}?`,
      content: 'These rides have no detected events and no GPX file on disk — they cannot be reprocessed. Remove them all?',
      okText: 'Remove All',
      okButtonProps: { danger: true },
      onOk: async () => {
        await Promise.all(orphans.map(f => fetch(`/api/gpx/${f.id}`, { method: 'DELETE' })))
        load()
      },
    })
  }

  const actionButtons = (id, rideName) => (
    <Space>
      <Tooltip title="Re-run detection with current thresholds">
        <Button type="text" icon={<ReloadOutlined />} size="small"
          loading={rerunningId === id}
          onClick={() => handleRerun(id, rideName)} />
      </Tooltip>
      <Tooltip title="Delete GPX file and all events">
        <Button type="text" danger icon={<DeleteOutlined />} size="small"
          onClick={() => handleDelete(id, rideName)} />
      </Tooltip>
    </Space>
  )

  const childColumns = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploaded_at',
      width: 130,
      render: v => new Date(v + 'Z').toLocaleDateString(),
    },
    {
      title: 'Episodes',
      dataIndex: 'event_count',
      width: 80,
      align: 'center',
      render: n => <Badge count={n} color={n > 0 ? '#d32f2f' : '#bbb'} showZero />,
    },
    {
      title: 'File',
      dataIndex: 'file_exists',
      width: 90,
      align: 'center',
      render: v => <Tag color={v ? 'success' : 'default'}>{v ? 'Saved' : 'Missing'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, r) => actionButtons(r.id, r.ride_name || r.filename),
    },
  ]

  const parentColumns = [
    {
      title: 'Ride',
      key: 'ride',
      render: (_, r) => (
        <span>
          <Text strong>{r.label}</Text>
          {r.dateLabel && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>— {r.dateLabel}</Text>}
          {r.uploads.length > 1 && (
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              ({r.uploads.length} uploads)
            </Text>
          )}
        </span>
      ),
    },
    {
      title: 'Uploaded',
      key: 'uploaded',
      width: 130,
      render: (_, r) => new Date(r.latestUpload + 'Z').toLocaleDateString(),
    },
    {
      title: 'Episodes',
      key: 'events',
      width: 80,
      align: 'center',
      render: (_, r) => <Badge count={r.totalEvents} color={r.totalEvents > 0 ? '#d32f2f' : '#bbb'} showZero />,
    },
    {
      title: 'File',
      key: 'file',
      width: 90,
      align: 'center',
      render: (_, r) => {
        const label = r.uploads.length > 1
          ? (r.anyFileSaved ? 'Some saved' : 'All missing')
          : (r.anyFileSaved ? 'Saved' : 'Missing')
        return <Tag color={r.anyFileSaved ? 'success' : 'default'}>{label}</Tag>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, r) => r.uploads.length === 1
        ? actionButtons(r.uploads[0].id, r.label)
        : null,
    },
  ]

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {orphans.length > 0 && (
        <Card size="small" style={{ borderColor: '#faad14', background: '#fffbe6' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>
              <strong>{orphans.length}</strong> record{orphans.length > 1 ? 's have' : ' has'} no events and no file on disk — they cannot be reprocessed.
            </Text>
            <Button size="small" danger onClick={handleCleanupOrphans}>Remove All</Button>
          </Space>
        </Card>
      )}
      <Table
        rowKey="key"
        columns={parentColumns}
        dataSource={grouped}
        loading={loading}
        pagination={false}
        size="small"
        expandable={{
          rowExpandable: r => r.uploads.length > 1,
          expandedRowRender: r => (
            <Table
              rowKey="id"
              columns={childColumns}
              dataSource={r.uploads}
              pagination={false}
              size="small"
              style={{ margin: '0 0 8px 24px' }}
            />
          ),
        }}
      />
    </Space>
  )
}

function ReportTab() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => form.setFieldsValue({
        activityType: data.report_activityType,
        hrDevice:     data.report_hrDevice,
        appUrl:       data.report_appUrl,
      }))
      .catch(() => message.error('Failed to load settings'))
  }, [])

  const save = async (values) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error()
      message.success('Report settings saved')
    } catch {
      message.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ maxWidth: 480 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        These values appear in the doctor-shareable report. They are for display only and do not affect detection.
      </Text>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item
          label="Activity Type"
          name="activityType"
          extra="Describes the exercise type used throughout the report."
        >
          <Input placeholder="Indoor cycling (Zwift)" />
        </Form.Item>
        <Form.Item
          label="HR Device / Monitor Name"
          name="hrDevice"
          extra="The cardiac monitor you wear — shown in the data collection and ECG column headers."
        >
          <Input placeholder="Frontier X2" />
        </Form.Item>
        <Form.Item
          label="App URL"
          name="appUrl"
          extra="Public URL of this app, shown in the report footer."
        >
          <Input placeholder="hr-tracker.example.com" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>Settings</Title>
      <Tabs
        defaultActiveKey="detection"
        items={[
          { key: 'detection', label: 'Detection Thresholds', children: <DetectionTab /> },
          { key: 'gpx',       label: 'GPX Files',            children: <GpxFilesTab /> },
          { key: 'report',    label: 'Report',               children: <ReportTab /> },
        ]}
      />
    </Space>
  )
}
