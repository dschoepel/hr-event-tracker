'use client'
import { use, useEffect, useState } from 'react'
import { Card, Form, Input, Button, Checkbox, App, Descriptions, Spin, Typography } from 'antd'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

const { Title } = Typography

const fmtSec = s => s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`

function smooth30s(stream) {
  const half = 15
  return stream.map((p, i) => {
    if (p.watts == null) return p
    let sum = 0, count = 0
    for (let j = Math.max(0, i - half); j <= Math.min(stream.length - 1, i + half); j++) {
      if (stream[j].watts != null) { sum += stream[j].watts; count++ }
    }
    return { ...p, watts: count > 0 ? Math.round(sum / count) : p.watts }
  })
}

export default function EventDetailPage({ params }) {
  const { message } = App.useApp()
  const { id } = use(params)
  const [event, setEvent] = useState(null)
  const [hrStream, setHrStream] = useState([])
  const [loading, setLoading] = useState(true)
  const [form] = Form.useForm()

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then(r => r.json())
      .then(({ event, hr_stream }) => {
        setEvent(event)
        setHrStream(hr_stream || [])
      })
      .catch(() => message.error('Failed to load event'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (event) form.setFieldsValue({ notes: event.notes, frontier_session_ref: event.frontier_session_ref, confirmed: !!event.confirmed })
  }, [event, form])

  const handleSave = async (values) => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error()
      message.success('Saved')
    } catch {
      message.error('Save failed')
    }
  }

  if (loading) return <Spin style={{ display: 'block', margin: '48px auto' }} />
  if (!event) return <Card>Event not found — <Link href="/events">Back to history</Link></Card>

  return (
    <Card>
      <Title level={3}>Event #{id}</Title>
      <Descriptions bordered style={{ marginBottom: 24 }} column={{ xs: 1, sm: 2, md: 3 }}>
        <Descriptions.Item label="Peak HR">{event.peak_hr} bpm</Descriptions.Item>
        <Descriptions.Item label="Jump">{event.jump_magnitude} bpm</Descriptions.Item>
        <Descriptions.Item label="Drop">{event.drop_magnitude} bpm</Descriptions.Item>
        <Descriptions.Item label="Duration">{(() => { const s = Math.round(event.duration_seconds); return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s` })()}</Descriptions.Item>
        <Descriptions.Item label="Baseline">{event.baseline_before} bpm</Descriptions.Item>
        <Descriptions.Item label="Method">{event.detection_method}</Descriptions.Item>
      </Descriptions>

      {hrStream.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={smooth30s(hrStream)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={fmtSec} label={{ value: 'Time', position: 'insideBottom', offset: -5 }} />
            <YAxis yAxisId="hr" label={{ value: 'HR (bpm)', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']} />
            {hrStream.some(p => p.watts != null) && (
              <YAxis yAxisId="power" orientation="right" label={{ value: 'Power (W)', angle: 90, position: 'insideRight' }} domain={['auto', 'auto']} />
            )}
            <Tooltip
              labelFormatter={fmtSec}
              formatter={(v, name) => name === 'Power' ? [`${v} W`, 'Power'] : [`${v} bpm`, 'HR']}
            />
            <Legend />
            <ReferenceArea
              yAxisId="hr"
              x1={event.start_time_seconds}
              x2={event.drop_time_seconds}
              stroke="#c62828"
              fill="#ff8a80"
              fillOpacity={0.25}
              label={{ value: 'Event', fill: '#b71c1c', fontSize: 12 }}
            />
            <Line yAxisId="hr" type="monotone" dataKey="hr" name="HR" dot={false} stroke="#d32f2f" strokeWidth={2} />
            {hrStream.some(p => p.watts != null) && (
              <Line yAxisId="power" type="monotone" dataKey="watts" name="Power" dot={false} stroke="#1677ff" strokeWidth={1.5} />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 24 }}>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="frontier_session_ref" label="Frontier X2 Session Ref">
          <Input placeholder="ECG session ID (optional)" />
        </Form.Item>
        <Form.Item name="confirmed" valuePropName="checked">
          <Checkbox>Confirmed SVT event</Checkbox>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">Save</Button>
          <Link href="/events" style={{ marginLeft: 12 }}>← Back to history</Link>
        </Form.Item>
      </Form>
    </Card>
  )
}
