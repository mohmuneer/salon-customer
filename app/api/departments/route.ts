import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        d.id, d.name_ar, d.name_en,
        COALESCE(d.description, '')    AS description_ar,
        COALESCE(d.description, '')    AS description_en,
        COALESCE(d.image_url, '')      AS image_url,
        COALESCE(d.slug, '')           AS slug,
        COALESCE(d.seo_title, '')      AS page_title_ar,
        COALESCE(d.seo_description,'') AS meta_description_ar,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true AND s.display_on_public = true)::int AS service_count,
        COUNT(DISTINCT p.id) FILTER (WHERE p.is_active = true AND p.display_on_public = true)::int AS product_count
      FROM departments d
      LEFT JOIN services s ON s.department_id = d.id
      LEFT JOIN products p ON p.department_id = d.id
      WHERE d.is_active = true
      GROUP BY d.id, d.name_ar, d.name_en, d.description,
               d.image_url, d.slug, d.seo_title, d.seo_description
      HAVING COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true AND s.display_on_public = true) > 0
          OR COUNT(DISTINCT p.id) FILTER (WHERE p.is_active = true AND p.display_on_public = true) > 0
      ORDER BY d.name_ar
    `)
    return NextResponse.json(result.rows)
  } catch (err: any) {
    console.error('Departments fetch error:', err.message)
    return NextResponse.json([], { status: 200 })
  }
}
