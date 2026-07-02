import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const MOCK_PRODUCTS = [
  { id: 1, name_ar: 'شامبو احترافي', brand: 'L\'Oréal', category: 'شعر', price: 89, stock_qty: 25, image_url: null, department_name: 'العناية بالشعر' },
  { id: 2, name_ar: 'كريم ترطيب', brand: 'CeraVe', category: 'بشرة', price: 129, stock_qty: 15, image_url: null, department_name: 'العناية بالبشرة' },
  { id: 3, name_ar: 'زيت شعر أرغان', brand: 'Moroccanoil', category: 'شعر', price: 199, stock_qty: 10, image_url: null, department_name: 'العناية بالشعر' },
  { id: 4, name_ar: 'مثبت شعر', brand: 'Taft', category: 'شعر', price: 45, stock_qty: 30, image_url: null, department_name: 'العناية بالشعر' },
  { id: 5, name_ar: 'طلاء أظافر', brand: 'OPI', category: 'أظافر', price: 65, stock_qty: 40, image_url: null, department_name: 'الأظافر' },
]

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name_ar, p.brand, p.category, p.price, p.stock_qty, p.image_url,
             d.name_ar AS department_name, d.name_en AS department_name_en,
             c.symbol AS currency_symbol, c.code AS currency_code,
             (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS gallery_count,
             (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS gallery_image_url,
             (SELECT pi.thumbnail_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS gallery_thumbnail_url
      FROM products p
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN currencies c ON c.id = p.currency_id
      WHERE p.is_active = true AND p.display_on_public = true
      ORDER BY p.is_featured DESC, p.name_ar
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('DB unavailable, returning mock products:', (err as Error).message)
    return NextResponse.json(MOCK_PRODUCTS)
  }
}
