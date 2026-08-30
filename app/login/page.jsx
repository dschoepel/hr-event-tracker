'use client'
import { Suspense, useState } from 'react'
import { Card, Form, Input, Button, Typography, App } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'

const { Title, Text } = Typography

function LoginForm() {
  const { message } = App.useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  const invalidLink = searchParams.get('error') === 'invalid_link'

  const onFinish = async ({ password }) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Login failed')
      }
      router.push('/events')
      router.refresh()
    } catch (err) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
      <Card style={{ width: 360 }}>
        <Title level={4} style={{ marginTop: 0 }}>HR Event Tracker</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Sign in to continue.
        </Text>
        {invalidLink && (
          <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
            That share link is invalid, expired, or has been revoked.
          </Text>
        )}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password autoFocus />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>Sign in</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
