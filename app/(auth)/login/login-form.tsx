'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, KeyRound, Download } from 'lucide-react'
import Link from 'next/link'

interface Props { name: string; logo_url: string }

/** Detect if identifier is phone */
function isPhone(id: string) {
  return /^[+0][\d\s\-]{7,}$/.test(id.trim()) || /^05\d{8}$/.test(id.trim())
}

const INSTALL_DISMISSED_KEY = 'glamour-login-install-dismissed'

export default function LoginForm({ name: initialName, logo_url: initialLogo }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'choose' | 'password' | 'otp' | 'otp_verify'>('choose')
  const [identifier, setIdentifier] = useState('')   // phone OR email
  const [password, setPassword]     = useState('')
  const [otp, setOtp]               = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [error, setError]           = useState('')
  const [info, setInfo]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [settings, setSettings]     = useState({ name: initialName, logo_url: initialLogo })
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d?.logo_url || d?.name) setSettings({ name: d.name || initialName, logo_url: d.logo_url || initialLogo })
    }).catch(() => {})
  }, [initialName, initialLogo])

  useEffect(() => {
    if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setShowInstall(false)
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    }
    setInstallPrompt(null)
  }

  const dismissInstall = () => {
    setShowInstall(false)
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
  }

  const phone = isPhone(identifier)

  const call = async (body: object) => {
    setError(''); setLoading(true)
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    setLoading(false)
    return { ok: r.ok, data: d }
  }

  const loginPassword = async () => {
    if (!identifier) { setError('أدخل البريد الإلكتروني أو رقم الجوال'); return }
    if (!password)   { setError('أدخل كلمة المرور'); return }
    const { ok, data } = await call({ action: 'login', identifier, password })
    if (!ok) { setError(data.error); return }
    router.push('/home')
  }

  const sendOtp = async () => {
    if (!identifier) { setError(phone ? 'أدخل رقم الجوال' : 'أدخل البريد الإلكتروني'); return }
    const { ok, data } = await call({ action: 'send_otp', identifier })
    if (!ok) { setError(data.error); return }
    setInfo(data.message || 'تم الإرسال')
    if (data.mock && data.code) setInfo(`${data.message} — الرمز التجريبي: ${data.code}`)
    setMode('otp_verify')
  }

  const verifyOtp = async () => {
    const { ok, data } = await call({ action: 'verify_otp', identifier, otp })
    if (!ok) { setError(data.error); return }
    router.push('/home')
  }

  const gold = 'var(--gold)'
  const inputStyle = { paddingRight: 42, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white' }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#1A1A2E 0%,#16213E 60%,#0F3460 100%)', display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>

      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, paddingBottom: 36 }}>
        <img src={settings.logo_url} alt="" style={{ width: 90, height: 90, borderRadius: 22, objectFit: 'cover', marginBottom: 14 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <h1 style={{ color: 'white', fontSize: 26, fontWeight: 800, margin: 0 }}>{settings.name}</h1>
      </div>

      {/* Install banner */}
      {showInstall && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '10px 14px', marginBottom: 16 }}>
          <Download size={18} color="var(--gold)" />
          <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            حمّل التطبيق للحصول على تجربة أسرع
          </span>
          <button onClick={handleInstall} style={{ background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            تثبيت
          </button>
          <button onClick={dismissInstall} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}

      {/* Card */}
      <div style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 28 }}>

        {/* ─ Choose mode ─ */}
        {mode === 'choose' && (
          <div>
            <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>تسجيل الدخول</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>اختر طريقة الدخول</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => setMode('password')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, cursor: 'pointer', color: 'white', textAlign: 'right', width: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg,${gold},var(--gold-light))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>الإيميل أو الجوال + كلمة المرور</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>للمستخدمين المسجلين</div>
                </div>
              </button>

              <button onClick={() => setMode('otp')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, cursor: 'pointer', color: 'white', textAlign: 'right', width: '100%' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <KeyRound size={20} color={gold} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>رمز التحقق OTP</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>عبر البريد الإلكتروني — بدون كلمة مرور</div>
                </div>
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>ليس لديك حساب؟ </span>
              <Link href="/register" style={{ color: gold, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>إنشاء حساب</Link>
            </div>
          </div>
        )}

        {/* ─ Password mode ─ */}
        {mode === 'password' && (
          <div>
            <button onClick={() => { setMode('choose'); setError(''); setIdentifier('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13 }}>
              <ArrowLeft size={16} /> رجوع
            </button>
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>الدخول بكلمة المرور</h2>

            {/* Identifier input — email or phone */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                {phone ? 'رقم الجوال' : 'البريد الإلكتروني أو رقم الجوال'}
              </label>
              <div style={{ position: 'relative' }}>
                {phone
                  ? <Phone size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: gold }} />
                  : <Mail  size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: gold }} />}
                <input className="input" style={inputStyle}
                  placeholder={phone ? '05XXXXXXXX' : 'sara@example.com أو 05XXXXXXXX'}
                  value={identifier} onChange={e => setIdentifier(e.target.value)}
                  type="text" dir="ltr" inputMode={phone ? 'tel' : 'email'} />
              </div>
              {!identifier && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>
                  يمكنك الدخول بالبريد الإلكتروني أو رقم الجوال
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <input className="input" style={{ ...inputStyle, paddingLeft: 40 }}
                  type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loginPassword()} />
                <button onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <ErrBox msg={error} />}
            <button className="btn-gold" onClick={loginPassword} disabled={loading}>
              {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
            </button>

            {/* Switch to OTP */}
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              نسيت كلمة المرور؟{' '}
              <button onClick={() => { setMode('otp'); setError('') }} style={{ background: 'none', border: 'none', color: gold, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                دخول برمز OTP
              </button>
            </p>
          </div>
        )}

        {/* ─ OTP send ─ */}
        {mode === 'otp' && (
          <div>
            <button onClick={() => { setMode('choose'); setError(''); setIdentifier('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13 }}>
              <ArrowLeft size={16} /> رجوع
            </button>
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>رمز التحقق</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
              سنرسل رمز تحقق إلى بريدك الإلكتروني
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                البريد الإلكتروني
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 14, color: gold }} />
                <input className="input" style={inputStyle}
                  placeholder="sara@example.com"
                  value={identifier} onChange={e => setIdentifier(e.target.value)}
                  type="email" dir="ltr" inputMode="email" />
              </div>
            </div>

            {error && <ErrBox msg={error} />}
            <button className="btn-gold" onClick={sendOtp} disabled={loading || !identifier}>
              {loading ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق'}
            </button>
          </div>
        )}

        {/* ─ OTP verify ─ */}
        {mode === 'otp_verify' && (
          <div>
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>أدخل رمز التحقق</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 4 }}>
              أُرسل رمز التحقق إلى {identifier}
            </p>
            {info && (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', color: '#6EE7B7', fontSize: 13, marginBottom: 16 }}>
                {info}
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <input className="input"
                style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)', color: 'white', textAlign: 'center', fontSize: 28, letterSpacing: 14, fontWeight: 800 }}
                placeholder="----" maxLength={4} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                type="text" inputMode="numeric" dir="ltr"
                onKeyDown={e => e.key === 'Enter' && verifyOtp()} />
            </div>
            {error && <ErrBox msg={error} />}
            <button className="btn-gold" onClick={verifyOtp} disabled={loading || otp.length < 4}>
              {loading ? 'جارٍ التحقق...' : 'تأكيد'}
            </button>
            <button onClick={() => { sendOtp() }} style={{ background: 'none', border: 'none', color: gold, cursor: 'pointer', width: '100%', marginTop: 12, fontSize: 13 }}>
              إعادة إرسال الرمز
            </button>
            <button onClick={() => { setMode('otp'); setOtp(''); setError(''); setInfo('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', width: '100%', marginTop: 6, fontSize: 12 }}>
              تغيير البريد الإلكتروني
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13, marginBottom: 14 }}>
      {msg}
    </div>
  )
}
