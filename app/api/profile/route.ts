import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  try {
    const result = await pool.query(
      'SELECT id, name, phone, email, gender, avatar_url, created_at FROM users WHERE id=$1',
      [session.id as string]
    )
    return NextResponse.json(result.rows[0] || null)
  } catch (err) {
    console.error('DB unavailable, returning mock profile:', (err as Error).message)
    return NextResponse.json({ id: session.id, name: (session as any).name || 'مستخدم', phone: '', email: '', gender: 'female', avatar_url: null, created_at: new Date().toISOString() })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  const { name, email, gender } = await req.json()
  try {
    await pool.query(
      'UPDATE users SET name=$1, email=$2, gender=$3 WHERE id=$4',
      [name, email, gender, session.id]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
