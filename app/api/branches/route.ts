import { NextResponse } from 'next/server'

const MOCK_BRANCHES = [
  { id: '1', name: 'الفرع الرئيسي', name_en: 'Main Branch', address: 'جدة، حي الروضة', city: 'جدة', type: 'main', opening_time: '10:00', closing_time: '22:00' },
  { id: '2', name: 'فرع السلامة', name_en: 'Al-Salamah Branch', address: 'جدة، حي السلامة', city: 'جدة', type: 'branch', opening_time: '10:00', closing_time: '23:00' },
]

export async function GET() {
  try {
    const { default: pool } = await import('@/lib/db')
    const result = await pool.query(
      `SELECT id, name, name_en, address, city, type, opening_time, closing_time FROM salons WHERE is_active=true ORDER BY name`
    )
    return NextResponse.json(result.rows)
  } catch {
    return NextResponse.json(MOCK_BRANCHES)
  }
}
