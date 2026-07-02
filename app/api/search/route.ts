import { NextResponse, NextRequest } from 'next/server'
import pool from '@/lib/db'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 2) return NextResponse.json({ departments: [], services: [], products: [] })

  try {
    const keyword = `%${q}%`
    const [departments, services, products] = await Promise.all([

      // Departments — use actual columns (no icon/sort_order/display_on_public)
      pool.query(`
        SELECT id, name_ar, name_en,
          COALESCE(description, '') AS description_ar,
          COALESCE(image_url, '')   AS image_url,
          COALESCE(slug, '')        AS slug
        FROM departments
        WHERE is_active = true
          AND (name_ar ILIKE $1 OR name_en ILIKE $1 OR description ILIKE $1)
        ORDER BY name_ar
        LIMIT 6
      `, [keyword]),

      // Services
      pool.query(`
        SELECT s.id, s.name_ar, s.name_en, s.duration_min, s.price,
               s.gender_target, COALESCE(s.is_featured, false) AS is_featured,
               c.name_ar AS category_name,
               COALESCE(s.image_url,
                 (SELECT si.url FROM service_images si
                  WHERE si.service_id = s.id AND si.image_type = 'cover'
                  ORDER BY si.sort_order LIMIT 1)
               ) AS cover_image_url
        FROM services s
        LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.is_active = true AND s.display_on_public = true
          AND (s.name_ar ILIKE $1 OR s.name_en ILIKE $1 OR s.description ILIKE $1)
        ORDER BY s.is_featured DESC, s.sort_order
        LIMIT 20
      `, [keyword]),

      // Products
      pool.query(`
        SELECT p.id, p.name_ar, p.brand, p.price, p.stock_qty,
               COALESCE(p.is_featured, false) AS is_featured,
               COALESCE(p.image_url,
                 (SELECT pi.url FROM product_images pi
                  WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1)
               ) AS image_url,
               d.name_ar AS department_name
        FROM products p
        LEFT JOIN departments d ON d.id = p.department_id
        WHERE p.is_active = true AND p.display_on_public = true
          AND p.sold_in_store = true
          AND (p.name_ar ILIKE $1 OR p.brand ILIKE $1)
        ORDER BY p.is_featured DESC, p.name_ar
        LIMIT 20
      `, [keyword]),
    ])

    return NextResponse.json({
      departments: departments.rows,
      services:    services.rows,
      products:    products.rows,
      query:       q,
    })
  } catch (err: any) {
    console.error('[search]', err.message)
    return NextResponse.json({ departments: [], services: [], products: [], error: err.message })
  }
}
