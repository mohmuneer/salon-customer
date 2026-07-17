'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Mail, Lock, User, Sparkles, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useSalonSettings } from '@/lib/useSalonSettings'
import SalonLogo from '@/components/SalonLogo'

function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  if (!re.test(email)) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [, domain] = parts
  if (!domain.includes('.')) return false
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2) return false
  return true
}

export default function RegisterPage() {
  const router = useRouter()
  const { settings } = useSalonSettings()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', gender: 'female' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleInitDone = useRef(false)

  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

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

  useEffect(() => {
    if (!googleInitDone.current || !(window as any).google || !googleBtnRef.current) return
    if (googleBtnRef.current.children.length > 0) return
    try {
      ;(window as any).google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', width: googleBtnRef.current.offsetWidth || 340,
        text: 'signup_with', shape: 'rectangular', locale: 'ar',
      })
    } catch (e) { console.error('Google renderButton error:', e) }
  }, [googleReady])

  const register = async () => {
    if (!form.name || !form.email || !form.password) { setError('يرجى ملء جميع الحقول المطلوبة'); return }
    if (!isValidEmail(form.email)) { setError('صيغة البريد الإلكتروني غير صحيحة — تأكد من إدخال بريد حقيقي مثل name@gmail.com'); return }
    if (form.phone && !/^05\d{8}$/.test(form.phone.replace(/\s/g, ''))) { setError('رقم الجوال غير صحيح (05XXXXXXXX)'); return }
    if (form.password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setError(''); setLoading(true)
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', ...form }) })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error); return }
    router.push('/home')
  }

  const fields = [
    { key: 'name', label: 'الاسم الكامل', icon: User, type: 'text', placeholder: 'سارة الأحمدي' },
    { key: 'email', label: 'البريد الإلكتروني', icon: Mail, type: 'email', placeholder: 'sara@example.com' },
    { key: 'phone', label: 'رقم الجوال (اختياري)', icon: Phone, type: 'tel', placeholder: '+966500000001' },
    { key: 'password', label: 'كلمة المرور', icon: Lock, type: 'password', placeholder: '••••••••' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#1A1A2E 0%,#16213E 60%,#0F3460 100%)', display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, paddingBottom: 32 }}>
        <SalonLogo src={settings.logo_url} size={64} borderRadius={20} />
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800 }}>إنشاء حساب جديد</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>انضم لعائلة {settings.name}</p>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 28 }}>
        {GOOGLE_CLIENT_ID && <>
          <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44, marginBottom: 16 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>أو يدوياً</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
          </div>
        </>}

        {fields.map(({ key, label, icon: Icon, type, placeholder }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>{label}</label>
            <div style={{ position: 'relative' }}>
              <Icon size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: 'var(--gold)' }} />
              <input className="input" style={{ paddingRight: 40, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
                type={type} placeholder={placeholder} value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          </div>
        ))}

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

        <button className="btn-gold" onClick={register} disabled={loading}>{loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}</button>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>لديك حساب؟ </span>
          <Link href="/login" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>تسجيل الدخول</Link>
        </div>
      </div>
    </div>
  )
}
