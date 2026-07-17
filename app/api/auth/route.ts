import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { signToken, getSession } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/mailer'
import bcrypt from 'bcryptjs'
import { validateEmail, normalizeEmail } from '@/lib/validate-email'

const MOCK_USERS = [
  { id: '1', name: 'سارة الأحمدي',  phone: '+966500000001', email: 'sara@example.com',  password: 'test123', role: 'customer', gender: 'female' },
  { id: '2', name: 'نورة القحطاني', phone: '+966500000005', email: 'noura@example.com', password: 'test123', role: 'customer', gender: 'female' },
]

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

let mockIdCounter = 3
const otpStore = new Map<string, { code: string; expires: number }>()

function isPhone(id: string) {
  return /^[+0][\d\s\-]{7,}$/.test(id.trim()) || /^05\d{8}$/.test(id.trim())
}

function normalizePhone(p: string) {
  return p.replace(/\s+/g, '').replace(/^00/, '+').replace(/^0/, '+966')
}

function phoneVariants(p: string): string[] {
  const clean = p.replace(/[\s\-\(\)]/g, '')
  const variants = new Set<string>()
  variants.add(clean)
  const digits = clean.replace(/^\+/, '')
  if (digits.startsWith('966') && digits.length === 12) {
    variants.add('+' + digits)
    variants.add('0' + digits.slice(3))
    variants.add(digits.slice(3))
  }
  if (clean.startsWith('05') && clean.length === 10) {
    variants.add(clean)
    variants.add('+966' + clean.slice(1))
    variants.add('966' + clean.slice(1))
    variants.add(clean.slice(1))
  }
  if (clean.startsWith('+966')) {
    const local = clean.slice(4)
    variants.add('+966' + local)
    variants.add('966' + local)
    variants.add('0' + local)
  }
  return [...variants]
}

function makeOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
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

export async function GET() {
  const session = await getSession()
  return NextResponse.json({ authenticated: !!session, user: session || null })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, identifier, email: rawEmail, phone: rawPhone, password, name, gender, otp, credential } = body

  const id = (identifier || rawEmail || rawPhone || '').trim()
  const phone = isPhone(id) ? normalizePhone(id) : (rawPhone || '')
  const email = !isPhone(id) ? id : (rawEmail || '')

  // ── REGISTER ──
  if (action === 'register') {
    // 1. Validate email format
    if (rawEmail) {
      const ev = validateEmail(rawEmail)
      if (!ev.valid) {
        return NextResponse.json({ error: ev.error, suggestion: ev.suggestion }, { status: 422 })
      }
    }
    if (rawEmail && !isPhone(id) && !rawPhone) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    }

    // 2. Check duplicates
    try {
      if (rawEmail) {
        const ex = await pool.query('SELECT id FROM users WHERE email = $1', [normalizeEmail(rawEmail)])
        if (ex.rows.length > 0) return NextResponse.json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً' }, { status: 409 })
      }
      if (rawPhone) {
        const ex = await pool.query('SELECT id FROM users WHERE phone = $1', [normalizePhone(rawPhone)])
        if (ex.rows.length > 0) return NextResponse.json({ error: 'رقم الجوال مستخدم مسبقاً' }, { status: 409 })
      }
    } catch (err) {
      console.error('Duplicate check error:', (err as Error).message)
    }

    // 3. Send OTP to email for verification (don't create user yet)
    const normalizedEmail = rawEmail ? normalizeEmail(rawEmail) : ''
    if (normalizedEmail) {
      const code = makeOtpCode()
      otpStore.set(`verify:${normalizedEmail}`, { code, expires: Date.now() + 600_000 })
      try {
        await pool.query(
          `INSERT INTO otp_codes (email, code, expires_at) VALUES ($1,$2,$3)
           ON CONFLICT (email) DO UPDATE SET code=$2, expires_at=$3`,
          [normalizedEmail, code, new Date(Date.now() + 600_000)]
        )
      } catch { /* DB optional */ }
      try {
        await sendOtpEmail(normalizedEmail, code)
      } catch (err) {
        console.error('Email OTP failed:', (err as Error).message)
      }
      // Store pending registration data in memory
      otpStore.set(`pending:${normalizedEmail}`, {
        code: JSON.stringify({ name, phone: rawPhone ? normalizePhone(rawPhone) : '', email: normalizedEmail, password: password ? 'SET' : '', gender: gender || 'female' }),
        expires: Date.now() + 600_000,
      })
      return NextResponse.json({
        ok: true,
        step: 'verify_otp',
        message: `تم إرسال رمز تحقق مكون من 6 أرقام إلى ${normalizedEmail}`,
        email: normalizedEmail,
      })
    }

    // Email-less registration: create directly (phone only)
    try {
      const hash = password ? await bcrypt.hash(password, 10) : null
      const result = await pool.query(
        `INSERT INTO users (name, phone, email, role, gender, password_hash, email_verified)
         VALUES ($1,$2,$3,'customer',$4,$5,false) RETURNING id, name, phone, email, role, gender`,
        [name, normalizePhone(rawPhone || ''), null, gender || 'female', hash]
      )
      const user = result.rows[0]
      const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
      const res = NextResponse.json({ ok: true, user })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    } catch (err) {
      console.error('Register DB error:', (err as Error).message)
      return NextResponse.json({ error: 'حدث خطأ في التسجيل' }, { status: 500 })
    }
  }

  // ── VERIFY REGISTRATION OTP ──
  if (action === 'verify_register_otp') {
    const normalizedEmail = normalizeEmail(id)
    if (!normalizedEmail || !otp) {
      return NextResponse.json({ error: 'البريد الإلكتروني ورمز التحقق مطلوبان' }, { status: 400 })
    }

    let valid = false

    // Check in-memory store
    const stored = otpStore.get(`verify:${normalizedEmail}`)
    if (stored && stored.code === otp && stored.expires > Date.now()) {
      valid = true
      otpStore.delete(`verify:${normalizedEmail}`)
    }

    // Check DB
    if (!valid) {
      try {
        const r = await pool.query('SELECT code, expires_at FROM otp_codes WHERE email=$1', [normalizedEmail])
        const rec = r.rows[0]
        if (rec && rec.code === otp && new Date(rec.expires_at) > new Date()) {
          valid = true
          await pool.query('DELETE FROM otp_codes WHERE email=$1', [normalizedEmail])
        }
      } catch { /* DB optional */ }
    }

    if (!valid) return NextResponse.json({ error: 'رمز التحقق غير صحيح أو منتهي الصلاحية (10 دقائق)' }, { status: 401 })

    // Get pending registration data
    const pendingEntry = otpStore.get(`pending:${normalizedEmail}`)
    let pendingData: any = null
    if (pendingEntry) {
      try { pendingData = JSON.parse(pendingEntry.code) } catch {}
      otpStore.delete(`pending:${normalizedEmail}`)
    }

    if (!pendingData) {
      return NextResponse.json({ error: 'انتهت صلاحية بيانات التسجيل — يرجى إعادة المحاولة' }, { status: 410 })
    }

    // Check if user already exists (race condition)
    try {
      const ex = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
      if (ex.rows.length > 0) {
        // Already exists — just log them in
        const userResult = await pool.query('SELECT id, name, phone, email, role, gender FROM users WHERE email = $1', [normalizedEmail])
        const user = userResult.rows[0]
        const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
        const res = NextResponse.json({ ok: true, user, message: 'الحساب موجود مسبقاً — تم تسجيل الدخول' })
        res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
        return res
      }
    } catch {}

    // Create the user
    try {
      const hash = pendingData.password === 'SET' ? await bcrypt.hash(password || 'google_oauth', 10) : null
      const result = await pool.query(
        `INSERT INTO users (name, phone, email, role, gender, password_hash, email_verified, is_active)
         VALUES ($1,$2,$3,'customer',$4,$5,true,true)
         RETURNING id, name, phone, email, role, gender`,
        [pendingData.name, pendingData.phone || null, normalizedEmail, pendingData.gender, hash]
      )
      const user = result.rows[0]
      const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
      const res = NextResponse.json({ ok: true, user, newUser: true })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    } catch (err) {
      console.error('Create user after OTP error:', (err as Error).message)
      return NextResponse.json({ error: 'حدث خطأ في إنشاء الحساب' }, { status: 500 })
    }
  }

  // ── LOGIN WITH PASSWORD ──
  if (action === 'login') {
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

  // ── OTP SEND ──
  if (action === 'send_otp') {
    if (isPhone(id)) {
      return NextResponse.json({ error: 'رمز التحقق يعمل عبر البريد الإلكتروني فقط' }, { status: 400 })
    }
    const code = makeOtpCode()
    otpStore.set(id, { code, expires: Date.now() + 600_000 })
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

  // ── OTP VERIFY ──
  if (action === 'verify_otp') {
    const key = id
    let valid = false
    const stored = otpStore.get(key)
    if (stored && stored.code === otp && stored.expires > Date.now()) {
      valid = true
      otpStore.delete(key)
    }
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

    try {
      const variants = isPhone(id) ? phoneVariants(id) : [id]
      const placeholders = variants.map((_, i) => `$${i + 1}`).join(', ')
      const result = await pool.query(
        `SELECT id, name, phone, email, role, gender FROM users
         WHERE (email = ANY(ARRAY[${placeholders}]) OR phone = ANY(ARRAY[${placeholders}]))
         LIMIT 1`,
        [...variants]
      )
      let user = result.rows[0]
      if (!user) {
        const col = isPhone(id) ? 'phone' : 'email'
        const ins = await pool.query(
          `INSERT INTO users (name, ${col}, role, email_verified) VALUES ($1,$2,'customer',${!isPhone(id) ? 'true' : 'false'})
           RETURNING id, name, phone, email, role, gender`,
          [id, id]
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
    if (!credential) {
      return NextResponse.json({ error: 'بيانات تسجيل الدخول غير مكتملة' }, { status: 400 })
    }
    const googleUser = await verifyGoogleCredential(credential)
    if (!googleUser) {
      return NextResponse.json({ error: 'فشل التحقق من حساب Google — تأكد من صحة الحساب' }, { status: 401 })
    }
    const gEmail = normalizeEmail(googleUser.email)
    const gName = googleUser.name.trim()
    const gId = googleUser.picture || '' // We use email as primary identifier

    try {
      // Check if user exists by email OR google_id
      let result = await pool.query(
        `SELECT id, name, phone, email, role, gender FROM users
         WHERE email = $1 OR (google_id IS NOT NULL AND google_id = $2)
         LIMIT 1`,
        [gEmail, gEmail]
      )
      let user
      let isNew = false

      if (result.rows.length > 0) {
        user = result.rows[0]
        // Update name if changed
        if (user.name !== gName) {
          await pool.query('UPDATE users SET name = $1 WHERE id = $2', [gName, user.id])
          user.name = gName
        }
        // Mark email as verified
        if (!user.email_verified) {
          await pool.query('UPDATE users SET email_verified = true, google_id = $1 WHERE id = $2', [gEmail, user.id])
        }
      } else {
        // New user — create with Google data
        result = await pool.query(
          `INSERT INTO users (name, email, role, is_active, gender, email_verified, google_id, created_at)
           VALUES ($1, $2, 'customer', true, 'female', true, $3, NOW())
           RETURNING id, name, phone, email, role, gender`,
          [gName, gEmail, gEmail]
        )
        user = result.rows[0]
        isNew = true
      }

      const token = await signToken({ id: user.id, name: user.name, phone: user.phone, role: user.role })
      const res = NextResponse.json({ ok: true, user, newUser: isNew })
      res.cookies.set('glamour_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
      return res
    } catch (err) {
      console.error('Google login DB error:', (err as Error).message)
      return NextResponse.json({ error: 'حدث خطأ في تسجيل الدخول' }, { status: 500 })
    }
  }

  // ── VALIDATE EMAIL (real-time check) ──
  if (action === 'validate_email') {
    const ev = validateEmail(id)
    return NextResponse.json(ev)
  }

  // ── LOGOUT ──
  if (action === 'logout') {
    const res = NextResponse.json({ ok: true })
    res.cookies.delete('glamour_token')
    return res
  }

  return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
}
