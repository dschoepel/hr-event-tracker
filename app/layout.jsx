import { ThemeProvider } from '@/contexts/ThemeContext'
import AntDThemeProvider from '@/components/AntDThemeProvider'
import ResponsiveNav from '@/components/ResponsiveNav'
import AppFooter from '@/components/AppFooter'
import './globals.css'

export const metadata = {
  title: '__APP_NAME__',
  description: '__APP_DESCRIPTION__',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
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
