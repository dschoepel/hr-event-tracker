import { ThemeProvider } from '@/contexts/ThemeContext'
import AntDThemeProvider from '@/components/AntDThemeProvider'
import ResponsiveNav from '@/components/ResponsiveNav'
import AppFooter from '@/components/AppFooter'
import './globals.css'

export const metadata = {
  title: 'HR Event Tracker',
  description: 'Tachycardia event detection from cycling GPX files',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light">
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AntDThemeProvider>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <ResponsiveNav />
              <main style={{ flex: 1, padding: '24px 32px' }}>
                {children}
              </main>
              <AppFooter />
            </div>
          </AntDThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
