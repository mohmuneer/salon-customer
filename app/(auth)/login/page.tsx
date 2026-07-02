import { readFile } from 'fs/promises'
import path from 'path'
import { unstable_noStore as noStore } from 'next/cache'
import LoginForm from './login-form'

const SETTINGS_FILE = path.join(process.cwd(), '..', 'settings-data.json')

const defaults = {
  name: 'صالون جلامور',
  logo_url: '/logo.png',
}

async function getSettings() {
  noStore()

  // 1. Try DB
  try {
    const { default: pool } = await import('@/lib/db')
    const result = await pool.query('SELECT name, logo_url FROM salon_settings WHERE id = 1')
    if (result.rows.length > 0) {
      const r = result.rows[0]
      return { name: r.name || defaults.name, logo_url: r.logo_url || defaults.logo_url }
    }
  } catch { /* DB unavailable */ }

  // 2. Fallback: shared file
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    const fileData = JSON.parse(raw)
    if (fileData) return { ...defaults, ...fileData }
  } catch { /* ignore */ }

  return defaults
}

export default async function LoginPage() {
  const settings = await getSettings()
  return <LoginForm name={settings.name} logo_url={settings.logo_url} />
}
