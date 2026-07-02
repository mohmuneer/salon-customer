'use client'
import { useState } from 'react'
import { Star, X } from 'lucide-react'

export default function RatingModal({ open, onClose, appointmentId, serviceName, staffName, onRated }:
  { open: boolean; onClose: () => void; appointmentId: string; serviceName: string; staffName: string; onRated: () => void }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (!open) return null

  const submit = async () => {
    if (rating === 0) return
    setSubmitting(true)
    const r = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appointmentId, rating, comment }),
    })
    setSubmitting(false)
    if (r.ok) { setDone(true); onRated() }
  }

  if (done) return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>شكراً لتقييمك!</h2>
        <p style={{ fontSize: 14, color: '#6B7280' }}>تقييمك يساعدنا في تحسين الخدمات</p>
      </div>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>تقييم الخدمة</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>{serviceName}</p>
        <p style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 20 }}>{staffName}</p>

        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <Star size={32} fill={s <= (hover || rating) ? 'var(--gold)' : 'none'}
                color={s <= (hover || rating) ? 'var(--gold)' : '#D1D5DB'} strokeWidth={s <= (hover || rating) ? 0 : 1.5} />
            </button>
          ))}
        </div>

        <textarea className="input" rows={3} placeholder="أكتب ملاحظاتك (اختياري)..."
          value={comment} onChange={e => setComment(e.target.value)}
          style={{ resize: 'none', marginBottom: 16, width: '100%', boxSizing: 'border-box' }} />

        <button className="btn-gold" disabled={rating === 0 || submitting}
          onClick={submit} style={{ width: '100%', fontFamily: 'inherit' }}>
          {submitting ? 'جارٍ الإرسال...' : 'إرسال التقييم'}
        </button>
      </div>
    </div>
  )
}