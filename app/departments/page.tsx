'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, X } from 'lucide-react'
import SalonLogo from '@/components/SalonLogo'
import { useSalonSettings } from '@/lib/useSalonSettings'

export default function DepartmentsPage() {
  const router = useRouter()
  const { settings } = useSalonSettings()
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/departments')
      .then(r => r.json())
      .then(data => { setDepartments(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return departments
    const q = search.trim().toLowerCase()
    return departments.filter(d =>
      d.name_ar?.toLowerCase().includes(q) || d.name_en?.toLowerCase().includes(q)
    )
  }, [departments, search])

  const deptIcons: Record<string, string> = {
    haircare: '💇‍♀️', skincare: '🧖‍♀️', nails: '💅', makeup: '💄', massage: '💆‍♀️',
    barber: '💈', laser: '✨', fragrance: '🌸', default: '🌟'
  }

  return (
    <div style={{ paddingBottom: 32, minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1A1A2E,#16213E)', padding: '60px 20px 20px', textAlign: 'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:8 }}>
          <SalonLogo src={settings.logo_url} size={36} borderRadius={10} />
          <h1 style={{ color:'white', fontSize:24, fontWeight:800 }}>{settings.name}</h1>
        </div>
        <p style={{ color:'rgba(255,255,255,0.6)', fontSize:14, marginBottom:16 }}>اكتشف خدماتنا ومنتجاتنا</p>

        {/* Search bar */}
        <div style={{ position:'relative', maxWidth:420, margin:'0 auto' }}>
          <Search size={15} style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.4)', pointerEvents:'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن قسم..."
            style={{ width:'100%', padding:'11px 38px 11px 36px', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.1)', color:'white', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
          />
          {search && (
            <button type="button" aria-label="مسح البحث" onClick={() => setSearch('')}
              style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', padding:0, display:'flex' }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:'0 16px' }}>
        {/* Featured banner */}
        <div onClick={() => router.push('/book')} style={{ background:'linear-gradient(135deg,var(--gold),var(--gold-light))', borderRadius:18, padding:'18px 20px', marginTop:-20, marginBottom:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 8px 30px color-mix(in srgb, var(--gold) 30%, transparent)', position:'relative', zIndex:2 }}>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:16, marginBottom:4 }}>احجز موعدك الآن</div>
            <div style={{ color:'rgba(255,255,255,0.8)', fontSize:12 }}>تصفح الأقسام واختر ما يناسبك</div>
          </div>
          <Sparkles size={28} color="white" />
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
            <div style={{ width:40, height:40, border:'4px solid var(--border)', borderTopColor:'var(--gold)', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : departments.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏗️</div>
            <p style={{ fontSize:16, fontWeight:600 }}>قريباً</p>
            <p style={{ fontSize:13, marginTop:4 }}>نعمل على تجهيز الأقسام</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <p style={{ fontSize:15, fontWeight:600 }}>لا توجد نتائج لـ "{search}"</p>
            <button type="button" onClick={() => setSearch('')}
              style={{ marginTop:12, background:'none', border:'1px solid var(--gold)', color:'var(--gold)', borderRadius:10, padding:'8px 18px', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
              مسح البحث
            </button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {filtered.map(d => {
              const icon = d.icon || deptIcons[d.slug] || deptIcons.default
              const total = (Number(d.service_count) || 0) + (Number(d.product_count) || 0)
              return (
                <div key={d.id} className="card" style={{ padding:20, cursor:'pointer', transition:'transform .2s, box-shadow .2s' }}
                  onClick={() => router.push(`/departments/${d.slug}`)}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>{icon}</div>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{d.name_ar}</div>
                  {d.name_en !== d.name_ar && (
                    <div style={{ color:'#9CA3AF', fontSize:11, marginBottom:6, direction:'ltr', textAlign:'right' }}>{d.name_en}</div>
                  )}
                  <div style={{ display:'flex', gap:8, fontSize:11, color:'#6B7280' }}>
                    {Number(d.service_count) > 0 && <span>🛎️ {d.service_count} خدمة</span>}
                    {Number(d.product_count) > 0 && <span>📦 {d.product_count} منتج</span>}
                    {total === 0 && <span style={{ color:'#D1D5DB' }}>قريباً</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
