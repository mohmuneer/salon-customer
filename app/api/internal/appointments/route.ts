import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { mockAppointments, addMockAppointment } from '@/lib/mock-data'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT a.id, u.name AS customer_name, u.phone AS customer_phone,
             s.name_ar AS service_name, s.duration_min,
             st_u.name AS staff_name, a.date, a.start_time, a.end_time,
             a.status, a.service_price, a.products_price, a.total, a.notes
      FROM appointments a
      JOIN users u ON u.id = a.customer_id
      JOIN services s ON s.id = a.service_id
      JOIN staff st ON st.id = a.staff_id
      JOIN users st_u ON st_u.id = st.user_id
      ORDER BY a.date DESC, a.start_time DESC LIMIT 50
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('DB unavailable, internal appointments:', (err as Error).message)
    return NextResponse.json(mockAppointments)
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const appt = addMockAppointment(body)
  return NextResponse.json({ ok: true, id: appt.id })
}
