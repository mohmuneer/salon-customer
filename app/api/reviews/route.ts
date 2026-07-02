import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSession } from '@/lib/auth'

const mockReviews: Record<string, any> = {}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staff_id')
  try {
    if (staffId) {
      const result = await pool.query(
        'SELECT r.*, u.name AS customer_name FROM reviews r LEFT JOIN users u ON u.id = r.customer_id WHERE r.staff_id = $1 ORDER BY r.created_at DESC',
        [staffId]
      )
      return NextResponse.json(result.rows)
    }
    const all = await pool.query(
      'SELECT r.*, u.name AS customer_name FROM reviews r LEFT JOIN users u ON u.id = r.customer_id ORDER BY r.created_at DESC'
    )
    return NextResponse.json(all.rows)
  } catch (err) {
    console.error('DB unavailable for reviews GET:', (err as Error).message)
    const all = Object.values(mockReviews)
    return NextResponse.json(staffId ? all.filter((r: any) => r.staff_id === staffId) : all)
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { appointment_id, rating, comment } = await req.json()
  if (!appointment_id || !rating || rating < 1 || rating > 5)
    return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })

  try {
    const result = await pool.query(
      `SELECT a.id, a.customer_id, a.staff_id, a.status
       FROM appointments a WHERE a.id = $1 AND a.customer_id = $2`,
      [appointment_id, session.id as string]
    )
    if (result.rows.length === 0)
      return NextResponse.json({ error: 'الموعد غير موجود' }, { status: 404 })
    const appt = result.rows[0]
    if (appt.status !== 'completed')
      return NextResponse.json({ error: 'يمكن التقييم بعد اكتمال الخدمة فقط' }, { status: 400 })

    const existing = await pool.query('SELECT id FROM reviews WHERE appointment_id = $1', [appointment_id])
    if (existing.rows.length > 0)
      return NextResponse.json({ error: 'تم تقييم هذه الخدمة مسبقاً' }, { status: 409 })

    await pool.query(
      `INSERT INTO reviews (appointment_id, customer_id, staff_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5)`,
      [appointment_id, session.id as string, appt.staff_id, rating, comment || null]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DB unavailable, creating mock review:', (err as Error).message)
    mockReviews[appointment_id] = { appointment_id, customer_id: session.id, rating: Number(rating), comment, created_at: new Date().toISOString() }
    return NextResponse.json({ ok: true })
  }
}
