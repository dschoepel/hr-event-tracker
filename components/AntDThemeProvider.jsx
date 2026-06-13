'use client'
import { App, ConfigProvider, theme as antdTheme } from 'antd'
import { useTheme } from '@/contexts/ThemeContext'
import appTheme from '@/theme.config'

export default function AntDThemeProvider({ children }) {
  const { dark } = useTheme()
  return (
    <ConfigProvider
      theme={{
        ...appTheme,
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  )
}
