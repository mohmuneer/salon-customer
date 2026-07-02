'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, X, AlertTriangle, Star, Package } from 'lucide-react'
import { useApi } from '@/lib/fetcher'
import { mutate } from 'swr'
import RatingModal from '@/components/RatingModal'

const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', in_progress: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغى', no_show: 'لم يحضر' }

function CancelModal({ open, onClose, onConfirm, serviceName }: { open: boolean; onClose: () => void; onConfirm: () => void; serviceName: string }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={28} color="#EF4444" />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>تأكيد الإلغاء</h2>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 24 }}>
          عزيزي العميل، هل أنت متأكد من إلغاء حجز <strong style={{ color: '#1A1A2E' }}>{serviceName}</strong>؟
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }}>
            تراجع
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'inherit' }}>
            تأكيد الإلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductsList({ products }: { products: any[] | null }) {
  if (!products || products.length === 0) return null
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E8E4DC' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
        <Package size={13} /> المنتجات
      </div>
      {products.map((p: any) => (
        <div key={p.id || p.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#374151', padding: '2px 0' }}>
          <span>{p.name || p.name_ar}</span>
          {p.type === 'optional' && <span style={{ color: 'var(--gold)', fontWeight: 600 }}>+{Number(p.unit_price || 0).toLocaleString()} ر.س</span>}
          {p.type === 'included' && <span style={{ color: '#10B981', fontSize: 11 }}>مشمول</span>}
        </div>
      ))}
    </div>
  )
}

export default function AppointmentsPage() {
  const router = useRouter()
  const { data, isLoading } = useApi<any[]>('/api/appointments')
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null)
  const [rateTarget, setRateTarget] = useState<{ id: string; serviceName: string; staffName: string } | null>(null)

  const appts = Array.isArray(data) ? data : []

  const confirmCancel = async () => {
    if (!cancelTarget) return
    await fetch('/api/appointments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cancelTarget.id }) })
    setCancelTarget(null)
    mutate('/api/appointments')
  }

  const today = new Date().toISOString().split('T')[0]
  const filtered = appts.filter(a => filter === 'upcoming' ? a.date >= today && a.status !== 'cancelled' : a.date < today || a.status === 'cancelled' || a.status === 'completed')

  return (
    <div>
      <div style={{ background: '#1A1A2E', padding: '16px 20px 20px', marginTop: -44 }}>
        <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginTop: 44, marginBottom: 16 }}>مواعيدي</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ k: 'upcoming', l: 'القادمة' }, { k: 'past', l: 'السابقة' }].map(({ k, l }) => (
            <button key={k} onClick={() => setFilter(k as any)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: filter === k ? 'var(--gold)' : 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Calendar size={48} color="#E8E4DC" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#9CA3AF', fontSize: 15 }}>لا توجد مواعيد</p>
          </div>
        ) : (
          <>
            {filtered.map((a: any) => (
              <div key={a.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{a.service_name}</div>
                    <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>{a.staff_name} — {a.salon_name}</div>
                  </div>
                  <span className={`badge badge-${a.status}`}>{STATUS_AR[a.status] || a.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, color: '#6B7280', fontSize: 13 }}>
                  <span><Calendar size={13} style={{ display: 'inline', marginLeft: 4 }} />{new Date(a.date).toLocaleDateString('ar-SA')}</span>
                  <span><Clock size={13} style={{ display: 'inline', marginLeft: 4 }} />{a.start_time?.slice(0,5)} - {a.end_time?.slice(0,5)}</span>
                </div>
                <ProductsList products={a.products} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid #F1EDE4' }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)' }}>{Number(a.total || 0).toLocaleString()} ر.س</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {a.status === 'completed' && !a.review_rating && (
                      <button onClick={() => setRateTarget({ id: a.id, serviceName: a.service_name, staffName: a.staff_name })}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gold)', background: '#FEF3E2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                        <Star size={13} /> قيّم
                      </button>
                    )}
                    {a.status === 'completed' && a.review_rating && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                        <Star size={13} fill="var(--gold)" color="var(--gold)" /> {a.review_rating}/5
                      </span>
                    )}
                    {['pending', 'confirmed'].includes(a.status) && (
                      <button onClick={() => setCancelTarget({ id: a.id, name: a.service_name })} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444', background: '#FEE2E2', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                        <X size={13} /> إلغاء
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        <button className="btn-gold" style={{ margin: '16px auto 0', width: 'auto', padding: '12px 24px', display: 'block' }} onClick={() => router.push('/book')}>+ حجز موعد جديد</button>
      </div>

      <CancelModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        serviceName={cancelTarget?.name || ''}
      />
      <RatingModal
        open={!!rateTarget}
        onClose={() => setRateTarget(null)}
        appointmentId={rateTarget?.id || ''}
        serviceName={rateTarget?.serviceName || ''}
        staffName={rateTarget?.staffName || ''}
        onRated={() => { mutate('/api/appointments'); setRateTarget(null) }}
      />
    </div>
  )
}
