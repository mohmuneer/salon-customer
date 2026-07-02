import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, title_ar, title_en, description_ar, description_en,
             original_price, offer_price, valid_until, badge, is_active,
             image_url, mobile_image_url, thumbnail_url, cta_text, cta_link,
             cta_action, linked_service_id, countdown_end, sort_order
      FROM public_offers
      WHERE is_active = true AND (valid_until IS NULL OR valid_until >= NOW())
      ORDER BY sort_order, id
    `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('Failed to fetch offers:', (err as Error).message)
    return NextResponse.json([])
  }
}
