'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, Phone, Search, Bell, Sparkles, ChevronLeft, Package, Plus } from 'lucide-react'
import { useSalonSettings } from '@/lib/useSalonSettings'
import SalonLogo from '@/components/SalonLogo'
import { useCart } from '@/lib/useCart'

export default function HomePage() {
  const router = useRouter()
  const { settings } = useSalonSettings()
  const [data, setData] = useState<any>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const { addItem } = useCart()

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(setData)
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/products').then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d.slice(0, 6) : [])).catch(() => {})
  }, [])

  const handleAddToCart = (p: any) => {
    addItem({ product_id: p.id, name_ar: p.name_ar, price: Number(p.price), image_url: p.image_url, brand: p.brand })
    setToast('أُضيف للسلة ✓')
    setTimeout(() => setToast(''), 1800)
  }

  const services = (data?.services || []).filter((s: any) => {
    const matchCat = selectedCat === 'all' || s.category_name === selectedCat
    const matchSearch = !search || s.name_ar.includes(search)
    return matchCat && matchSearch
  })

  const categories = data?.categories || []

  return (
    <div style={{ padding: '0 0 16px' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1A1A2E', color: '#fff', padding: '10px 20px', borderRadius: 14, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}
      {/* Header */}
      <div style={{ background: '#1A1A2E', padding: '16px 20px 28px', marginTop: -44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 44 }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>أهلاً بك في</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SalonLogo src={settings.logo_url} size={28} borderRadius={8} />
              <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800 }}>{settings.name}</h1>
            </div>
          </div>
          <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer', position: 'relative' }}>
            <Bell size={20} color="white" />
            <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: 'var(--gold)', borderRadius: '50%', border: '2px solid #1A1A2E' }} />
          </button>
        </div>

        {/* Salon info strip */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {[
            { icon: MapPin, text: settings.address },
            { icon: Phone, text: settings.phone },
            { icon: Clock, text: `${settings.opening_time} - ${settings.closing_time}` },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              <Icon size={12} color="var(--gold)" />{text}
            </div>
          ))}
        </div>

        {/* Search — navigates to search page */}
        <button onClick={() => router.push('/search')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}>
          <Search size={16} style={{ flexShrink: 0 }} />
          <span>ابحث عن خدمة أو منتج...</span>
        </button>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Book banner */}
        <div onClick={() => router.push('/book')} style={{ background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', borderRadius: 18, padding: '18px 20px', marginTop: 16, marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px color-mix(in srgb, var(--gold) 35%, transparent)' }}>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>احجز موعدك الآن</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>اختر خدمتك وموعدك المفضل</div>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} color="white" />
          </div>
        </div>

        {/* ══ الأقسام — Departments with images ══ */}
        {departments.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p className="section-title" style={{ margin: 0 }}>الأقسام</p>
              <button onClick={() => router.push('/departments')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 2 }}>
                الكل <ChevronLeft size={14} />
              </button>
            </div>
            {/* 2-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {departments.map((d: any) => (
                <div key={d.id} onClick={() => router.push(`/book?dept=${d.slug}`)}
                  style={{ borderRadius: 18, overflow: 'hidden', cursor: 'pointer', position: 'relative', height: 120, background: '#1A1A2E', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transition: 'transform 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  {/* Background image or gradient */}
                  {d.image_url
                    ? <img src={d.image_url} alt={d.name_ar} loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                    : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#16213E,#0F3460)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                        {d.icon || '💎'}
                      </div>
                  }
                  {/* Gradient overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05) 100%)' }} />
                  {/* Content */}
                  <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, padding: '10px 12px' }}>
                    <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.3, marginBottom: 3 }}>{d.name_ar}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {d.service_count > 0 && (
                        <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
                          {d.service_count} خدمة
                        </span>
                      )}
                      {d.product_count > 0 && (
                        <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10 }}>
                          {d.product_count} منتج
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Fallback: text category chips */
          <>
            <p className="section-title">الفئات</p>
            <div className="scroll-row" style={{ marginBottom: 20 }}>
              <button onClick={() => setSelectedCat('all')} style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: selectedCat === 'all' ? '#1A1A2E' : '#F1EDE4', color: selectedCat === 'all' ? 'white' : '#6B5B3E', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                🌟 الكل
              </button>
              {categories.map((c: any) => (
                <button key={c.id} onClick={() => setSelectedCat(c.name_ar)} style={{ padding: '8px 18px', borderRadius: 20, border: 'none', background: selectedCat === c.name_ar ? '#1A1A2E' : '#F1EDE4', color: selectedCat === c.name_ar ? 'white' : '#6B5B3E', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  {c.icon} {c.name_ar}
                </button>
              ))}
            </div>
          </>
        )}

        {/* اختر قسماً من الأعلى للاطلاع على خدماته ومنتجاته */}
        {departments.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#F8F7F4,#EDE8DC)', borderRadius: 16, padding: '16px 18px', textAlign: 'center', color: '#6B5B3E', marginBottom: 24 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>اختر قسماً لعرض خدماته ومنتجاته 👆</p>
          </div>
        )}

        {/* ══ المنتجات المميزة ══ */}
        {products.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <p className="section-title" style={{ margin: 0 }}>المنتجات</p>
              <button onClick={() => router.push('/store')}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 2 }}>
                عرض الكل <ChevronLeft size={14} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              {products.map((p: any) => (
                <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
                  {/* Image */}
                  <div onClick={() => router.push('/store')}
                    style={{ height: 100, background: '#F1EDE4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name_ar} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Package size={32} color="var(--gold)" />
                    }
                  </div>
                  {/* Info */}
                  <div style={{ padding: '10px 10px 8px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name_ar}</div>
                    {p.brand && <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 6 }}>{p.brand}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--gold)' }}>{Number(p.price).toLocaleString()} ر.س</span>
                      <button type="button" aria-label="أضف للسلة" onClick={() => handleAddToCart(p)} disabled={p.stock_qty === 0}
                        style={{ background: p.stock_qty === 0 ? '#E5E7EB' : 'var(--gold)', border: 'none', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: p.stock_qty === 0 ? 'not-allowed' : 'pointer' }}>
                        <Plus size={14} color="white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => router.push('/store')}
              style={{ width: '100%', padding: '12px', borderRadius: 14, border: '1.5px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
              <Package size={16} /> عرض جميع المنتجات
            </button>
          </>
        )}
      </div>
    </div>
  )
}
