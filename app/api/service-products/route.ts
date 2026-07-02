import { NextRequest, NextResponse } from 'next/server'

const MOCK_SERVICE_PRODUCTS: Record<string, any[]> = {
  '1': [
    { id: 'sp1', product_id: 'p1', name_ar: 'شامبو احترافي', qty_used: 1, is_optional: false, client_can_upgrade: false, extra_price: 0, price: 89 },
    { id: 'sp2', product_id: 'p2', name_ar: 'سيروم مغذي للشعر', qty_used: 1, is_optional: true, client_can_upgrade: true, extra_price: 30, price: 89 },
  ],
  '2': [
    { id: 'sp3', product_id: 'p3', name_ar: 'زيت شعر أرغان', qty_used: 1, is_optional: true, client_can_upgrade: true, extra_price: 50, price: 199 },
  ],
}

export async function GET(req: NextRequest) {
  const serviceId = new URL(req.url).searchParams.get('service_id')
  if (!serviceId) return NextResponse.json([])

  try {
    const { default: pool } = await import('@/lib/db')
    const result = await pool.query(`
      SELECT sp.id, sp.product_id, p.name_ar, sp.qty_used, sp.is_optional,
             sp.client_can_upgrade, sp.extra_price, p.price AS product_price
      FROM service_products sp
      JOIN products p ON p.id = sp.product_id
      WHERE sp.service_id = $1 AND p.is_active = true
      ORDER BY sp.is_optional, sp.extra_price
    `, [serviceId])
    return NextResponse.json(result.rows)
  } catch {
    return NextResponse.json(MOCK_SERVICE_PRODUCTS[serviceId] || [])
  }
}
