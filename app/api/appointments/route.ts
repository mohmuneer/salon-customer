import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sendBookingConfirmation } from '@/lib/mailer'

import { mockAppointments, addMockAppointment } from '@/lib/mock-data'

const MOCK_SERVICES: Record<string, { name_ar: string; duration_min: number; price: number }> = {
  '1': { name_ar: 'قص وتصفيف', duration_min: 60, price: 150 },
  '2': { name_ar: 'صبغ شعر', duration_min: 120, price: 350 },
  '3': { name_ar: 'عناية بشرة', duration_min: 45, price: 200 },
  '4': { name_ar: 'حلاقة كاملة', duration_min: 30, price: 80 },
  '5': { name_ar: 'بديكير ومنيكير', duration_min: 90, price: 180 },
}

const MOCK_STAFF: Record<string, string> = {
  '1': 'سارة الأحمدي',
  '2': 'نورة القحطاني',
  '3': 'فهد المالكي',
}

function endTime(start: string, duration: number) {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + duration
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** All phone format variants for unified cross-account lookup */
function phoneVariants(p: string): string[] {
  if (!p) return []
  const clean = p.replace(/[\s\-\(\)]/g, '')
  const s = new Set<string>()
  s.add(clean)
  const digits = clean.replace(/^\+/, '')
  if (digits.startsWith('966') && digits.length >= 11) {
    s.add('+' + digits); s.add('0' + digits.slice(3)); s.add(digits.slice(3))
  }
  if (clean.startsWith('05') && clean.length === 10) {
    s.add(clean); s.add('+966' + clean.slice(1)); s.add('966' + clean.slice(1)); s.add(clean.slice(1))
  }
  if (clean.startsWith('+966')) {
    const local = clean.slice(4)
    s.add('+966' + local); s.add('966' + local); s.add('0' + local)
  }
  return [...s]
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const phone = (session as any).phone || ''
    // Use last 9 digits for robust cross-format matching (handles 05, +966, +00966, etc.)
    const last9 = phone.replace(/\D/g, '').slice(-9)

    const result = await pool.query(`
      WITH all_user_ids AS (
        SELECT $1::uuid AS id
        ${last9.length === 9 ? `
        UNION
        SELECT DISTINCT id FROM users
        WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = $2` : ''}
      )
      SELECT a.id, s.name_ar AS service_name, s.duration_min,
             COALESCE(u.name, '') AS staff_name,
             COALESCE(sal.name, '') AS salon_name,
             a.date::text,
             to_char(a.start_time, 'HH24:MI') AS start_time,
             to_char(a.end_time,   'HH24:MI') AS end_time,
             a.status, a.service_price::text, a.total::text, a.notes,
             (SELECT rating FROM reviews WHERE appointment_id = a.id LIMIT 1) AS review_rating
      FROM appointments a
      JOIN services s ON s.id = a.service_id
      LEFT JOIN staff st  ON st.id = a.staff_id
      LEFT JOIN users u   ON u.id = st.user_id
      LEFT JOIN salons sal ON sal.id = a.salon_id
      WHERE a.customer_id IN (SELECT id FROM all_user_ids)
      ORDER BY a.date DESC, a.start_time DESC
    `, last9.length === 9 ? [session.id as string, last9] : [session.id as string])

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('Appointments query error:', (err as Error).message)
    return NextResponse.json(mockAppointments.filter((a) => a.customer_id === session.id))
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { staff_id, service_id, date, start_time, notes, product_ids, services, linked_order_ids } = await req.json()

  // Handle multi-service booking
  const bookingServices = services || [{ service_id, staff_id, start_time }]

  try {
    const salon = await pool.query('SELECT id FROM salons LIMIT 1')
    const salonId = salon.rows[0].id
    const createdIds: number[] = []

    for (const svc of bookingServices) {
      const svcData = await pool.query('SELECT price, duration_min FROM services WHERE id=$1', [svc.service_id])
      const price = svcData.rows[0]?.price || 0
      const svcStart = svc.start_time || start_time
      const svcStaff = svc.staff_id || staff_id

      const apptResult = await pool.query(`
        INSERT INTO appointments (customer_id, staff_id, service_id, salon_id, date, start_time, status, service_price, linked_order_ids)
        VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8)
        RETURNING id
      `, [session.id, svcStaff, svc.service_id, salonId, date, svcStart, price,
          linked_order_ids && linked_order_ids.length > 0 ? linked_order_ids.join(',') : null])

      const appointmentId = apptResult.rows[0].id
      createdIds.push(appointmentId)

      if (Array.isArray(product_ids) && product_ids.length > 0) {
        for (const pid of product_ids) {
          const prod = await pool.query('SELECT price FROM products WHERE id = $1', [pid])
          const unitPrice = prod.rows[0]?.price || 0
          await pool.query(
            `INSERT INTO appointment_products (appointment_id, product_id, qty, unit_price, type)
             VALUES ($1,$2,1,$3,'optional')`,
            [appointmentId, pid, unitPrice]
          )
        }
      }
    }

    // Send confirmation email (fire-and-forget)
    try {
      const userRow = await pool.query('SELECT email, name FROM users WHERE id=$1', [session.id])
      const userEmail = userRow.rows[0]?.email
      const userName  = userRow.rows[0]?.name || session.name || ''
      if (userEmail && bookingServices.length > 0) {
        const firstSvc  = bookingServices[0]
        const svcRow    = await pool.query('SELECT name_ar, price FROM services WHERE id=$1', [firstSvc.service_id])
        const staffRow  = await pool.query('SELECT u.name FROM staff st JOIN users u ON u.id=st.user_id WHERE st.id=$1', [firstSvc.staff_id || firstSvc.staff_id])
        const salonRow  = await pool.query('SELECT name FROM salons LIMIT 1')
        sendBookingConfirmation(userEmail, {
          customerName: userName,
          serviceName:  svcRow.rows[0]?.name_ar || 'خدمة',
          date,
          time:         firstSvc.start_time || start_time || '',
          staffName:    staffRow.rows[0]?.name || '',
          branchName:   salonRow.rows[0]?.name || '',
          price:        svcRow.rows[0]?.price || 0,
        }).catch(() => {})
      }
    } catch { /* email errors never fail the booking */ }

    return NextResponse.json({ ok: true, ids: createdIds })
  } catch (err) {
    console.error('DB unavailable, creating mock appointments:', (err as Error).message)
    const created: any[] = []
    for (const svc of bookingServices) {
      const svcData = MOCK_SERVICES[String(svc.service_id)] || { name_ar: 'خدمة', duration_min: 60, price: 0 }
      const staffName = MOCK_STAFF[String(svc.staff_id || staff_id)] || 'موظف'
      const svcStart = svc.start_time || start_time
      const appt = addMockAppointment({
        id: undefined,
        customer_id: session.id,
        service_name: svcData.name_ar,
        duration_min: svcData.duration_min,
        staff_name: staffName,
        staff_id: String(svc.staff_id || staff_id),
        salon_name: 'جلامور',
        date,
        start_time: svcStart,
        end_time: endTime(svcStart, svcData.duration_min),
        service_price: svcData.price,
        products_price: 0,
        total: svcData.price,
        notes: notes || '',
        customer_name: session.name,
        customer_phone: session.email,
        linked_order_ids: linked_order_ids || [],
        products: Array.isArray(product_ids) ? product_ids.map(() => ({ name_ar: 'منتج', qty: 1, unit_price: 0, type: 'optional' })) : [],
      })
      created.push(appt)
    }
    // Sync with admin
    for (const a of created) {
      fetch(`${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/api/internal/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, customer_name: session.name, customer_phone: session.email }),
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, ids: created.map(a => a.id) })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const { id } = await req.json()
  try {
    const phone = (session as any).phone || ''
    const last9 = phone.replace(/\D/g, '').slice(-9)
    const result = await pool.query(
      `WITH all_user_ids AS (
         SELECT $2::uuid AS id
         ${last9.length === 9 ? `UNION SELECT DISTINCT id FROM users WHERE RIGHT(REGEXP_REPLACE(phone,'[^0-9]','','g'),9)=$3` : ''}
       )
       UPDATE appointments SET status='cancelled', cancellation_reason='إلغاء من العميل'
       WHERE id=$1 AND customer_id IN (SELECT id FROM all_user_ids)
         AND status IN ('pending','confirmed')
       RETURNING id`,
      last9.length === 9 ? [id, session.id, last9] : [id, session.id]
    )
    if (result.rowCount === 0) return NextResponse.json({ error: 'لم يتم العثور على الحجز أو لا يمكن إلغاؤه' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DB unavailable, cancelling mock appointment:', (err as Error).message)
    const idx = mockAppointments.findIndex((a) => a.id === id && a.customer_id === session.id)
    if (idx !== -1) mockAppointments[idx].status = 'cancelled'
    return NextResponse.json({ ok: true })
  }
}
