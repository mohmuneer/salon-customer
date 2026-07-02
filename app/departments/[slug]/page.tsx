'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Clock, ArrowRight, Calendar, Package, Plus, Minus, ShoppingCart, Search, X, Copy, Check, Building2, CreditCard } from 'lucide-react'

type Tab = 'services' | 'products'
type PayTab = 'transfer' | 'debit'

interface BankInfo { bank_name: string; account_holder: string; iban: string; account_number: string }

export default function DepartmentPage() {
  const router  = useRouter()
  const params  = useParams()
  const slug    = params.slug as string

  const [data,         setData]        = useState<any>(null)
  const [loading,      setLoading]     = useState(true)
  const [tab,          setTab]         = useState<Tab>('services')
  const [cart,         setCart]        = useState<Record<string, number>>({})
  const [toast,        setToast]       = useState('')
  const [searchSvc,    setSearchSvc]   = useState('')
  const [searchProd,   setSearchProd]  = useState('')
  const [showCheckout, setShowCheckout]= useState(false)
  const [payTab,       setPayTab]      = useState<PayTab>('transfer')
  const [ordering,     setOrdering]    = useState(false)
  const [bankInfo,     setBankInfo]    = useState<BankInfo>({ bank_name: '', account_holder: '', iban: '', account_number: '' })
  const [copied,       setCopied]      = useState(false)
  // Debit form
  const [debitBank,    setDebitBank]   = useState('')
  const [debitAccount, setDebitAccount]= useState('')
  const [debitHolder,  setDebitHolder] = useState('')

  useEffect(() => {
    if (!slug) return
    fetch(`/api/departments/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); if (d?.department?.name_ar) document.title = d.department.name_ar })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d) setBankInfo({ bank_name: d.bank_name || '', account_holder: d.account_holder || '', iban: d.iban || '', account_number: d.account_number || '' })
    }).catch(() => {})
  }, [])

  /* Cart helpers */
  const addToCart      = (id: string) => { setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 })); showToast('أُضيف للسلة ✓') }
  const removeFromCart = (id: string) => setCart(c => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n })
  const cartCount      = Object.values(cart).reduce((a, b) => a + b, 0)
  const cartItems      = Object.entries(cart).map(([id, qty]) => {
    const p = (data?.products || []).find((x: any) => x.id === id)
    return p ? { ...p, qty } : null
  }).filter(Boolean) as any[]
  const cartTotal      = cartItems.reduce((s, p) => s + Number(p.price) * p.qty, 0)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  const copyIban = () => {
    navigator.clipboard.writeText(bankInfo.iban).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const placeOrder = async () => {
    if (!cartCount) return
    setOrdering(true)
    const items = cartItems.map(p => ({ product_id: p.id, quantity: p.qty }))
    const paymentMethod = payTab === 'transfer' ? 'bank_transfer' : 'direct_debit'
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, payment_method: paymentMethod }),
      })
      if (r.ok) {
        setCart({})
        setShowCheckout(false)
        showToast('تم تقديم طلبك بنجاح ✓')
        setTimeout(() => router.push('/orders'), 1500)
      } else showToast('حدث خطأ في تقديم الطلب')
    } catch { showToast('تعذّر الاتصال') }
    setOrdering(false)
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F8F7F4' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(201,165,95,0.2)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── Not found ── */
  if (!data?.department) return (
    <div style={{ textAlign: 'center', padding: 60, minHeight: '100vh', background: '#F8F7F4' }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: 18, fontWeight: 700 }}>القسم غير موجود</p>
      <button className="btn-gold" style={{ width: 'auto', display: 'inline-flex', padding: '12px 28px', marginTop: 20 }} onClick={() => router.back()}>
        <ArrowRight size={18} /> العودة
      </button>
    </div>
  )

  const { department, services = [], products = [] } = data
  const filteredSvcs  = searchSvc  ? services.filter((s: any) => s.name_ar?.includes(searchSvc)  || s.description?.includes(searchSvc))  : services
  const filteredProds = searchProd ? products.filter((p: any) => p.name_ar?.includes(searchProd) || p.brand?.includes(searchProd)) : products
  const gold = 'var(--gold)'
  const qrData = encodeURIComponent(bankInfo.iban || 'SA')
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=1A1A2E&bgcolor=F8F7F4&data=${qrData}`

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', paddingBottom: 100 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1A1A2E', color: '#fff', padding: '11px 22px', borderRadius: 16, fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* ── Hero ── */}
      <div style={{ position: 'relative', height: 240, background: '#1A1A2E', overflow: 'hidden' }}>
        {department.image_url
          ? <img src={department.image_url} alt={department.name_ar} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} />
          : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1A1A2E,#0F3460)' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)' }} />
        <button onClick={() => router.back()} style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowRight size={18} />
        </button>
        <div style={{ position: 'absolute', bottom: 20, right: 20, left: 20 }}>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 6px' }}>{department.name_ar}</h1>
          {department.description_ar && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '0 0 10px', lineHeight: 1.5 }}>{department.description_ar}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>🛎️ {services.length} خدمة</span>
            {products.length > 0 && <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>📦 {products.length} منتج</span>}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', margin: '0 16px', marginTop: -18, position: 'relative', zIndex: 10, gap: 10 }}>
        {([['services', '🛎️ الخدمات'], ['products', '📦 المنتجات']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ flex: 1, padding: '12px 10px', borderRadius: 14, border: 'none', background: tab === k ? '#fff' : 'rgba(255,255,255,0.8)', color: tab === k ? '#1A1A2E' : '#6B7280', fontWeight: tab === k ? 700 : 500, fontSize: 14, cursor: 'pointer', boxShadow: tab === k ? '0 4px 16px rgba(0,0,0,0.1)' : 'none', fontFamily: 'inherit', backdropFilter: 'blur(8px)', transition: 'all .2s' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 16px 0' }}>

        {/* ══ Services Tab ══ */}
        {tab === 'services' && (
          <>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input value={searchSvc} onChange={e => setSearchSvc(e.target.value)} placeholder="ابحث عن خدمة..."
                style={{ width: '100%', padding: '11px 42px 11px 36px', borderRadius: 14, border: '1px solid #E8E4DC', background: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              {searchSvc && <button type="button" aria-label="مسح البحث" onClick={() => setSearchSvc('')} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={16} /></button>}
            </div>
            {filteredSvcs.length === 0
              ? <Empty icon={searchSvc ? '🔍' : '🛎️'} text={searchSvc ? 'لا توجد خدمات مطابقة للبحث' : 'لا توجد خدمات في هذا القسم'} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredSvcs.map((s: any) => (
                    <div key={s.id} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,0.07)', border: s.is_featured ? `1.5px solid ${gold}` : 'none' }}>
                      {s.cover_image && (
                        <div style={{ height: 170, overflow: 'hidden', position: 'relative' }}>
                          <img src={s.cover_image} alt={s.name_ar} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.6))' }} />
                          <span style={{ position: 'absolute', bottom: 12, left: 14, color: '#fff', fontWeight: 800, fontSize: 20 }}>
                            {Number(s.price).toLocaleString()} <span style={{ fontSize: 12 }}>ر.س</span>
                          </span>
                          {s.is_featured && <span style={{ position: 'absolute', top: 10, right: 10, background: gold, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>⭐ مميزة</span>}
                        </div>
                      )}
                      <div style={{ padding: '14px 16px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontWeight: 700, fontSize: 16, margin: '0 0 5px' }}>{s.name_ar}</h3>
                            {s.description && <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 8px', lineHeight: 1.6 }}>{s.description}</p>}
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#9CA3AF' }}>
                              <span><Clock size={11} style={{ display: 'inline', marginLeft: 3 }} />{s.duration_min} دقيقة</span>
                              <span>{s.gender_target === 'ladies' ? '♀ نساء' : s.gender_target === 'gents' ? '♂ رجال' : '👥 الكل'}</span>
                            </div>
                          </div>
                          {!s.cover_image && (
                            <div style={{ textAlign: 'left', flexShrink: 0 }}>
                              <div style={{ color: gold, fontWeight: 800, fontSize: 18 }}>{Number(s.price).toLocaleString()}</div>
                              <div style={{ color: '#9CA3AF', fontSize: 11 }}>ر.س</div>
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => router.push(`/book?service=${s.id}&dept=${slug}`)}
                          style={{ width: '100%', padding: '12px', borderRadius: 12, background: `linear-gradient(135deg,${gold},var(--gold-light))`, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Calendar size={16} /> احجز الآن
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}

        {/* ══ Products Tab ══ */}
        {tab === 'products' && (
          <>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input value={searchProd} onChange={e => setSearchProd(e.target.value)} placeholder="ابحث عن منتج..."
                style={{ width: '100%', padding: '11px 42px 11px 36px', borderRadius: 14, border: '1px solid #E8E4DC', background: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              {searchProd && <button type="button" aria-label="مسح البحث" onClick={() => setSearchProd('')} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}><X size={16} /></button>}
            </div>
            {filteredProds.length === 0
              ? <Empty icon={searchProd ? '🔍' : '📦'} text={searchProd ? 'لا توجد منتجات مطابقة للبحث' : 'لا توجد منتجات في هذا القسم'} />
              : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {filteredProds.map((p: any) => {
                    const qty = cart[p.id] || 0
                    const inStock = p.stock_qty == null || p.stock_qty > 0
                    return (
                      <div key={p.id} style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', border: p.is_featured ? `1.5px solid ${gold}` : 'none' }}>
                        <div style={{ height: 140, background: '#F8F7F4', overflow: 'hidden', position: 'relative' }}>
                          {(p.primary_image || p.thumbnail)
                            ? <img src={p.primary_image || p.thumbnail} alt={p.name_ar} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🛍️</div>
                          }
                          {p.is_featured && <span style={{ position: 'absolute', top: 8, left: 8, background: gold, color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>⭐</span>}
                          {!inStock && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>نفذ</span></div>}
                        </div>
                        <div style={{ padding: '10px 12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <h3 style={{ fontWeight: 700, fontSize: 13, margin: '0 0 3px', lineHeight: 1.4 }}>{p.name_ar}</h3>
                          {p.brand && <span style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>{p.brand}</span>}
                          <div style={{ color: gold, fontWeight: 800, fontSize: 15, marginBottom: 10, marginTop: 'auto', paddingTop: 6 }}>
                            {Number(p.price).toLocaleString()} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>ر.س</span>
                          </div>
                          {qty > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F7F4', borderRadius: 10, padding: '4px 6px' }}>
                              <button type="button" onClick={() => removeFromCart(p.id)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}><Minus size={14} /></button>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{qty}</span>
                              <button type="button" onClick={() => addToCart(p.id)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: gold, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} color="white" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => inStock && addToCart(p.id)} disabled={!inStock}
                              style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', background: inStock ? gold : '#E5E7EB', color: inStock ? '#fff' : '#9CA3AF', fontWeight: 700, fontSize: 13, cursor: inStock ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                              <Plus size={14} /> أضف للسلة
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }

            {/* Cart bar */}
            {cartCount > 0 && (
              <div style={{ position: 'fixed', bottom: 72, left: 16, right: 16, background: '#1A1A2E', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: gold, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{cartCount} منتج</div>
                    <div style={{ color: gold, fontWeight: 800, fontSize: 12 }}>{cartTotal.toLocaleString()} ر.س</div>
                  </div>
                </div>
                <button type="button" onClick={() => { setPayTab('transfer'); setShowCheckout(true) }}
                  style={{ padding: '10px 22px', borderRadius: 12, background: `linear-gradient(135deg,${gold},var(--gold-light))`, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  تأكيد الطلب
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          Checkout Modal — Cart + Payment Tabs
      ══════════════════════════════════════════ */}
      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCheckout(false) }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>تأكيد الطلب</h2>
              <button type="button" onClick={() => setShowCheckout(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Cart summary */}
            <div style={{ margin: '16px 20px 0', background: '#F9FAFB', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, marginBottom: 8 }}>المنتجات المختارة</p>
              {cartItems.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < cartItems.length - 1 ? '1px solid #F1EDE4' : 'none' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name_ar}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF', marginRight: 6 }}>× {p.qty}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{(Number(p.price) * p.qty).toLocaleString()} ر.س</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTop: '2px solid var(--gold)' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>الإجمالي</span>
                <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--gold)' }}>{cartTotal.toLocaleString()} ر.س</span>
              </div>
            </div>

            {/* Payment method tabs */}
            <div style={{ margin: '20px 20px 0', display: 'flex', gap: 10 }}>
              {([['transfer', Building2, 'حوالة بنكية'], ['debit', CreditCard, 'خصم من حساب']] as const).map(([k, Icon, label]) => (
                <button key={k} type="button" onClick={() => setPayTab(k as PayTab)}
                  style={{ flex: 1, padding: '11px 8px', borderRadius: 12, border: payTab === k ? '2px solid var(--gold)' : '1px solid #E5E7EB', background: payTab === k ? '#FEF3E2' : '#fff', color: payTab === k ? 'var(--gold)' : '#6B7280', fontWeight: payTab === k ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            {/* ── Tab 1: حوالة بنكية ── */}
            {payTab === 'transfer' && (
              <div style={{ margin: '16px 20px 0' }}>
                {/* QR Code */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'inline-block', padding: 12, background: '#F8F7F4', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR IBAN" width={160} height={160} style={{ display: 'block', borderRadius: 8 }} />
                  </div>
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>امسح الـ QR للتحويل السريع</p>
                </div>

                {/* Bank details */}
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <BankRow label="البنك" value={bankInfo.bank_name} />
                  <BankRow label="اسم المستفيد" value={bankInfo.account_holder} />
                  <BankRow label="رقم الحساب" value={bankInfo.account_number} />
                  {/* IBAN with copy */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>الآيبان (IBAN)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, direction: 'ltr', letterSpacing: 1 }}>{bankInfo.iban}</span>
                      <button type="button" onClick={copyIban}
                        style={{ background: copied ? '#10B981' : 'var(--gold)', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'white', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'background .2s' }}>
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                  ⚠️ بعد إتمام التحويل سيتم التحقق من دفعتك وتأكيد طلبك خلال دقائق.
                </div>

                <button type="button" onClick={placeOrder} disabled={ordering}
                  style={{ width: '100%', marginTop: 16, padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg,var(--gold),var(--gold-light))`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: ordering ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: ordering ? 0.7 : 1 }}>
                  {ordering ? 'جارٍ تقديم الطلب...' : 'تأكيد الطلب بعد التحويل'}
                </button>
              </div>
            )}

            {/* ── Tab 2: خصم من حساب ── */}
            {payTab === 'debit' && (
              <div style={{ margin: '16px 20px 0' }}>
                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.6 }}>
                  أدخل بيانات حسابك البنكي وسنقوم بخصم المبلغ تلقائياً عند تأكيد الطلب.
                </p>

                {[
                  { label: 'اسم البنك', value: debitBank, set: setDebitBank, placeholder: 'مثال: البنك الأهلي السعودي' },
                  { label: 'رقم الحساب / الآيبان', value: debitAccount, set: setDebitAccount, placeholder: 'SA00 0000 0000 0000 0000 0000' },
                  { label: 'اسم مالك الحساب', value: debitHolder, set: setDebitHolder, placeholder: 'الاسم كما في البطاقة البنكية' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>{label}</label>
                    <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}

                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginTop: 4, fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                  🔒 بياناتك البنكية محمية بتشفير كامل. سيتم استخدامها فقط لإتمام هذه المعاملة.
                </div>

                <button type="button"
                  onClick={placeOrder}
                  disabled={ordering || !debitBank || !debitAccount || !debitHolder}
                  style={{ width: '100%', marginTop: 16, padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg,var(--gold),var(--gold-light))`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: ordering ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: (ordering || !debitBank || !debitAccount || !debitHolder) ? 0.6 : 1 }}>
                  {ordering ? 'جارٍ تقديم الطلب...' : `تأكيد الخصم — ${cartTotal.toLocaleString()} ر.س`}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{value || '—'}</span>
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 15, margin: 0 }}>{text}</p>
    </div>
  )
}
