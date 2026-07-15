'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PaymentCallbackContent />
    </Suspense>
  )
}

function PaymentCallbackContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'success' | 'failed'>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const orderId = params.get('orderId')
    const appointmentIds = params.get('appointmentIds')
    const paymentId = params.get('id') || params.get('paymentId')
    const moyasarStatus = params.get('status')

    if (!paymentId || (!orderId && !appointmentIds)) {
      setState('failed')
      setMessage('بيانات الدفع غير مكتملة')
      return
    }
    if (moyasarStatus && moyasarStatus !== 'paid') {
      setState('failed')
      setMessage(params.get('message') || 'لم تكتمل عملية الدفع')
      return
    }

    const qs = new URLSearchParams({ paymentId })
    if (orderId) qs.set('orderId', orderId)
    if (appointmentIds) qs.set('appointmentIds', appointmentIds)

    fetch(`${ADMIN_URL}/api/public-payment-callback?${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setState('success')
        else { setState('failed'); setMessage(d.error || 'تعذر تأكيد الدفع') }
      })
      .catch(() => { setState('failed'); setMessage('تعذر الاتصال بالخادم') })
  }, [params])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F4', padding: 20 }}>
      <div style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: 36, textAlign: 'center' }}>
        {state === 'checking' && (
          <>
            <Loader2 size={48} color="var(--gold)" style={{ margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>جارٍ التحقق من الدفع...</h1>
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>يرجى الانتظار قليلاً</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 20px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>تم الدفع بنجاح</h1>
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 20px' }}>تم تأكيد طلبك، شكراً لثقتك بنا</p>
            <button type="button" onClick={() => router.push('/home')}
              style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              العودة للمتجر
            </button>
          </>
        )}
        {state === 'failed' && (
          <>
            <XCircle size={48} color="#EF4444" style={{ margin: '0 auto 20px' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>تعذّر إتمام الدفع</h1>
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 20px' }}>{message}</p>
            <button type="button" onClick={() => router.push('/orders')}
              style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              العودة للسلة
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
