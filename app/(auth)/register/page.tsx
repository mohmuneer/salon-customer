'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Mail, Lock, User, ArrowLeft, Check, X, Shield } from 'lucide-react'
import Link from 'next/link'
import { useSalonSettings } from '@/lib/useSalonSettings'
import SalonLogo from '@/components/SalonLogo'

/* ── Client-side email validation (mirrors lib/validate-email.ts) ── */
const EMAIL_TYPOS: Record<string, string> = {
  'gmial.com':'gmail.com','gamil.com':'gmail.com','gmal.com':'gmail.com','gmaill.com':'gmail.com',
  'gmail.co':'gmail.com','gmail.cm':'gmail.com','gmail.con':'gmail.com','gmail.om':'gmail.com',
  'gnail.com':'gmail.com','googlemail.com':'gmail.com',
  'hotnail.com':'hotmail.com','hotmal.com':'hotmail.com','hotmial.com':'hotmail.com','hotmail.co':'hotmail.com',
  'outlok.com':'outlook.com','outlook.co':'outlook.com',
  'yaho.com':'yahoo.com','yahoo.co':'yahoo.com',
}
const COMMON_TLDS = new Set(['com','net','org','edu','gov','io','co','me','sa','uk','ca','au','de','fr','online','tech','app','dev','store','cloud','xyz','info','biz'])

function validateEmailStrict(email: string): { ok: boolean; error?: string; suggestion?: string } {
  const e = email.trim().toLowerCase()
  if (!e) return { ok: false, error: 'البريد الإلكتروني مطلوب' }
  if (e.includes(' ')) return { ok: false, error: 'لا يُسمح بالمسافات' }
  if (e.startsWith('@')) return { ok: false, error: 'يجب أن يبدأ باسم المستخدم' }
  if (e.endsWith('@')) return { ok: false, error: 'يجب أن يحتوي على اسم النطاق' }
  if (!e.includes('@') || e.includes('@@')) return { ok: false, error: 'صيغة غير صحيحة' }
  const [local, domain] = e.split('@')
  if (!local || local.length > 64) return { ok: false, error: 'اسم المستخدم غير صالح' }
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return { ok: false, error: 'اسم المستخدم غير صالح' }
  if (!domain || !domain.includes('.')) return { ok: false, error: 'النطاق يجب أن يحتوي على نقطة' }
  if (domain.endsWith('.') || domain.startsWith('-')) return { ok: false, error: 'النطاق غير صالح' }
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return { ok: false, error: 'الامتداد غير صالح' }
  const typo = EMAIL_TYPOS[domain]
  if (typo) return { ok: false, error: `هل تقصد ${local}@${typo}؟`, suggestion: `${local}@${typo}` }
  if (/\.co$/.test(domain) && !domain.endsWith('.co.kr') && !domain.endsWith('.co.jp') && !domain.endsWith('.co.uk'))
    return { ok: false, error: `هل تقصد ${domain.replace(/\.co$/, '.com')}؟`, suggestion: `${local}@${domain.replace(/\.co$/, '.com')}` }
  if (!COMMON_TLDS.has(tld)) return { ok: false, error: 'النطاق غير معروف أو غير صالح' }
  return { ok: true }
}

type Step = 'form' | 'otp_verify' | 'done'

export default function RegisterPage() {
  const router = useRouter()
  const { settings } = useSalonSettings()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', gender: 'female' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [emailValid, setEmailValid] = useState<boolean | null>(null)
  const [emailError, setEmailError] = useState('')
  const [emailSuggestion, setEmailSuggestion] = useState('')
  const [googleReady, setGoogleReady] = useState(false)
  const [googleUserEmail, setGoogleUserEmail] = useState('')
  const [googleUserName, setGoogleUserName] = useState('')
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleInitDone = useRef(false)
  const emailTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  // Load Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === 'undefined') return
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) { setGoogleReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true; script.defer = true
    script.onload = () => setGoogleReady(true)
    document.head.appendChild(script)
  }, [])

  // Initialize Google
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReady || !(window as any).google || googleInitDone.current) return
    try {
      ;(window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: any) => {
          if (!resp.credential) return
          setLoading(true); setError('')
          const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'google_login', credential: resp.credential }) })
          const d = await r.json()
          setLoading(false)
          if (!r.ok) { setError(d.error || 'خطأ في التسجيل بـ Google'); return }
          router.push('/home')
        },
        auto_select: false, cancel_on_tap_outside: true,
      })
      googleInitDone.current = true
    } catch (e) { console.error('Google init error:', e) }
  }, [googleReady, GOOGLE_CLIENT_ID])

  // Render Google button
  useEffect(() => {
    if (!googleInitDone.current || !(window as any).google || !googleBtnRef.current || step !== 'form') return
    if (googleBtnRef.current.children.length > 0) return
    try {
      ;(window as any).google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', width: googleBtnRef.current.offsetWidth || 340,
        text: 'signup_with', shape: 'rectangular', locale: 'ar',
      })
    } catch {}
  }, [googleReady, step])

  // Real-time email validation
  const onEmailChange = useCallback((val: string) => {
    setForm(f => ({ ...f, email: val }))
    setEmailSuggestion('')
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current)
    if (!val.trim()) { setEmailValid(null); setEmailError(''); return }
    emailTimerRef.current = setTimeout(() => {
      const r = validateEmailStrict(val)
      setEmailValid(r.ok)
      setEmailError(r.error || '')
      setEmailSuggestion(r.suggestion || '')
    }, 400)
  }, [])

  const applySuggestion = () => {
    if (emailSuggestion) {
      setForm(f => ({ ...f, email: emailSuggestion }))
      setEmailValid(true); setEmailError(''); setEmailSuggestion('')
    }
  }

  // Register with OTP verification
  const doRegister = async () => {
    if (!form.name) { setError('الاسم مطلوب'); return }
    if (!form.email) { setError('البريد الإلكتروني مطلوب'); return }
    const ev = validateEmailStrict(form.email)
    if (!ev.ok) { setError(ev.error || 'البريد الإلكتروني غير صالح'); return }
    if (!form.password || form.password.length < 6) { setError('كلمة المرور 6 أحرف على الأقل'); return }
    if (form.phone && !/^05\d{8}$/.test(form.phone.replace(/\s/g, ''))) { setError('رقم الجوال غير صحيح (05XXXXXXXX)'); return }
    setError(''); setLoading(true)
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', ...form }) })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error); return }
    if (d.step === 'verify_otp') {
      setOtpEmail(d.email)
      setStep('otp_verify')
      return
    }
    router.push('/home')
  }

  // Verify OTP
  const doVerifyOtp = async () => {
    if (!otp || otp.length < 6) { setError('أدخل رمز التحقق المكون من 6 أرقام'); return }
    setError(''); setLoading(true)
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify_register_otp', identifier: otpEmail, otp }) })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error); return }
    router.push('/home')
  }

  const emailBorderColor = emailValid === true ? '#22c55e' : emailValid === false ? '#ef4444' : 'rgba(255,255,255,0.15)'

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#1A1A2E 0%,#16213E 60%,#0F3460 100%)', display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, paddingBottom: 32 }}>
        <SalonLogo src={settings.logo_url} size={64} borderRadius={20} />
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800 }}>إنشاء حساب جديد</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>انضم لعائلة {settings.name}</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 28 }}>

        {/* ── OTP Verification Step ── */}
        {step === 'otp_verify' && (
          <div>
            <button onClick={() => { setStep('form'); setOtp(''); setError('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13 }}>
              <ArrowLeft size={16} /> رجوع
            </button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Shield size={30} color="#22c55e" />
              </div>
              <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>تحقق من بريدك الإلكتروني</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                أرسلنا رمز تحقق مكون من 6 أرقام إلى
              </p>
              <p style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700, marginTop: 4 }}>{otpEmail}</p>
            </div>
            <div style={{ marginBottom: 8 }}>
              <input className="input"
                style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white', textAlign: 'center', fontSize: 28, letterSpacing: 14, fontWeight: 800 }}
                placeholder="------" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                type="text" inputMode="numeric" dir="ltr"
                onKeyDown={e => e.key === 'Enter' && doVerifyOtp()} />
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <button className="btn-gold" onClick={doVerifyOtp} disabled={loading || otp.length < 6}>
              {loading ? 'جارٍ التحقق...' : 'تأكيد وإنشاء الحساب'}
            </button>
          </div>
        )}

        {/* ── Registration Form ── */}
        {step === 'form' && (
          <>
            {GOOGLE_CLIENT_ID && <>
              <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44, marginBottom: 16 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>أو يدوياً</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              </div>
            </>}

            {/* Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>الاسم الكامل</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: 'var(--gold)' }} />
                <input className="input" style={{ paddingRight: 40, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                  type="text" placeholder="سارة الأحمدي" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>

            {/* Email — real-time validation */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                البريد الإلكتروني <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: 'var(--gold)' }} />
                <input className="input" style={{ paddingRight: 40, paddingLeft: form.email && emailValid === true ? 40 : 8, background: 'rgba(255,255,255,0.08)', borderColor: emailBorderColor, color: 'white', transition: 'border-color 0.3s' }}
                  type="email" placeholder="name@gmail.com" value={form.email} dir="ltr" inputMode="email"
                  onChange={e => onEmailChange(e.target.value)} />
                {form.email && emailValid === true && (
                  <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 14, color: '#22c55e' }}>
                    <Check size={16} />
                  </div>
                )}
                {form.email && emailValid === false && (
                  <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 14, color: '#ef4444' }}>
                    <X size={16} />
                  </div>
                )}
              </div>
              {emailError && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: emailSuggestion ? '#f59e0b' : '#ef4444' }}>{emailError}</span>
                  {emailSuggestion && (
                    <button onClick={applySuggestion} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '2px 8px', color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      تصحيح
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>رقم الجوال (اختياري)</label>
              <div style={{ position: 'relative' }}>
                <Phone size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: 'var(--gold)' }} />
                <input className="input" style={{ paddingRight: 40, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                  type="tel" placeholder="05XXXXXXXX" value={form.phone} dir="ltr" inputMode="tel"
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: 'var(--gold)' }} />
                <input className="input" style={{ paddingRight: 40, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                  type="password" placeholder="6 أحرف على الأقل" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>

            {/* Gender */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 8 }}>الجنس</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ v: 'female', l: '♀ أنثى' }, { v: 'male', l: '♂ ذكر' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, gender: v }))}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${form.gender === v ? 'var(--gold)' : 'rgba(255,255,255,0.15)'}`, background: form.gender === v ? 'color-mix(in srgb, var(--gold) 20%, transparent)' : 'rgba(255,255,255,0.05)', color: form.gender === v ? 'var(--gold-light)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <button className="btn-gold" onClick={doRegister} disabled={loading}
              style={{ opacity: loading || (form.email && emailValid === false) ? 0.5 : 1, cursor: loading || (form.email && emailValid === false) ? 'not-allowed' : 'pointer' }}>
              {loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>لديك حساب؟ </span>
              <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>تسجيل الدخول</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
