import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { mockOrders, addMockOrder } from '@/lib/mock-data'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT o.id, u.name AS customer_name, u.phone,
             o.status, o.total, o.payment_status, o.payment_method, o.created_at,
             COUNT(oi.id) AS items_count
      FROM orders o
      LEFT JOIN users u ON u.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, u.name, u.phone
      ORDER BY o.created_at DESC LIMIT 50
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('DB unavailable, internal orders:', (err as Error).message)
    return NextResponse.json(mockOrders)
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const order = addMockOrder(body)
  return NextResponse.json({ ok: true, orderId: order.id })
}
