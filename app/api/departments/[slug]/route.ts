import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  try {
    const [deptResult, servicesResult, productsResult] = await Promise.all([

      // Department — use actual columns (no description_ar/display_on_public)
      pool.query(`
        SELECT id, name_ar, name_en,
          COALESCE(description, '')    AS description_ar,
          COALESCE(description, '')    AS description_en,
          COALESCE(image_url, '')      AS image_url,
          ''                           AS icon,
          COALESCE(slug, '')           AS slug,
          COALESCE(seo_title, '')      AS page_title_ar,
          COALESCE(seo_title, '')      AS page_title_en,
          COALESCE(seo_description,'') AS meta_description_ar,
          COALESCE(seo_description,'') AS meta_description_en
        FROM departments
        WHERE slug = $1 AND is_active = true
        LIMIT 1
      `, [slug]),

      // Services — display_on_public and is_featured exist
      pool.query(`
        SELECT s.id, s.name_ar, s.name_en, s.duration_min, s.price,
               s.gender_target,
               COALESCE(s.is_featured, false) AS is_featured,
               (SELECT si.url FROM service_images si
                WHERE si.service_id = s.id AND si.image_type = 'cover'
                ORDER BY si.sort_order LIMIT 1) AS cover_image
        FROM services s
        WHERE s.department_id = (SELECT id FROM departments WHERE slug = $1)
          AND s.is_active = true
          AND s.display_on_public = true
        ORDER BY s.is_featured DESC, s.sort_order, s.name_ar
      `, [slug]),

      // Products — display_on_public and is_featured exist, no sort_order
      pool.query(`
        SELECT p.id, p.name_ar, p.brand, p.price, p.stock_qty,
               p.sold_in_store, p.used_in_sessions,
               COALESCE(p.is_featured, false) AS is_featured,
               (SELECT pi.url FROM product_images pi
                WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS primary_image,
               (SELECT pi.thumbnail_url FROM product_images pi
                WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1) AS thumbnail,
               c.symbol AS currency_symbol
        FROM products p
        LEFT JOIN currencies c ON c.id = p.currency_id
        WHERE p.department_id = (SELECT id FROM departments WHERE slug = $1)
          AND p.is_active = true
          AND p.display_on_public = true
        ORDER BY p.is_featured DESC, p.name_ar
      `, [slug]),
    ])

    if (deptResult.rows.length === 0) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json({
      department: deptResult.rows[0],
      services:   servicesResult.rows,
      products:   productsResult.rows,
    })
  } catch (err: any) {
    console.error('Failed to fetch department:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
