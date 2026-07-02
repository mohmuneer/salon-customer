import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sendOrderConfirmation } from '@/lib/mailer'
import { mockOrders, mockAppointments, addMockOrder } from '@/lib/mock-data'

const MOCK_PRODUCTS: Record<string, { name: string; price: number }> = {
  '1': { name: 'شامبو احترافي', price: 89 },
  '2': { name: 'كريم ترطيب', price: 129 },
  '3': { name: 'زيت شعر أرغان', price: 199 },
  '4': { name: 'مثبت شعر', price: 45 },
  '5': { name: 'طلاء أظافر', price: 65 },
}

function phoneVariants(p: string): string[] {
  if (!p) return []
  const clean = p.replace(/[\s\-\(\)]/g, '')
  const s = new Set<string>()
  s.add(clean)
  const digits = clean.replace(/^\+/, '')
  if (digits.startsWith('966') && digits.length >= 11) { s.add('+' + digits); s.add('0' + digits.slice(3)) }
  if (clean.startsWith('05') && clean.length === 10) { s.add('+966' + clean.slice(1)); s.add('966' + clean.slice(1)) }
  if (clean.startsWith('+966')) { const local = clean.slice(4); s.add('0' + local) }
  return [...s]
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  try {
    const phone = (session as any).phone || ''
    const last9 = phone.replace(/\D/g, '').slice(-9)

    const result = await pool.query(`
      WITH all_user_ids AS (
        SELECT $1::uuid AS id
        ${last9.length === 9 ? `
        UNION
        SELECT DISTINCT id FROM users
        WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = $2` : ''}
      )
      SELECT o.id, o.status, o.total::text, o.payment_status, o.created_at::text,
             o.shipping_address,
             COALESCE(sal.name, '') AS salon_name,
             COALESCE(sal.address, '') AS salon_address,
             COALESCE(sal.phone, '') AS salon_phone,
             COUNT(oi.id)::int AS items_count,
             COALESCE(json_agg(json_build_object(
               'product_id', oi.product_id, 'name', p.name_ar,
               'quantity', oi.quantity, 'unit_price', oi.unit_price::text
             ) ORDER BY p.name_ar) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN salons sal ON sal.id = o.salon_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.customer_id IN (SELECT id FROM all_user_ids)
      GROUP BY o.id, sal.name, sal.address, sal.phone
      ORDER BY o.created_at DESC
    `, last9.length === 9 ? [session.id as string, last9] : [session.id as string])

    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('Orders query error:', (err as Error).message)
    return NextResponse.json(mockOrders.filter((o: any) => o.customer_id === session.id))
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const { items, shipping_address } = await req.json()
  try {
    const salon = await pool.query('SELECT id FROM salons LIMIT 1')
    let subtotal = 0
    for (const item of items) {
      const p = await pool.query('SELECT price FROM products WHERE id=$1', [item.product_id])
      subtotal += p.rows[0].price * item.quantity
    }
    const order = await pool.query(
      `INSERT INTO orders (customer_id, salon_id, subtotal, total, shipping_address, status, payment_status)
       VALUES ($1,$2,$3,$3,$4,'pending','pending') RETURNING id`,
      [session.id, salon.rows[0].id, subtotal, shipping_address || '']
    )
    const orderId = order.rows[0].id
    for (const item of items) {
      const p = await pool.query('SELECT price FROM products WHERE id=$1', [item.product_id])
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
        [orderId, item.product_id, item.quantity, p.rows[0].price]
      )
    }
    // Send confirmation email (fire-and-forget)
    try {
      const userRow = await pool.query('SELECT email, name FROM users WHERE id=$1', [session.id])
      const userEmail = userRow.rows[0]?.email
      const userName  = userRow.rows[0]?.name || session.name || ''
      if (userEmail) {
        const itemDetails: Array<{ name: string; quantity: number; price: number }> = []
        for (const item of items) {
          const p = await pool.query('SELECT name_ar, price FROM products WHERE id=$1', [item.product_id])
          if (p.rows[0]) itemDetails.push({ name: p.rows[0].name_ar, quantity: item.quantity, price: Number(p.rows[0].price) })
        }
        sendOrderConfirmation(userEmail, {
          customerName: userName,
          orderId,
          items: itemDetails,
          total: subtotal,
        }).catch(() => {})
      }
    } catch { /* email errors never fail the order */ }

    return NextResponse.json({ ok: true, orderId })
  } catch (err) {
    console.error('DB unavailable, creating mock order:', (err as Error).message)
    let subtotal = 0
    for (const item of items) {
      const p = MOCK_PRODUCTS[String(item.product_id)]
      if (p) subtotal += p.price * item.quantity
    }
    const order = addMockOrder({
      customer_id: session.id, total: subtotal, items,
      shipping_address: shipping_address || '',
    })
    fetch(`${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/api/internal/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: subtotal, items, payment_method: 'cash', customer_name: session.name, phone: session.email }),
    }).catch(() => {})
    return NextResponse.json({ ok: true, orderId: order.id })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const { id, action } = await req.json()
  if (action !== 'cancel') return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })

  try {
    // Check if this order is linked to an active appointment
    const linked = await pool.query(
      `SELECT id FROM appointments
       WHERE linked_order_ids LIKE '%' || $1::text || '%'
         AND status NOT IN ('cancelled','completed')
         AND customer_id = $2
       LIMIT 1`,
      [id, session.id]
    )
    if (linked.rowCount && linked.rowCount > 0) {
      return NextResponse.json(
        { error: 'لا يمكن إلغاء هذا الطلب لأنه مرتبط بحجز نشط. يُرجى إلغاء الحجز أولاً.' },
        { status: 409 }
      )
    }
    await pool.query(
      `UPDATE orders SET status='cancelled' WHERE id=$1 AND customer_id=$2 AND status='pending'`,
      [id, session.id]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DB unavailable, cancelling mock order:', (err as Error).message)
    const linked = mockAppointments.some(
      (a: any) => Array.isArray(a.linked_order_ids) && a.linked_order_ids.includes(String(id))
        && !['cancelled','completed'].includes(a.status)
    )
    if (linked) return NextResponse.json(
      { error: 'لا يمكن إلغاء هذا الطلب لأنه مرتبط بحجز نشط. يُرجى إلغاء الحجز أولاً.' },
      { status: 409 }
    )
    const idx = mockOrders.findIndex((o: any) => o.id === id && o.customer_id === session.id)
    if (idx !== -1) mockOrders[idx].status = 'cancelled'
    return NextResponse.json({ ok: true })
  }
}
