import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const MOCK_SERVICES = [
  { id: 1, name_ar: 'قص وتصفيف', name_en: 'Cut & Style', duration_min: 60, price: 150, gender_target: 'female', image_url: null, category_name: 'تسريحات', icon: 'scissors' },
  { id: 2, name_ar: 'صبغ شعر', name_en: 'Hair Dye', duration_min: 120, price: 350, gender_target: 'female', image_url: null, category_name: 'صبغات', icon: 'palette' },
  { id: 3, name_ar: 'عناية بشرة', name_en: 'Facial', duration_min: 45, price: 200, gender_target: 'female', image_url: null, category_name: 'بشرة', icon: 'droplets' },
  { id: 4, name_ar: 'حلاقة كاملة', name_en: 'Full Shave', duration_min: 30, price: 80, gender_target: 'male', image_url: null, category_name: 'حلاقة', icon: 'scissors' },
  { id: 5, name_ar: 'بديكير ومنيكير', name_en: 'Pedicure & Manicure', duration_min: 90, price: 180, gender_target: 'female', image_url: null, category_name: 'أظافر', icon: 'hand' },
]

const MOCK_CATEGORIES = [
  { id: 1, name_ar: 'تسريحات', icon: 'scissors' },
  { id: 2, name_ar: 'صبغات', icon: 'palette' },
  { id: 3, name_ar: 'بشرة', icon: 'droplets' },
  { id: 4, name_ar: 'حلاقة', icon: 'scissors' },
  { id: 5, name_ar: 'أظافر', icon: 'hand' },
]

export async function GET() {
  try {
    const [services, categories] = await Promise.all([
      pool.query(`
        SELECT s.id, s.name_ar, s.name_en, s.duration_min, s.price,
               s.gender_target, s.image_url, s.department_id,
               (SELECT si.url FROM service_images si WHERE si.service_id = s.id AND si.image_type = 'cover' LIMIT 1) AS cover_image_url,
               (SELECT si.url FROM service_images si WHERE si.service_id = s.id AND si.image_type = 'gallery' LIMIT 1) AS gallery_image_url,
               (SELECT COUNT(*) FROM service_images WHERE service_id = s.id) AS service_images_count,
               c.name_ar AS category_name, c.icon
        FROM services s
        LEFT JOIN categories c ON c.id = s.category_id
        WHERE s.is_active = true AND s.display_on_public = true
        ORDER BY s.is_featured DESC, s.sort_order, s.name_ar
      `),
      pool.query(`SELECT id, name_ar, icon FROM categories ORDER BY sort_order`)
    ])
    return NextResponse.json({ services: services.rows, categories: categories.rows })
  } catch (err) {
    console.error('DB unavailable, returning mock services:', (err as Error).message)
    return NextResponse.json({ services: MOCK_SERVICES, categories: MOCK_CATEGORIES })
  }
}
