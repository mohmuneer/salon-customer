import { NextResponse } from 'next/server'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'

export async function GET() {
  try {
    const r = await fetch(`${ADMIN_URL}/api/public-payment-config`, { cache: 'no-store' })
    if (!r.ok) return NextResponse.json({ enabled: false, publishableKey: null })
    const data = await r.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ enabled: false, publishableKey: null })
  }
}
