'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ShoppingCart, Plus, Minus, Package, Search, X, Check } from 'lucide-react'
import { useApi } from '@/lib/fetcher'
import { useCart } from '@/lib/useCart'

export default function StorePage() {
  const router  = useRouter()
  const { data, isLoading } = useApi<any[]>('/api/products')
  const { items: cartItems, count: cartCount, total: cartTotal, addItem, setQty, ready } = useCart()
  const [search, setSearch] = useState('')
  const [toast, setToast]   = useState('')

  const products = Array.isArray(data) ? data : []

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.trim().toLowerCase()
    return products.filter(p =>
      p.name_ar?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q)
    )
  }, [products, search])

  const getQty = (id: string) => cartItems.find(i => i.product_id === id)?.quantity || 0

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 1800) }

  const handleAdd = (p: any) => {
    addItem({ product_id: p.id, name_ar: p.name_ar, price: Number(p.price), image_url: p.image_url, brand: p.brand })
    showToast('أُضيف للسلة ✓')
  }

  return (
    <div style={{ paddingBottom: cartCount > 0 ? 100 : 20 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#1A1A2E', color: '#fff', padding: '10px 20px', borderRadius: 14, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#1A1A2E', padding: '16px 20px 20px', marginTop: -44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 44, marginBottom: 14 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>المتجر</h1>
          {cartCount > 0 && (
            <button type="button" onClick={() => router.push('/orders')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gold)', borderRadius: 20, padding: '6px 14px', border: 'none', cursor: 'pointer' }}>
              <ShoppingCart size={16} color="white" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{cartCount}</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن منتج..."
            style={{ width: '100%', padding: '10px 38px 10px 36px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          {search && (
            <button type="button" aria-label="مسح البحث" onClick={() => setSearch('')}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 0, display: 'flex' }}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {isLoading || !ready ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Package size={48} color="#E8E4DC" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#9CA3AF' }}>{search ? 'لا توجد منتجات مطابقة' : 'لا توجد منتجات'}</p>
            {search && <button type="button" onClick={() => setSearch('')} style={{ marginTop: 12, background: 'none', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 10, padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>مسح البحث</button>}
          </div>
        ) : (
          <>
            {search && <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 10 }}>{filtered.length} نتيجة</p>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {filtered.map((p: any) => {
                const qty        = getQty(p.id)
                const outOfStock = p.stock_qty != null && p.stock_qty <= 0
                const added      = qty > 0

                return (
                  <div key={p.id} className="card" style={{ padding: 14, opacity: outOfStock ? 0.6 : 1, border: added ? '2px solid var(--gold)' : undefined }}>
                    <div style={{ width: '100%', height: 100, borderRadius: 10, overflow: 'hidden', marginBottom: 10, position: 'relative', background: '#F8F7F4' }}>
                      {p.image_url ? (
                        <Image src={p.image_url} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 430px) 50vw" />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 36 }}>💆</div>
                      )}
                      {added && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, lineHeight: 1.3 }}>{p.name_ar}</div>
                    {p.brand && <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>{p.brand}</div>}
                    <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 15, marginBottom: 10 }}>{Number(p.price).toLocaleString()} ر.س</div>

                    {outOfStock ? (
                      <div style={{ textAlign: 'center', color: '#EF4444', fontSize: 11, fontWeight: 600 }}>نفد المخزون</div>
                    ) : qty === 0 ? (
                      <button type="button" onClick={() => handleAdd(p)}
                        style={{ width: '100%', padding: '8px', borderRadius: 10, background: 'var(--gold)', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + أضف للسلة
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FEF3E2', borderRadius: 10, padding: '4px 8px', border: '1px solid rgba(201,165,95,0.3)' }}>
                        <button type="button" aria-label="تقليل" onClick={() => setQty(p.id, qty - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Minus size={16} color="var(--gold)" /></button>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{qty}</span>
                        <button type="button" aria-label="زيادة" onClick={() => setQty(p.id, qty + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Plus size={16} color="var(--gold)" /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Cart bar → go to cart page */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 398, zIndex: 90 }}>
          <button type="button" onClick={() => router.push('/orders')} className="btn-gold"
            style={{ boxShadow: '0 8px 32px color-mix(in srgb, var(--gold) 50%, transparent)' }}>
            <ShoppingCart size={18} />
            عرض السلة ({cartCount} منتج) — {cartTotal.toLocaleString()} ر.س
          </button>
        </div>
      )}
    </div>
  )
}
