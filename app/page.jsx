'use client'
import { useState } from 'react'
import { Upload, Button, Card, Table, Tag, App, Typography } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

const { Title } = Typography

const columns = [
  { title: 'Peak HR (bpm)', dataIndex: 'peak_hr' },
  { title: 'Jump (bpm)', dataIndex: 'jump_magnitude' },
  { title: 'Drop (bpm)', dataIndex: 'drop_magnitude' },
  { title: 'Duration (s)', dataIndex: 'duration_seconds', render: v => Math.round(v) },
  { title: 'Method', dataIndex: 'detection_method', render: v => <Tag color="blue">{v}</Tag> },
]

export default function UploadPage() {
  const { message } = App.useApp()
  const [candidates, setCandidates] = useState([])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async ({ file }) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/gpx', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCandidates(data.candidates || [])
      message.success(`Detected ${data.candidates?.length ?? 0} candidate event(s)`)
    } catch (err) {
      message.error(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <Title level={3}>Upload GPX File</Title>
      <Upload customRequest={handleUpload} accept=".gpx" showUploadList={false}>
        <Button icon={<UploadOutlined />} loading={uploading}>
          Select GPX File
        </Button>
      </Upload>
      {candidates.length > 0 && (
        <Table
          style={{ marginTop: 24 }}
          rowKey="start_time_seconds"
          columns={columns}
          dataSource={candidates}
          pagination={false}
          title={() => <Title level={5}>Detected Candidate Events — saved automatically</Title>}
        />
      )}
    </Card>
  )
}
