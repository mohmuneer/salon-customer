import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), '..', 'settings-data.json')

const defaults = {
  name: 'جلامور — حجز موعد صالون',
  short_name: 'جلامور',
  description: 'صالون جلامور — احجز موعدك بسهولة مع أفضل الخبراء في التجميل والعناية',
  logo_url: '/logo.png',
}

async function readFromFile() {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch { return null }
}

export async function GET() {
  // Check shared file first
  const fileData = await readFromFile()
  if (fileData) {
    const s = {
      name: fileData.name,
      short_name: (fileData.name_en || fileData.name).slice(0, 12),
      description: fileData.name_en
        ? `${fileData.name} — Book your appointment easily`
        : `${fileData.name} — احجز موعدك بسهولة`,
      logo_url: fileData.logo_url || '/logo.png',
    }
    return NextResponse.json(buildManifest(s), {
      headers: { 'Content-Type': 'application/manifest+json' },
    })
  }

  // Try DB
  try {
    const { default: pool } = await import('@/lib/db')
    const result = await pool.query(
      `SELECT name, name_en, logo_url FROM salon_settings WHERE id = 1`
    )
    if (result.rows.length > 0) {
      const r = result.rows[0]
      const s = {
        name: r.name,
        short_name: (r.name_en || r.name).slice(0, 12),
        description: r.name_en
          ? `${r.name} — Book your appointment easily`
          : `${r.name} — احجز موعدك بسهولة`,
        logo_url: r.logo_url || '/logo.png',
      }
      return NextResponse.json(buildManifest(s), {
        headers: { 'Content-Type': 'application/manifest+json' },
      })
    }
  } catch { /* DB unavailable */ }

  return NextResponse.json(buildManifest(defaults), {
    headers: { 'Content-Type': 'application/manifest+json' },
  })
}

function buildManifest(s: typeof defaults) {
  return {
    name: s.name,
    short_name: s.short_name,
    description: s.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#1A1A2E',
    theme_color: '#1A1A2E',
    orientation: 'portrait',
    scope: '/',
    categories: ['lifestyle', 'beauty'],
    lang: 'ar',
    dir: 'rtl',
    icons: [
      ...(s.logo_url ? [
        { src: s.logo_url, sizes: '512x512', type: 'image/png', purpose: 'any' },
      ] : []),
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    screenshots: [],
    prefer_related_applications: false,
  }
}
