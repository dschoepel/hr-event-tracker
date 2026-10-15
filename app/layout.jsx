import { ThemeProvider } from '@/contexts/ThemeContext'
import AntDThemeProvider from '@/components/AntDThemeProvider'
import ResponsiveNav from '@/components/ResponsiveNav'
import AppFooter from '@/components/AppFooter'
import './globals.css'

export const metadata = {
  title: 'HR Event Tracker',
  description: 'Detect, review and share unusual heart-rate episodes from cycling GPX files',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light">
      <body suppressHydrationWarning>
        <ThemeProvider>
          <AntDThemeProvider>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <ResponsiveNav />
              <main className="app-main">
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
