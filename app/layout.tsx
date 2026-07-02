import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaSetup from '@/components/PwaSetup'
import { readFile } from 'fs/promises'
import path from 'path'
import { unstable_noStore as noStore } from 'next/cache'

const SETTINGS_FILE = path.join(process.cwd(), '..', 'settings-data.json')

async function getPublicTheme(): Promise<{ theme: string; primary_color: string }> {
  noStore()
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return {
      theme: data.public_theme || data.theme || 'gold',
      primary_color: data.public_primary_color || '#C9A55F',
    }
  } catch { /* ignore */ }
  return { theme: 'gold', primary_color: '#C9A55F' }
}

export const metadata: Metadata = {
  title: 'Glamour',
  description: 'Book your appointment easily',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Glamour',
    statusBarStyle: 'black-translucent',
    startupImage: [],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1A1A2E',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme, primary_color } = await getPublicTheme()

  return (
    <html lang="ar" dir="rtl" data-theme={theme} style={primary_color ? { '--primary': primary_color } as any : undefined}>
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="mask-icon" href="/icon-192.png" color="var(--gold)" />
      </head>
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  )
}
