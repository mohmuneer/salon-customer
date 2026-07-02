'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Phone, Mail, Edit2, LogOut, Calendar, ShoppingCart, Star } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', gender: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setProfile(d)
      setForm({ name: d.name || '', email: d.email || '', gender: d.gender || 'female' })
    })
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    setProfile((p: any) => ({ ...p, ...form }))
    setEditing(false)
  }

  const logout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  if (!profile) return <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>جارٍ التحميل...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1A1A2E,#16213E)', padding: '16px 20px 32px', marginTop: -44, textAlign: 'center' }}>
        <div style={{ marginTop: 44 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 32, color: 'white', fontWeight: 800 }}>
            {profile.name?.charAt(0)}
          </div>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{profile.name}</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{profile.phone}</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>عضو منذ {new Date(profile.created_at).getFullYear()}</p>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Edit form */}
        {editing ? (
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>تعديل البيانات</h3>
            {[
              { key: 'name', label: 'الاسم', type: 'text' },
              { key: 'email', label: 'البريد الإلكتروني', type: 'email' },
            ].map(({ key, label, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 6 }}>{label}</label>
                <input className="input" type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#6B7280', display: 'block', marginBottom: 8 }}>الجنس</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ v: 'female', l: '♀ أنثى' }, { v: 'male', l: '♂ ذكر' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, gender: v }))}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${form.gender === v ? 'var(--gold)' : '#E5E7EB'}`, background: form.gender === v ? '#FEF3E2' : 'white', color: form.gender === v ? 'var(--gold)' : '#6B7280', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-gold" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
              <button className="btn-outline" style={{ flex: 0.5 }} onClick={() => setEditing(false)}>إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>بياناتي</h3>
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                <Edit2 size={14} /> تعديل
              </button>
            </div>
            {[
              { icon: User, label: 'الاسم', value: profile.name },
              { icon: Phone, label: 'الجوال', value: profile.phone },
              { icon: Mail, label: 'البريد', value: profile.email || '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color="var(--gold)" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
          {[
            { icon: Calendar, label: 'مواعيدي', href: '/appointments' },
            { icon: ShoppingCart, label: 'طلباتي', href: '/orders' },
          ].map(({ icon: Icon, label, href }) => (
            <button key={href} onClick={() => router.push(href)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'none', border: 'none', borderBottom: '1px solid #F1EDE4', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit' }}>
              <Icon size={18} color="var(--gold)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{label}</span>
              <span style={{ marginRight: 'auto', color: '#9CA3AF' }}>›</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 14, background: '#FEE2E2', border: 'none', color: '#DC2626', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          <LogOut size={18} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}
