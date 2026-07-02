import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSession } from '@/lib/auth'

const mockBusy: Record<string, string[]> = {}
const mockCustomerBusy: Record<string, string[]> = {}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staff_id')
  const date = searchParams.get('date')
  const time = searchParams.get('time')
  if (!staffId || !date || !time) return NextResponse.json({ available: true })

  const session = await getSession()
  if (!session) return NextResponse.json({ available: true })

  try {
    // Check staff availability
    const staffBusy = await pool.query(
      `SELECT 1 FROM appointments
       WHERE staff_id = $1 AND date = $2 AND start_time = $3::time
         AND status NOT IN ('cancelled','no_show')
       LIMIT 1`,
      [staffId, date, time]
    )
    if (staffBusy.rows.length > 0) {
      return NextResponse.json({ available: false, reason: 'staff_busy' })
    }

    // Check customer's own existing appointments
    const customerBusy = await pool.query(
      `SELECT 1 FROM appointments
       WHERE customer_id = $1 AND date = $2 AND start_time = $3::time
         AND status NOT IN ('cancelled','no_show')
       LIMIT 1`,
      [session.id, date, time]
    )
    if (customerBusy.rows.length > 0) {
      return NextResponse.json({ available: false, reason: 'customer_busy' })
    }

    return NextResponse.json({ available: true })
  } catch {
    // Mock staff busy check
    const staffKey = `${staffId}_${date}`
    const staffBusyTimes = mockBusy[staffKey] || []
    if (staffBusyTimes.includes(time)) {
      return NextResponse.json({ available: false, reason: 'staff_busy' })
    }

    // Mock customer busy check
    const customerKey = `customer_${session.id}_${date}`
    const customerBusyTimes = mockCustomerBusy[customerKey] || []
    if (customerBusyTimes.includes(time)) {
      return NextResponse.json({ available: false, reason: 'customer_busy' })
    }

    return NextResponse.json({ available: true })
  }
}
