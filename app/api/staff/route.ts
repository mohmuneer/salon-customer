import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const MOCK_STAFF = [
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'نور القحطاني',   specialty: 'قص وصبغ الشعر',           rating: 4.8, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'b0000000-0000-0000-0000-000000000010', name: 'ريم السعيد',      specialty: 'بروتين وتمليس الشعر',       rating: 4.7, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000001' },
  { id: 'b0000000-0000-0000-0000-000000000011', name: 'هند المطيري',     specialty: 'تنظيف وعناية بالبشرة',      rating: 4.8, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000002' },
  { id: 'b0000000-0000-0000-0000-000000000012', name: 'سلمى الشمري',     specialty: 'علاجات بالليزر والضوء',      rating: 4.6, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000002' },
  { id: 'b0000000-0000-0000-0000-000000000013', name: 'لمى الدوسري',     specialty: 'مناكير وباديكير وأظافر جل', rating: 4.9, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000003' },
  { id: 'b0000000-0000-0000-0000-000000000014', name: 'أسماء العنزي',    specialty: 'مكياج عرائس وسهرات',        rating: 4.8, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000004' },
  { id: 'b0000000-0000-0000-0000-000000000015', name: 'مي القحطاني',     specialty: 'مكياج يومي وطبيعي',         rating: 4.7, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000004' },
  { id: 'b0000000-0000-0000-0000-000000000002', name: 'خالد العتيبي',    specialty: 'حلاقة رجالية',              rating: 4.7, gender_served: 'gents',  department_id: '00000000-0000-0000-0000-000000000005' },
  { id: 'b0000000-0000-0000-0000-000000000016', name: 'سعود العمري',     specialty: 'تصفيف ونمذجة اللحية',       rating: 4.8, gender_served: 'gents',  department_id: '00000000-0000-0000-0000-000000000005' },
  { id: 'b0000000-0000-0000-0000-000000000017', name: 'منى الحربي',      specialty: 'مساج استرخائي وعلاجي',      rating: 4.9, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000006' },
  { id: 'b0000000-0000-0000-0000-000000000018', name: 'نادية السلمي',    specialty: 'حمام مغربي وعناية بالجسم',  rating: 4.7, gender_served: 'ladies', department_id: '00000000-0000-0000-0000-000000000006' },
  { id: 'b0000000-0000-0000-0000-000000000019', name: 'عبدالله الرشيد',  specialty: 'تصوير احترافي وإضاءة',      rating: 4.9, gender_served: 'both',   department_id: '00000000-0000-0000-0000-000000000007' },
]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const deptId = searchParams.get('dept_id') || ''
  try {
    const result = deptId
      ? await pool.query(`
          SELECT s.id, u.name, s.specialty, s.rating, s.gender_served
          FROM staff s JOIN users u ON u.id = s.user_id
          WHERE s.is_active = true AND s.department_id = $1
          ORDER BY s.sort_order
        `, [deptId])
      : await pool.query(`
          SELECT s.id, u.name, s.specialty, s.rating, s.gender_served
          FROM staff s JOIN users u ON u.id = s.user_id
          WHERE s.is_active = true ORDER BY s.sort_order
        `)
    return NextResponse.json(result.rows)
  } catch (err) {
    console.error('DB unavailable, returning mock staff:', (err as Error).message)
    const filtered = deptId ? MOCK_STAFF.filter(s => s.department_id === deptId) : MOCK_STAFF
    return NextResponse.json(filtered)
  }
}
