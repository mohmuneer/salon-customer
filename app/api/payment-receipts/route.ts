import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getSession } from '@/lib/auth'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_receipts (
      id               SERIAL PRIMARY KEY,
      order_id         TEXT,
      appointment_ids  TEXT[],
      customer_name    TEXT NOT NULL DEFAULT '',
      customer_phone   TEXT NOT NULL DEFAULT '',
      receipt_url      TEXT NOT NULL,
      amount           NUMERIC DEFAULT 0,
      payment_method   TEXT DEFAULT 'bank_transfer',
      status           TEXT DEFAULT 'pending',
      notes            TEXT DEFAULT '',
      created_at       TIMESTAMP DEFAULT NOW()
    )
  `)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file       = formData.get('file') as File | null
    const amount     = parseFloat((formData.get('amount') as string) || '0')
    const apptRaw    = (formData.get('appointment_ids') as string) || '[]'

    let appointment_ids: string[] = []
    try { appointment_ids = JSON.parse(apptRaw) } catch {}

    if (!file) return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 })
    if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ error: 'نوع الملف غير مسموح به' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'حجم الملف يتجاوز 5MB' }, { status: 400 })

    const bytes  = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const receipt_url = `data:${file.type};base64,${base64}`

    await ensureTable()
    const result = await pool.query(
      `INSERT INTO payment_receipts
         (appointment_ids, customer_name, customer_phone, receipt_url, amount, payment_method)
       VALUES ($1, $2, $3, $4, $5, 'bank_transfer')
       RETURNING id`,
      [appointment_ids, (session as any).name || '', (session as any).phone || '', receipt_url, amount]
    )

    return NextResponse.json({ ok: true, id: result.rows[0].id })
  } catch (err: any) {
    console.error('[payment-receipts POST]', err.message)
    return NextResponse.json({ error: 'حدث خطأ في الرفع' }, { status: 500 })
  }
}
