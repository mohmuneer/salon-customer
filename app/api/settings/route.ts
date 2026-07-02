import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), '..', 'settings-data.json')

const defaults = {
  name: 'صالون جلامور',
  name_en: 'Glamour Salon',
  logo_url: '/logo.png',
  address: 'جدة، حي الروضة',
  city: 'جدة',
  phone: '+966500000000',
  opening_time: '10:00',
  closing_time: '22:00',
  theme: 'gold',
  bank_name: 'البنك الأهلي السعودي',
  account_holder: 'صالون جلامور',
  iban: 'SA0000000000000000000000',
  account_number: '0000000000',
}

async function readFromFile() {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch { return null }
}

export async function GET() {
  // 1. Try DB (salon_settings table — single-row)
  let theme = defaults.theme
  let primaryColor = ''

  try {
    const pool = (await import('@/lib/db')).default
    const result = await pool.query('SELECT * FROM salon_settings WHERE id = 1')
    if (result.rows.length > 0) {
      const r = result.rows[0]
      theme = r.theme || defaults.theme

      // Also read public_website_theme for primary_color
      try {
        const pt = await pool.query('SELECT theme_key, primary_color FROM public_website_theme WHERE id = 1')
        if (pt.rows.length > 0) {
          theme = pt.rows[0].theme_key || theme
          primaryColor = pt.rows[0].primary_color || ''
        }
      } catch { /* public_website_theme may not exist */ }

      return NextResponse.json({
        name: r.name || defaults.name,
        name_en: r.name_en || defaults.name_en,
        logo_url: r.logo_url || defaults.logo_url,
        address: r.address || defaults.address,
        city: r.city || defaults.city,
        phone: r.phone || defaults.phone,
        email: r.email || '',
        opening_time: typeof r.opening_time === 'string' ? r.opening_time.slice(0, 5) : String(r.opening_time || defaults.opening_time).slice(0, 5),
        closing_time: typeof r.closing_time === 'string' ? r.closing_time.slice(0, 5) : String(r.closing_time || defaults.closing_time).slice(0, 5),
        theme,
        primary_color: primaryColor,
        bank_name: r.bank_name || defaults.bank_name,
        account_holder: r.account_holder || defaults.account_holder,
        iban: r.iban || defaults.iban,
        account_number: r.account_number || defaults.account_number,
      })
    }
  } catch { /* DB unavailable */ }

  // 2. Fallback: shared file
  const fileData = await readFromFile()
  if (fileData) return NextResponse.json({
    name: fileData.name || defaults.name,
    name_en: fileData.name_en || defaults.name_en,
    logo_url: fileData.logo_url || defaults.logo_url,
    address: fileData.address || defaults.address,
    city: fileData.city || defaults.city,
    phone: fileData.phone || defaults.phone,
    email: fileData.email || '',
    opening_time: fileData.opening_time || defaults.opening_time,
    closing_time: fileData.closing_time || defaults.closing_time,
    theme: fileData.theme || defaults.theme,
    primary_color: fileData.primary_color || '',
  })

  // 3. Ultimate fallback: defaults
  return NextResponse.json(defaults)
}
