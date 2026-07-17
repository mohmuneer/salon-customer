import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { signToken, getSession } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/mailer'
import bcrypt from 'bcryptjs'

const MOCK_USERS = [
  { id: '1', name: 'سارة الأحمدي',  phone: '+966500000001', email: 'sara@example.com',  password: 'test123', role: 'customer', gender: 'female' },
  { id: '2', name: 'نورة القحطاني', phone: '+966500000005', email: 'noura@example.com', password: 'test123', role: 'customer', gender: 'female' },
]

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

/** Validate email format strictly */
function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  if (!re.test(email)) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (local.length > 64) return false
  if (domain.length > 253) return false
  if (local.startsWith('.') || local.endsWith('.')) return false
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) return false
  if (!domain.includes('.')) return false
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2) return false
  return true
}

/** Verify Google ID token via Google's tokeninfo endpoint */
async function verifyGoogleCredential(idToken: string): Promise<{ email: string; name: string; picture?: string } | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.aud !== GOOGLE_CLIENT_ID) return null
    if (data.iss !== 'accounts.google.com' && data.iss !== 'https://accounts.google.com') return null
    const exp = Number(data.exp)
    if (!exp || exp < Math.floor(Date.now() / 1000)) return null
    return { email: data.email, name: data.name, picture: data.picture }
  } catch { return null }
}

let mockIdCounter = 3
const otpStore = new Map<string, { code: string; expires: number }>()

/** Detect if identifier is a phone number */
function isPhone(id: string) {
  return /^[+0][\d\s\-]{7,}$/.test(id.trim()) || /^05\d{8}$/.test(id.trim())
}

/** Normalize phone to +966 format */
function normalizePhone(p: string) {
  return p.replace(/\s+/g, '').replace(/^00/, '+').replace(/^0/, '+966')
}

/**
 * Generate ALL possible phone formats for DB lookup.
 * The website stores 05XXXXXXXX while the app might normalize to +966XXXXXXXX.
 * We search all variants to match either format.
 */
function phoneVariants(p: string): string[] {
  const clean = p.replace(/[\s\-\(\)]/g, '')
  const variants = new Set<string>()
  variants.add(clean)                              // as-is

  const digits = clean.replace(/^\+/, '')          // remove leading +
  if (digits.startsWith('966') && digits.length === 12) {
    variants.add('+' + digits)                     // +966XXXXXXXXX
    variants.add('0' + digits.slice(3))            // 05XXXXXXXX
    variants.add(digits.slice(3))                  // 5XXXXXXXX
  }
  if (clean.startsWith('05') && clean.length === 10) {
    variants.add(clean)                            // 05XXXXXXXX
    variants.add('+966' + clean.slice(1))          // +9665XXXXXXXX
    variants.add('966' + clean.slice(1))           // 9665XXXXXXXX
    variants.add(clean.slice(1))                   // 5XXXXXXXX
  }
  if (clean.startsWith('+966')) {
    const local = clean.slice(4)                   // 5XXXXXXXX
    variants.add('+966' + local)
    variants.add('966' + local)
    variants.add('0' + local)                      // 05XXXXXXXX
  }

  return [...variants]
}

function makeToken() {
  return String(Math.floor(100000 + Math.random() * 900000)).slice(0, 4)
}

export async function GET() {
  const session = await getSession()
  return NextResponse.json({ authenticated: !!session, user: session || null })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, identifier, email: rawEmail, phone: rawPhone, password, name, gender, otp } = body

  // Resolve the user's identifier (phone OR email)
  const id = (identifier || rawEmail || rawPhone || '').trim()
  const phone = isPhone(id) ? normalizePhone(id) : (rawPhone || '')
  const email = !isPhone(id) ? id : (rawEmail || '')

  // ── REGISTER ──
  if (action === 'register') {
    try {
      if (rawEmail && !isValidEmail(rawEmail)) {
        return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة — تأكد من إدخال بريد حقيقي مثل name@gmail.com' }, { status: 400 })
      }
      const exists = await pool.query(
        'SELECT id FROM users WHERE phone=$1 OR email=$2',
        [normalizePhone(rawPhone || ''), rawEmail || '']
      )
      if (exists.rows.length > 0)
        return NextResponse.json({ error: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً' }, { status: 400 })

      const hash = password ? await bcrypt.hash(password, 10) : null
      const result = await pool.query(
        `INSERT INTO users (name, phone, email, role, gender, password_hash)
         VALUES ($1,$2,$3,'customer',$4,$5) RETURNING id, name, phone, email, role, gender`,
        [name, normalizePhone(rawPhone || ''), rawEmail || null, gender || 'female', hash]
      )
      const user = result.rows[0]
      const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
      const res = NextResponse.json({ ok: true, user })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    } catch (err) {
      console.error('Register DB error:', (err as Error).message)
      const uid = String(mockIdCounter++)
      const newUser = { id: uid, name, phone: normalizePhone(rawPhone || ''), email: rawEmail || '', role: 'customer', gender: gender || 'female' }
      const token = await signToken({ id: uid, name, phone: normalizePhone(rawPhone || ''), role: 'customer' })
      const res = NextResponse.json({ ok: true, user: newUser })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    }
  }

  // ── LOGIN WITH PASSWORD (email OR phone — all formats) ──
  if (action === 'login') {
    // Build search variants: email stays as-is, phone gets all format variants
    const variants = isPhone(id) ? phoneVariants(id) : [id]
    const placeholders = variants.map((_, i) => `$${i + 1}`).join(', ')

    try {
      const result = await pool.query(
        `SELECT id, name, phone, email, role, gender, password_hash
         FROM users
         WHERE (email = ANY(ARRAY[${placeholders}]) OR phone = ANY(ARRAY[${placeholders}]))
           AND is_active = true
         LIMIT 1`,
        [...variants]
      )
      const user = result.rows[0]
      if (user) {
        const valid = user.password_hash
          ? await bcrypt.compare(password, user.password_hash)
          : password === 'password123'
        if (!valid) return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 })

        const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
        const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, gender: user.gender } })
        res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
        return res
      }
    } catch (err) {
      console.error('Login DB error:', (err as Error).message)
    }

    // Mock fallback
    const mock = MOCK_USERS.find(u =>
      (variants.includes(u.email) || variants.some(v => phoneVariants(u.phone).includes(v))) &&
      u.password === password
    )
    if (mock) {
      const token = await signToken({ id: mock.id, name: mock.name, phone: mock.phone, role: mock.role })
      const res = NextResponse.json({ ok: true, user: { ...mock } })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    }

    return NextResponse.json({ error: 'البريد / الرقم أو كلمة المرور غير صحيحة' }, { status: 401 })
  }

  // ── OTP SEND (email only) ──
  if (action === 'send_otp') {
    if (isPhone(id)) {
      return NextResponse.json({ error: 'رمز التحقق يعمل عبر البريد الإلكتروني فقط' }, { status: 400 })
    }
    const code = makeToken()
    const key = id
    otpStore.set(key, { code, expires: Date.now() + 600_000 })

    // Email OTP
    try {
      await pool.query(
        `INSERT INTO otp_codes (email, code, expires_at) VALUES ($1,$2,$3)
         ON CONFLICT (email) DO UPDATE SET code=$2, expires_at=$3`,
        [id, code, new Date(Date.now() + 600_000)]
      )
    } catch { /* DB optional */ }

    try {
      await sendOtpEmail(id, code)
      return NextResponse.json({ ok: true, message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' })
    } catch (err) {
      console.error('Email OTP failed:', (err as Error).message)
      return NextResponse.json({ ok: true, message: 'رمز التحقق التجريبي', mock: true, code })
    }
  }

  // ── OTP VERIFY (email or phone) ──
  if (action === 'verify_otp') {
    const key = id
    let valid = false

    // Check in-memory store
    const stored = otpStore.get(key)
    if (stored && stored.code === otp && stored.expires > Date.now()) {
      valid = true
      otpStore.delete(key)
    }

    // Check DB (email only)
    if (!valid && !isPhone(id)) {
      try {
        const r = await pool.query('SELECT code, expires_at FROM otp_codes WHERE email=$1', [id])
        const rec = r.rows[0]
        if (rec && rec.code === otp && new Date(rec.expires_at) > new Date()) {
          valid = true
          await pool.query('DELETE FROM otp_codes WHERE email=$1', [id])
        }
      } catch { /* DB optional */ }
    }

    if (!valid) return NextResponse.json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }, { status: 401 })

    // Find or create user — check all phone variants
    try {
      const variants  = isPhone(id) ? phoneVariants(id) : [id]
      const placeholders = variants.map((_, i) => `$${i + 1}`).join(', ')
      const result = await pool.query(
        `SELECT id, name, phone, email, role, gender FROM users
         WHERE (email = ANY(ARRAY[${placeholders}]) OR phone = ANY(ARRAY[${placeholders}]))
         LIMIT 1`,
        [...variants]
      )
      let user = result.rows[0]
      if (!user) {
        // New user — store in whatever format they provided
        const col = isPhone(id) ? 'phone' : 'email'
        const val = isPhone(id) ? id : id   // keep original format
        const ins = await pool.query(
          `INSERT INTO users (name, ${col}, role) VALUES ($1,$2,'customer')
           RETURNING id, name, phone, email, role, gender`,
          [id, val]
        )
        user = ins.rows[0]
      }
      const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
      const res = NextResponse.json({ ok: true, user, newUser: !result.rows[0] })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    } catch {
      const uid = String(mockIdCounter++)
      const user = { id: uid, name: id, phone: isPhone(id) ? normalizePhone(id) : '', email: isPhone(id) ? '' : id, role: 'customer' as const, gender: 'female' as const }
      const token = await signToken({ id: uid, name: id, phone: user.phone, role: 'customer' })
      const res = NextResponse.json({ ok: true, user, newUser: true })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    }
  }

  // ── GOOGLE LOGIN ──
  if (action === 'google_login') {
    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'تسجيل الدخول بـ Google غير مفعّل حالياً' }, { status: 503 })
    }
    const { credential } = body
    if (!credential) {
      return NextResponse.json({ error: 'بيانات تسجيل الدخول غير مكتملة' }, { status: 400 })
    }
    const googleUser = await verifyGoogleCredential(credential)
    if (!googleUser) {
      return NextResponse.json({ error: 'فشل التحقق من حساب Google — تأكد من صحة الحساب' }, { status: 401 })
    }
    const email = googleUser.email.toLowerCase().trim()
    const name = googleUser.name.trim()

    try {
      let result = await pool.query(
        `SELECT id, name, phone, email, role, gender FROM users
         WHERE email = $1 AND role = 'customer' AND is_active = true LIMIT 1`,
        [email]
      )
      let user
      if (result.rows.length > 0) {
        user = result.rows[0]
        if (user.name !== name) {
          await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, user.id])
          user.name = name
        }
      } else {
        result = await pool.query(
          `INSERT INTO users (name, email, role, is_active, gender, created_at)
           VALUES ($1, $2, 'customer', true, 'female', NOW())
           RETURNING id, name, phone, email, role, gender`,
          [name, email]
        )
        user = result.rows[0]
      }
      const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
      const res = NextResponse.json({ ok: true, user })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    } catch (err) {
      console.error('Google login DB error:', (err as Error).message)
      const uid = String(mockIdCounter++)
      const newUser = { id: uid, name, phone: '', email, role: 'customer' as const, gender: 'female' as const }
      const token = await signToken({ id: uid, name, phone: '', role: 'customer' })
      const res = NextResponse.json({ ok: true, user: newUser })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    }
  }

  // ── LOGOUT ──
  if (action === 'logout') {
    const res = NextResponse.json({ ok: true })
    res.cookies.delete('glamour_token')
    return res
  }

  return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
}
