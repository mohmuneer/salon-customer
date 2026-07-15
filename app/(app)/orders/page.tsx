'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, Scissors, Package, X, AlertTriangle,
  Plus, Minus, CreditCard, Building2, Copy, Check,
  Eye, EyeOff, Calendar, Clock, MapPin,
  ShoppingBag, FileText, Trash2, Upload,
} from 'lucide-react'
import { useApi } from '@/lib/fetcher'
import { useCart, usePaidAppts } from '@/lib/useCart'
import { startMoyasarCheckout } from '@/lib/moyasar-client'
import { mutate } from 'swr'

/* ─── Types ─────────────────────────────────────────────── */
const APPT_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكد', in_progress: 'جارٍ',
  completed: 'مكتمل', cancelled: 'ملغى', no_show: 'لم يحضر',
}
const statusColor: Record<string, string> = {
  pending: 'badge-pending', confirmed: 'badge-confirmed', in_progress: 'badge-in_progress',
  completed: 'badge-completed', cancelled: 'badge-cancelled', no_show: 'badge-no_show',
}
type PayTab = 'transfer' | 'card'
interface BankInfo { bank_name: string; account_holder: string; iban: string; account_number: string }

/* ─── Invoice Modal ──────────────────────────────────────── */
function InvoiceModal({ open, onClose, products, services, orderId, payMethod }: {
  open: boolean; onClose: () => void
  products: any[]; services: any[]
  orderId?: string; payMethod: string
}) {
  if (!open) return null
  const productsTotal = products.reduce((s, p) => s + p.price * p.quantity, 0)
  const servicesTotal = services.reduce((s, a) => s + Number(a.total || a.service_price || 0), 0)
  const grandTotal    = productsTotal + servicesTotal
  const now           = new Date()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1A1A2E,#0F3460)', padding: '24px 20px 20px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <FileText size={24} color="var(--gold)" />
          </div>
          <h2 style={{ color: 'white', fontSize: 18, fontWeight: 800, margin: 0 }}>فاتورة الطلب</h2>
          {orderId && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0 0' }}>#{orderId.slice(0, 10).toUpperCase()}</p>}
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '2px 0 0' }}>
            {now.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })} — {now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* Products */}
          {products.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                <ShoppingBag size={14} color="var(--gold)" /> المنتجات
              </div>
              {products.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1EDE4' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name_ar}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{p.quantity} × {p.price.toLocaleString()} ر.س</div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{(p.price * p.quantity).toLocaleString()} ر.س</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 600, color: '#6B7280', fontSize: 13 }}>
                <span>مجموع المنتجات</span>
                <span>{productsTotal.toLocaleString()} ر.س</span>
              </div>
            </div>
          )}

          {/* Services */}
          {services.length > 0 && (
            <div style={{ marginTop: products.length > 0 ? 12 : 20, paddingTop: products.length > 0 ? 12 : 0, borderTop: products.length > 0 ? '1px dashed #E8E4DC' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                <Scissors size={14} color="var(--gold)" /> الخدمات
              </div>
              {services.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1EDE4' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.service_name}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {new Date(a.date).toLocaleDateString('ar-SA')} — {a.start_time?.slice(0, 5)}
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{Number(a.total || a.service_price || 0).toLocaleString()} ر.س</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 600, color: '#6B7280', fontSize: 13 }}>
                <span>مجموع الخدمات</span>
                <span>{servicesTotal.toLocaleString()} ر.س</span>
              </div>
            </div>
          )}

          {/* Grand total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', marginTop: 8, borderTop: '2px solid #1A1A2E' }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>الإجمالي الكلي</span>
            <span style={{ fontWeight: 900, fontSize: 24, color: 'var(--gold)' }}>{grandTotal.toLocaleString()} ر.س</span>
          </div>

          {/* Payment method */}
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={16} color="#10B981" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#065F46' }}>تم إرسال طلب الدفع</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>طريقة الدفع: {payMethod}</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 }}>
            سيتم التحقق من دفعتك وتأكيد جميع بنود الطلب خلال دقائق
          </div>

          <button type="button" onClick={onClose} className="btn-gold">إغلاق الفاتورة</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Payment Modal ──────────────────────────────────────── */
function PaymentModal({ open, onClose, products, services, bank, onPaid }: {
  open: boolean; onClose: () => void
  products: any[]; services: any[]
  bank: BankInfo; onPaid: (method: string) => void
}) {
  const [tab,            setTab]           = useState<PayTab>('transfer')
  const [copied,         setCopied]        = useState(false)
  const [showIban,       setShowIban]      = useState(false)
  const [submitting,     setSubmitting]    = useState(false)
  // Receipt upload
  const [receiptFile,    setReceiptFile]   = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview]= useState<string | null>(null)
  const [receiptError,   setReceiptError]  = useState('')
  const [receiptUploading, setReceiptUploading] = useState(false)
  // Moyasar card
  const [moyasarLoading, setMoyasarLoading] = useState(false)
  const [moyasarError,   setMoyasarError]   = useState('')
  const moyasarInited    = useRef(false)

  useEffect(() => {
    if (!open) {
      setTab('transfer'); setCopied(false); setShowIban(false); setSubmitting(false)
      setReceiptFile(null); setReceiptPreview(null); setReceiptError('')
      setMoyasarLoading(false); setMoyasarError(''); moyasarInited.current = false
    }
  }, [open])

  if (!open) return null

  const pTotal = products.reduce((s, p) => s + p.price * p.quantity, 0)
  const sTotal = services.reduce((s, a) => s + Number(a.total || a.service_price || 0), 0)
  const total  = pTotal + sTotal
  const count  = products.reduce((s, p) => s + p.quantity, 0) + services.length

  const copyIban = () => { navigator.clipboard.writeText(bank.iban).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const maskIban = (v: string) => showIban ? v : v.slice(0, 4) + ' **** **** **** ' + v.slice(-4)

  // Moyasar initialization when card tab is selected
  useEffect(() => {
    if (tab !== 'card' || !open || moyasarInited.current) return
    let cancelled = false

    const init = async () => {
      setMoyasarLoading(true); setMoyasarError('')
      try {
        let orderId: string | null = null
        let apptIds: string[] = []

        if (products.length > 0) {
          const items = products.map(p => ({ product_id: p.product_id, quantity: p.quantity }))
          const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
          const d = await r.json()
          if (d.orderId) orderId = String(d.orderId)
        }
        apptIds = services.map((a: any) => String(a.id))

        if (!orderId && apptIds.length === 0) {
          if (!cancelled) { setMoyasarError('لا توجد عناصر للدفع'); setMoyasarLoading(false) }
          return
        }

        const cfg = await fetch('/api/payment-config').then(r => r.json())
        if (!cfg.enabled || !cfg.publishableKey) {
          if (!cancelled) { setMoyasarError('الدفع بالبطاقة غير متاح حالياً'); setMoyasarLoading(false) }
          return
        }

        if (cancelled) return
        moyasarInited.current = true
        setMoyasarLoading(false)

        await startMoyasarCheckout({
          elementSelector: '#moyasar-card-form',
          amountSar: total,
          description: `طلب من متجر (${count} عنصر)`,
          publishableKey: cfg.publishableKey,
          orderId,
          appointmentIds: apptIds.length > 0 ? apptIds : undefined,
        })
      } catch (err: any) {
        if (!cancelled) { setMoyasarError(err.message || 'تعذر تحميل نموذج الدفع'); setMoyasarLoading(false) }
      }
    }
    init()
    return () => { cancelled = true }
  }, [tab, open, products, services, total, count]) // eslint-disable-line

  const handleReceiptFile = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) { setReceiptError('يُسمح فقط بصور JPG أو PNG أو PDF'); return }
    if (file.size > 5 * 1024 * 1024) { setReceiptError('حجم الملف يجب أن لا يتجاوز 5MB'); return }
    setReceiptError('')
    setReceiptFile(file)
    if (file.type !== 'application/pdf') {
      const reader = new FileReader()
      reader.onload = e => setReceiptPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview('pdf')
    }
  }

  const handleTransferConfirm = async () => {
    if (!receiptFile) { setReceiptError('يرجى رفع سند الحوالة البنكية'); return }
    setSubmitting(true); setReceiptUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', receiptFile)
      fd.append('amount', String(total))
      fd.append('appointment_ids', JSON.stringify(services.map((a: any) => String(a.id))))
      const r = await fetch('/api/payment-receipts', { method: 'POST', body: fd })
      if (!r.ok) { const d = await r.json(); setReceiptError(d.error || 'فشل رفع السند'); setSubmitting(false); setReceiptUploading(false); return }
    } catch { setReceiptError('حدث خطأ في رفع السند'); setSubmitting(false); setReceiptUploading(false); return }
    setReceiptUploading(false)
    onPaid('حوالة بنكية')
    setSubmitting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 32 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>إتمام الدفع</h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>{count} عنصر</p>
          </div>
          <button type="button" aria-label="إغلاق" onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ margin: '14px 20px 0', background: '#F9FAFB', borderRadius: 14, padding: '12px 14px' }}>
          {products.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
              <span style={{ color: '#374151' }}>{p.name_ar} ×{p.quantity}</span>
              <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{(p.price * p.quantity).toLocaleString()} ر.س</span>
            </div>
          ))}
          {products.length > 0 && services.length > 0 && <div style={{ borderTop: '1px dashed #E8E4DC', margin: '6px 0' }} />}
          {services.map((a, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
              <span style={{ color: '#374151' }}>{a.service_name}</span>
              <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{Number(a.total || a.service_price || 0).toLocaleString()} ر.س</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '2px solid var(--gold)' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>الإجمالي</span>
            <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--gold)' }}>{total.toLocaleString()} ر.س</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ margin: '14px 20px 0', display: 'flex', gap: 10 }}>
          {([['transfer', Building2, 'تحويل بنكي'], ['card', CreditCard, 'بطاقة بنكية']] as const).map(([k, Icon, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              style={{ flex: 1, padding: '11px 8px', borderRadius: 12, border: tab === k ? '2px solid var(--gold)' : '1px solid #E5E7EB', background: tab === k ? '#FEF3E2' : '#fff', color: tab === k ? 'var(--gold)' : '#6B7280', fontWeight: tab === k ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tab: تحويل بنكي ── */}
        {tab === 'transfer' && (
          <div style={{ margin: '14px 20px 0' }}>
            {/* IBAN */}
            <div style={{ background: 'linear-gradient(135deg,#1A1A2E,#0F3460)', borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>الآيبان — IBAN</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: 'white', direction: 'ltr', letterSpacing: 2 }}>
                  {maskIban(bank.iban)}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setShowIban(s => !s)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
                    {showIban ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" onClick={copyIban}
                    style={{ background: copied ? '#10B981' : 'var(--gold)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'تم النسخ' : 'نسخ'}
                  </button>
                </div>
              </div>
            </div>
            {/* Bank info */}
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {[['البنك', bank.bank_name], ['المستفيد', bank.account_holder], ['رقم الحساب', bank.account_number]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>{l}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{v || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400E', lineHeight: 1.6, marginBottom: 14 }}>
              ⚠️ قم بالتحويل أولاً ثم ارفع صورة الإيصال واضغط تأكيد.
            </div>

            {/* Receipt upload */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#374151', fontWeight: 700, marginBottom: 8 }}>
                رفع إيصال التحويل <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: receiptPreview ? 0 : '20px 12px',
                border: `2px dashed ${receiptError ? '#EF4444' : receiptFile ? '#10B981' : 'var(--gold)'}`,
                borderRadius: 14, cursor: 'pointer', background: '#FAFAFA',
                overflow: 'hidden', minHeight: receiptPreview ? 0 : 90,
              }}>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f) }} />
                {receiptPreview && receiptPreview !== 'pdf'
                  ? <img src={receiptPreview} alt="إيصال" style={{ width: '100%', maxHeight: 160, objectFit: 'contain' }} />
                  : receiptPreview === 'pdf'
                  ? <div style={{ textAlign: 'center', padding: 16 }}>
                      <FileText size={32} color="var(--gold)" style={{ margin: '0 auto 6px', display: 'block' }} />
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{receiptFile?.name}</div>
                    </div>
                  : <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                      <Upload size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--gold)' }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>اضغط لرفع صورة الإيصال</div>
                      <div style={{ fontSize: 11, marginTop: 3 }}>JPG, PNG, PDF · حتى 5MB</div>
                    </div>
                }
              </label>
              {receiptFile && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Check size={12} /> تم اختيار الإيصال بنجاح
                  </span>
                  <button type="button" onClick={() => { setReceiptFile(null); setReceiptPreview(null); setReceiptError('') }}
                    style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#EF4444', fontSize: 11, fontFamily: 'inherit' }}>
                    تغيير
                  </button>
                </div>
              )}
              {receiptError && <div style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>⚠️ {receiptError}</div>}
            </div>

            <button type="button" onClick={handleTransferConfirm} disabled={submitting || !receiptFile}
              style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,var(--gold),var(--gold-light))', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', opacity: (submitting || !receiptFile) ? 0.6 : 1 }}>
              {receiptUploading ? 'جارٍ رفع الإيصال...' : submitting ? 'جارٍ المعالجة...' : `تأكيد التحويل — ${total.toLocaleString()} ر.س`}
            </button>
          </div>
        )}

        {/* ── Tab: بطاقة بنكية ── */}
        {tab === 'card' && (
          <div style={{ margin: '14px 20px 20px' }}>
            {moyasarLoading && (
              <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF' }}>
                <div style={{ width: 36, height: 36, border: '3px solid rgba(201,165,95,0.2)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, fontWeight: 600 }}>جارٍ تحميل نموذج الدفع...</p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            {moyasarError && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ background: '#FEE2E2', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
                  <p style={{ color: '#B91C1C', fontSize: 13, fontWeight: 600, margin: 0 }}>{moyasarError}</p>
                </div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                  يمكنك استخدام التحويل البنكي كبديل
                </div>
              </div>
            )}
            {!moyasarLoading && !moyasarError && (
              <>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14 }}>
                  أدخل بيانات بطاقتك الآمنة أدناه لإتمام الدفع — {total.toLocaleString()} ر.س
                </div>
                <div id="moyasar-card-form" style={{ minHeight: 180 }} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Cancel Modal ───────────────────────────────────────── */
function CancelModal({ open, onClose, onConfirm, loading, error }: {
  open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean; error: string
}) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 22, padding: 28, maxWidth: 340, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <AlertTriangle size={24} color="#EF4444" />
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>إلغاء الحجز</h3>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>هل تريد إلغاء هذا الحجز من السلة؟</p>
        {error && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '8px 12px', color: '#B91C1C', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 12, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>تراجع</button>
          <button type="button" onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: 11, borderRadius: 12, border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : 'إلغاء الحجز'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Cart Page ─────────────────────────────────────── */
const ORDER_STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكد', preparing: 'يُحضَّر',
  shipped: 'في الطريق', delivered: 'تم التوصيل', cancelled: 'ملغى',
}
const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: 'badge-pending', confirmed: 'badge-confirmed', preparing: 'badge-in_progress',
  shipped: 'badge-confirmed', delivered: 'badge-completed', cancelled: 'badge-cancelled',
}

export default function CartPage() {
  const router = useRouter()
  const { data: apptsData,  isLoading: loadingAppts  } = useApi<any[]>('/api/appointments')
  const { data: ordersData, isLoading: loadingOrders } = useApi<any[]>('/api/orders')
  const { items: cartProducts, count: cartCount, total: cartProductsTotal, setQty, remove, clear, ready } = useCart()
  const { ids: paidApptIds, markPaid, unmark: unmarkPaid } = usePaidAppts()

  // ── All useState first ──
  const [activeTab,      setActiveTab]      = useState<'unpaid' | 'paid'>('unpaid')
  const [showPayment,    setShowPayment]    = useState(false)
  const [showInvoice,    setShowInvoice]    = useState(false)
  const [cancelApptId,   setCancelApptId]   = useState<string | null>(null)
  const [cancelling,     setCancelling]     = useState(false)
  const [cancelError,    setCancelError]    = useState('')
  const [paidMethod,     setPaidMethod]     = useState('')
  const [invoiceOrderId, setInvoiceOrderId] = useState('')
  const [invoiceProducts,setInvoiceProducts]= useState<any[]>([])
  const [invoiceServices,setInvoiceServices]= useState<any[]>([])
  const [detailItem,     setDetailItem]     = useState<any>(null)
  const [detailType,     setDetailType]     = useState<'appt' | 'order'>('appt')
  const [bankInfo,       setBankInfo]       = useState<BankInfo>({ bank_name: '', account_holder: '', iban: '', account_number: '' })
  const creatingRef = useRef(false)

  useEffect(() => {
    fetch('/api/bank-account').then(r => r.json()).then(d => {
      if (d && d.iban) setBankInfo({ bank_name: d.bank_name || '', account_holder: d.account_holder || '', iban: d.iban || '', account_number: d.account_number || '' })
    }).catch(() => {
      fetch('/api/settings').then(r => r.json()).then(d => {
        if (d) setBankInfo({ bank_name: d.bank_name || '', account_holder: d.account_holder || '', iban: d.iban || '', account_number: d.account_number || '' })
      }).catch(() => {})
    })
  }, [])

  // ── Derived values ──
  const allAppts    = Array.isArray(apptsData) ? apptsData : []
  const dbOrders    = Array.isArray(ordersData) ? ordersData : []

  // Active (not yet paid) appointments for the cart
  const activeAppts = allAppts.filter(a =>
    !['cancelled', 'completed', 'no_show'].includes(a.status) &&
    !paidApptIds.has(String(a.id))
  )
  // History: paid appointments + all DB orders
  const paidAppts   = allAppts.filter(a => paidApptIds.has(String(a.id)))
  const hasHistory  = dbOrders.length > 0 || paidAppts.length > 0

  const servicesTotal = activeAppts.reduce((s, a) => s + Number(a.total || a.service_price || 0), 0)
  const grandTotal    = cartProductsTotal + servicesTotal
  const totalItems    = cartCount + activeAppts.length
  const isEmpty       = totalItems === 0 && ready && !loadingAppts && !loadingOrders

  // ── Checkout: create order for products, then show invoice ──
  const handlePaid = useCallback(async (method: string) => {
    if (creatingRef.current) return
    creatingRef.current = true

    let orderId = ''
    // Create product order if there are products in cart
    if (cartProducts.length > 0) {
      try {
        const items = cartProducts.map(p => ({ product_id: p.product_id, quantity: p.quantity }))
        const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
        const d = await r.json()
        orderId = d.orderId ? String(d.orderId) : ''
      } catch { /* ignore */ }
    }

    // Save snapshot BEFORE clearing
    const snapProducts = [...cartProducts]
    const snapServices = [...activeAppts]

    // Mark appointments as paid (shared hook → updates badge in layout too)
    markPaid(activeAppts.map(a => String(a.id)))

    setInvoiceProducts(snapProducts)
    setInvoiceServices(snapServices)
    setPaidMethod(method)
    setInvoiceOrderId(orderId)
    clear()                        // clear local product cart
    setShowPayment(false)
    setShowInvoice(true)
    mutate('/api/orders')
    mutate('/api/appointments')
    creatingRef.current = false
  }, [cartProducts, activeAppts, markPaid, clear]) // eslint-disable-line

  // ── Cancel appointment ──
  const confirmCancelAppt = async () => {
    if (!cancelApptId) return
    setCancelling(true); setCancelError('')
    try {
      const r = await fetch('/api/appointments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cancelApptId }) })
      if (!r.ok) { const d = await r.json(); setCancelError(d.error || 'فشل الإلغاء'); setCancelling(false); return }
      // Remove from paid IDs so it won't be hidden if re-booked
      unmarkPaid(String(cancelApptId))
      mutate('/api/appointments')
      setCancelApptId(null)
    } catch { setCancelError('حدث خطأ') }
    setCancelling(false)
  }

  const openDetail = (item: any, type: 'appt' | 'order') => { setDetailItem(item); setDetailType(type) }

  return (
    <div style={{ paddingBottom: activeTab === 'unpaid' && totalItems > 0 ? 110 : 20 }}>
      {/* ── Header with Tabs ── */}
      <div style={{ background: '#1A1A2E', padding: '16px 20px 0', marginTop: -44 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 44, marginBottom: 16 }}>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>طلباتي</h1>
          {activeTab === 'unpaid' && totalItems > 0 && (
            <div style={{ background: 'var(--gold)', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShoppingCart size={13} color="white" />
              <span style={{ color: 'white', fontWeight: 700, fontSize: 12 }}>{totalItems}</span>
            </div>
          )}
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[
            { key: 'unpaid', label: 'غير مدفوعة', count: totalItems },
            { key: 'paid',   label: 'مدفوعة',     count: paidAppts.length + dbOrders.length },
          ].map(({ key, label, count }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key as 'unpaid' | 'paid')}
              style={{ flex: 1, padding: '11px 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: activeTab === key ? 700 : 400, color: activeTab === key ? 'white' : 'rgba(255,255,255,0.45)', borderBottom: activeTab === key ? '3px solid var(--gold)' : '3px solid transparent', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {label}
              {count > 0 && (
                <span style={{ background: activeTab === key ? 'var(--gold)' : 'rgba(255,255,255,0.2)', color: 'white', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {(!ready || loadingAppts || loadingOrders) ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>جارٍ التحميل...</div>

        ) : activeTab === 'unpaid' ? (
          /* ══════════ TAB 1: غير مدفوعة ══════════ */
          isEmpty ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <ShoppingCart size={52} color="#E8E4DC" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#9CA3AF', fontSize: 16, marginBottom: 6 }}>لا توجد طلبات معلقة</p>
              <p style={{ color: '#C4C4C4', fontSize: 13, marginBottom: 24 }}>أضف منتجات من المتجر أو احجز خدمة</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button type="button" className="btn-gold" style={{ width: 'auto', padding: '11px 20px' }} onClick={() => router.push('/store')}>
                  <ShoppingBag size={16} /> المتجر
                </button>
                <button type="button" className="btn-outline" style={{ width: 'auto', padding: '11px 20px' }} onClick={() => router.push('/book')}>
                  <Scissors size={16} /> احجز خدمة
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Products */}
              {cartProducts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={13} /> منتجات السلة
                  </p>
                  {cartProducts.map(p => (
                    <div key={p.product_id} className="card" style={{ padding: 14, marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name_ar}</div>
                          {p.brand && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{p.brand}</div>}
                          <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: 15, marginTop: 4 }}>
                            {(p.price * p.quantity).toLocaleString()} ر.س
                            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}> ({p.price.toLocaleString()} × {p.quantity})</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <button type="button" aria-label="حذف" onClick={() => remove(p.product_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, display: 'flex' }}>
                            <Trash2 size={16} />
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8F7F4', borderRadius: 10, padding: '4px 8px' }}>
                            <button type="button" aria-label="تقليل" onClick={() => setQty(p.product_id, p.quantity - 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><Minus size={15} color="var(--gold)" /></button>
                            <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{p.quantity}</span>
                            <button type="button" aria-label="زيادة" onClick={() => setQty(p.product_id, p.quantity + 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><Plus size={15} color="var(--gold)" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active appointments */}
              {activeAppts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Scissors size={13} /> الخدمات المحجوزة
                  </p>
                  {activeAppts.map((a: any) => (
                    <div key={a.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{a.service_name}</div>
                          <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{a.staff_name}{a.salon_name ? ` — ${a.salon_name}` : ''}</div>
                        </div>
                        <span className={`badge ${statusColor[a.status] || 'badge-pending'}`}>{APPT_STATUS_AR[a.status] || a.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} />{new Date(a.date).toLocaleDateString('ar-SA')}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{a.start_time?.slice(0, 5)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #F1EDE4' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)' }}>{Number(a.total || a.service_price || 0).toLocaleString()} ر.س</span>
                        <button type="button" onClick={() => { setCancelError(''); setCancelApptId(a.id) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#EF4444', background: '#FEE2E2', border: 'none', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                          <Trash2 size={13} /> إزالة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grand total */}
              <div className="card" style={{ padding: '14px 16px', marginBottom: 8 }}>
                {cartProductsTotal > 0 && servicesTotal > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', marginBottom: 6 }}>
                      <span>المنتجات</span><span>{cartProductsTotal.toLocaleString()} ر.س</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', marginBottom: 10 }}>
                      <span>الخدمات</span><span>{servicesTotal.toLocaleString()} ر.س</span>
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>الإجمالي الكلي</span>
                  <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--gold)' }}>{grandTotal.toLocaleString()} ر.س</span>
                </div>
              </div>
            </>
          )

        ) : (
          /* ══════════ TAB 2: مدفوعة ══════════ */
          paidAppts.length === 0 && dbOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <FileText size={48} color="#E8E4DC" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#9CA3AF', fontSize: 15 }}>لا توجد طلبات مدفوعة بعد</p>
            </div>
          ) : (
            <>
              {/* Paid appointments */}
              {paidAppts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Scissors size={13} /> خدمات تم سدادها
                  </p>
                  {paidAppts.map((a: any) => (
                    <div key={a.id} className="card" style={{ padding: 14, marginBottom: 10, borderRight: '3px solid #10B981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{a.service_name}</div>
                          <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>{a.staff_name}{a.salon_name ? ` — ${a.salon_name}` : ''}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: '#F0FDF4', padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <Check size={11} /> تم السداد
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} />{new Date(a.date).toLocaleDateString('ar-SA')}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{a.start_time?.slice(0, 5)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #F1EDE4' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)' }}>{Number(a.total || a.service_price || 0).toLocaleString()} ر.س</span>
                        <button type="button" onClick={() => openDetail(a, 'appt')}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F9FAFB', border: '1px solid #E8E4DC', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }}>
                          <Eye size={13} /> عرض التفاصيل
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* DB orders */}
              {dbOrders.length > 0 && (
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingBag size={13} /> طلبات المنتجات
                  </p>
                  {dbOrders.map((o: any) => (
                    <div key={o.id} className="card" style={{ padding: 14, marginBottom: 10, borderRight: '3px solid var(--gold)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>طلب #{String(o.id).slice(0, 8).toUpperCase()}</div>
                          <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>{new Date(o.created_at).toLocaleDateString('ar-SA')} · {o.items_count} منتج</div>
                        </div>
                        <span className={`badge ${ORDER_STATUS_COLOR[o.status] || 'badge-pending'}`}>{ORDER_STATUS_AR[o.status] || o.status}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #F1EDE4' }}>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--gold)' }}>{Number(o.total).toLocaleString()} ر.س</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: o.payment_status === 'paid' ? '#10B981' : '#F59E0B', marginRight: 8 }}>
                            {o.payment_status === 'paid' ? '✓ مدفوع' : '○ معلق'}
                          </span>
                        </div>
                        <button type="button" onClick={() => openDetail(o, 'order')}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F9FAFB', border: '1px solid #E8E4DC', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }}>
                          <Eye size={13} /> عرض التفاصيل
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* ── Fixed payment button (unpaid tab only) ── */}
      {activeTab === 'unpaid' && totalItems > 0 && (
        <div style={{ position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 430, zIndex: 90 }}>
          <button type="button" onClick={() => setShowPayment(true)} className="btn-gold"
            style={{ boxShadow: '0 8px 32px color-mix(in srgb, var(--gold) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <CreditCard size={18} />
            <span>إتمام الدفع · {totalItems} عنصر</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 12px', borderRadius: 20, fontWeight: 900 }}>
              {grandTotal.toLocaleString()} ر.س
            </span>
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && detailType === 'appt' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setDetailItem(null) }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '85vh', overflowY: 'auto', paddingBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: '1px solid #F1EDE4' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>تفاصيل الخدمة</h2>
              <button type="button" aria-label="إغلاق" onClick={() => setDetailItem(null)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
            </div>
            <div style={{ padding: '0 20px' }}>
              <div style={{ margin: '16px 0', background: '#FEF3E2', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{detailItem.service_name}</div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>{detailItem.staff_name}</div>
              </div>
              {[
                { l: 'الحالة', v: <span className={`badge ${statusColor[detailItem.status] || 'badge-pending'}`}>{APPT_STATUS_AR[detailItem.status] || detailItem.status}</span> },
                { l: 'التاريخ', v: new Date(detailItem.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
                { l: 'الوقت', v: `${detailItem.start_time?.slice(0, 5)} – ${detailItem.end_time?.slice(0, 5)}` },
                { l: 'الفرع', v: detailItem.salon_name || '—' },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #F9FAFB' }}>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>{l}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              {detailItem.notes && <div style={{ padding: '10px 0', borderBottom: '1px solid #F9FAFB', fontSize: 13, color: '#374151' }}><span style={{ color: '#9CA3AF' }}>ملاحظات: </span>{detailItem.notes}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '2px solid var(--gold)', marginTop: 4 }}>
                <span style={{ fontWeight: 700 }}>سعر الخدمة</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--gold)' }}>{Number(detailItem.total || detailItem.service_price || 0).toLocaleString()} ر.س</span>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} className="btn-gold" style={{ marginTop: 4 }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {detailItem && detailType === 'order' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setDetailItem(null) }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '88vh', overflowY: 'auto', paddingBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', borderBottom: '1px solid #F1EDE4' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>تفاصيل الطلب</h2>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>#{String(detailItem.id).slice(0, 10).toUpperCase()}</p>
              </div>
              <button type="button" aria-label="إغلاق" onClick={() => setDetailItem(null)} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
            </div>
            <div style={{ padding: '0 20px' }}>
              {[
                { l: 'الحالة', v: <span className={`badge ${ORDER_STATUS_COLOR[detailItem.status] || 'badge-pending'}`}>{ORDER_STATUS_AR[detailItem.status] || detailItem.status}</span> },
                { l: 'تاريخ الطلب', v: new Date(detailItem.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) },
                { l: 'الدفع', v: <span style={{ fontSize: 13, fontWeight: 700, color: detailItem.payment_status === 'paid' ? '#10B981' : '#F59E0B' }}>{detailItem.payment_status === 'paid' ? '✓ مدفوع' : '○ معلق'}</span> },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #F9FAFB' }}>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>{l}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              {detailItem.salon_name && (
                <div style={{ margin: '12px 0', background: '#F9FAFB', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Building2 size={13} color="var(--gold)" />{detailItem.salon_name}</div>
                  {detailItem.salon_address && <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{detailItem.salon_address}</div>}
                </div>
              )}
              {Array.isArray(detailItem.items) && detailItem.items.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>المنتجات</p>
                  {detailItem.items.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F9FAFB', borderRadius: 10, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.quantity} × {Number(item.unit_price).toLocaleString()} ر.س</div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{(Number(item.unit_price) * item.quantity).toLocaleString()} ر.س</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '2px solid var(--gold)', marginTop: 8 }}>
                <span style={{ fontWeight: 700 }}>الإجمالي</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--gold)' }}>{Number(detailItem.total).toLocaleString()} ر.س</span>
              </div>
              <button type="button" onClick={() => setDetailItem(null)} className="btn-gold" style={{ marginTop: 4 }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        products={cartProducts}
        services={activeAppts}
        bank={bankInfo}
        onPaid={handlePaid}
      />
      <InvoiceModal
        open={showInvoice}
        onClose={() => { setShowInvoice(false); router.push('/home') }}
        products={invoiceProducts}
        services={invoiceServices}
        orderId={invoiceOrderId}
        payMethod={paidMethod}
      />
      <CancelModal
        open={!!cancelApptId}
        onClose={() => { setCancelApptId(null); setCancelError('') }}
        onConfirm={confirmCancelAppt}
        loading={cancelling}
        error={cancelError}
      />
    </div>
  )
}
