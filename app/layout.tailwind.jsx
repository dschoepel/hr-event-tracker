import { ThemeProvider } from '@/contexts/ThemeContext'
import ResponsiveNav from '@/components/ResponsiveNav.tailwind'
import AppFooter from '@/components/AppFooter'
import './globals.css'

export const metadata = {
  title: '__APP_NAME__',
  description: '__APP_DESCRIPTION__',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <ThemeProvider>
          <ResponsiveNav />
          <main className="flex-1 p-6 md:p-8">
            {children}
          </main>
          <AppFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}
